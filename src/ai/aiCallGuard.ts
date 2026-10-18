import { AsyncLocalStorage } from 'node:async_hooks';
import type { AppEnv } from '../env';
import { logInfo } from '../utils/logger';

/** Default ceiling for one queue message or refresh. Wrangler can override it. */
export const DEFAULT_AI_CALLS_PER_RUN = 40;
/** Default ceiling across every run in the same minute. Wrangler can override it. */
export const DEFAULT_AI_CALLS_PER_MINUTE = 80;
export const AI_BACKOFF_KEY = 'ai:backoff';
export const AI_BACKOFF_TTL_SECONDS = 120;
export const AI_RESULT_TTL_SECONDS = 3600;

const storage = new AsyncLocalStorage<AiRunState>();

/**
 * Per-isolate minute counter. KV is the shared ceiling; this map stops one
 * isolate from overshooting it when several translations run at once.
 * Keyed by the env object, which is the Worker's binding set, not a user.
 */
const minuteCounts = new WeakMap<object, { minute: number; count: number }>();

export type AiRunFlags = {
  runId?: string;
  redelivery?: boolean;
  fromDlq?: boolean;
  stale?: boolean;
};

type AiRunState = {
  runId: string;
  calls: number;
  skipped: number;
  rateLimited: number;
  redelivery: boolean;
  fromDlq: boolean;
  stale: boolean;
};

export type GuardedAiMeta = {
  matchId?: string;
  minute?: number | null;
  source?: string;
  signal?: AbortSignal;
};

export function readAiBudget(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return value;
}

export function aiCallsPerRun(env: AppEnv): number {
  return readAiBudget(env.AI_CALLS_PER_RUN, DEFAULT_AI_CALLS_PER_RUN);
}

export function aiCallsPerMinute(env: AppEnv): number {
  return readAiBudget(env.AI_CALLS_PER_MINUTE, DEFAULT_AI_CALLS_PER_MINUTE);
}

export function isAiCapacityError(error: unknown): boolean {
  return /\b3021\b/.test(errorText(error)) || /\b3040\b/.test(errorText(error));
}

/** True when this run must not send another AI job. */
export function aiEnqueueBlocked(): boolean {
  const state = storage.getStore();
  if (!state) return false;
  return state.rateLimited > 0 || state.redelivery || state.fromDlq || state.stale;
}

export function aiRunFlagsFromDelivery(input: {
  attempts?: number;
  fromDlq?: boolean;
  stale?: boolean;
  runId?: string;
}): AiRunFlags {
  return {
    runId: input.runId,
    redelivery: (input.attempts ?? 1) > 1,
    fromDlq: Boolean(input.fromDlq),
    stale: Boolean(input.stale),
  };
}

export async function withAiRun<T>(flags: AiRunFlags, fn: () => Promise<T>): Promise<T> {
  const state: AiRunState = {
    runId: flags.runId ?? crypto.randomUUID(),
    calls: 0,
    skipped: 0,
    rateLimited: 0,
    redelivery: Boolean(flags.redelivery),
    fromDlq: Boolean(flags.fromDlq),
    stale: Boolean(flags.stale),
  };
  try {
    return await storage.run(state, fn);
  } finally {
    logInfo('ai calls', {
      runId: state.runId,
      calls: state.calls,
      skipped: state.skipped,
      rateLimited: state.rateLimited,
      redelivery: state.redelivery,
      fromDlq: state.fromDlq,
      stale: state.stale,
    });
  }
}

export function aiResultCacheKey(model: string, meta: GuardedAiMeta = {}): string {
  const matchId = (meta.matchId || 'na').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80);
  const minute = meta.minute == null || Number.isNaN(Number(meta.minute)) ? 'na' : String(meta.minute);
  return `ai:result:${matchId}:${minute}:${fnv1a(meta.source ?? '')}:${model}`;
}

/**
 * One Workers AI call, or a cached copy of one.
 * Returns null when the budget, a redelivery, or a capacity error says skip.
 * 3021 and 3040 are not thrown, so the caller can ack instead of retrying.
 */
export async function guardedAiRun(
  env: AppEnv,
  model: string,
  inputs: Record<string, unknown>,
  meta: GuardedAiMeta = {},
): Promise<unknown | null> {
  if (!env.AI) return null;
  const state = storage.getStore();
  const key = aiResultCacheKey(model, meta);
  const reuseOnly = Boolean(state && (state.redelivery || state.fromDlq || state.stale || state.rateLimited > 0));
  if (reuseOnly || (await backoffActive(env))) {
    if (state) state.skipped += 1;
    return readCached(env, key);
  }

  const perRun = aiCallsPerRun(env);
  const perMinute = aiCallsPerMinute(env);
  if (state && state.calls >= perRun) {
    state.skipped += 1;
    return readCached(env, key);
  }

  const now = Date.now();
  const minute = Math.floor(now / 60_000);
  const minuteKey = `ai:calls:${minute}`;
  const kvUsed = await readCount(env, minuteKey);
  if (kvUsed >= perMinute || !reserveMinute(env, minute, perMinute, kvUsed)) {
    if (state) state.skipped += 1;
    return readCached(env, key);
  }
  if (state) state.calls += 1;

  try {
    const response = await invokeAi(env, model, inputs, meta.signal);
    const encoded = serializeAiResult(response);
    if (encoded) {
      try {
        await env.KV.put(key, encoded, { expirationTtl: AI_RESULT_TTL_SECONDS });
      } catch {
        /* a later attempt calls the model again */
      }
    }
    return response;
  } catch (error) {
    if (!isAiCapacityError(error)) throw error;
    await noteAiCapacity(env, error);
    if (state) state.skipped += 1;
    return null;
  } finally {
    await writeCount(env, minuteKey, Math.max(kvUsed + 1, localMinuteCount(env, minute)));
  }
}

export async function noteAiCapacity(env: AppEnv, error: unknown): Promise<void> {
  const state = storage.getStore();
  if (state) state.rateLimited += 1;
  const text = errorText(error);
  const code = /\b3021\b/.test(text) ? '3021' : '3040';
  try {
    await env.KV.put(AI_BACKOFF_KEY, code, { expirationTtl: AI_BACKOFF_TTL_SECONDS });
  } catch {
    /* the in-memory flag still stops this run */
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  return String(error);
}

async function backoffActive(env: AppEnv): Promise<boolean> {
  try {
    return Boolean(await env.KV.get(AI_BACKOFF_KEY));
  } catch {
    return false;
  }
}

async function readCount(env: AppEnv, key: string): Promise<number> {
  try {
    const raw = await env.KV.get(key);
    const value = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

async function writeCount(env: AppEnv, key: string, value: number): Promise<void> {
  try {
    await env.KV.put(key, String(value), { expirationTtl: 120 });
  } catch {
    /* the in-isolate counter still applies */
  }
}

async function readCached(env: AppEnv, key: string): Promise<unknown | null> {
  try {
    const raw = await env.KV.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function reserveMinute(env: object, minute: number, limit: number, kvUsed: number): boolean {
  let bucket = minuteCounts.get(env);
  if (!bucket || bucket.minute !== minute) {
    bucket = { minute, count: kvUsed };
    minuteCounts.set(env, bucket);
  } else if (kvUsed > bucket.count) {
    bucket.count = kvUsed;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function localMinuteCount(env: object, minute: number): number {
  const bucket = minuteCounts.get(env);
  if (!bucket || bucket.minute !== minute) return 0;
  return bucket.count;
}

function serializeAiResult(response: unknown): string | null {
  if (response == null) return null;
  if (typeof ReadableStream !== 'undefined' && response instanceof ReadableStream) return null;
  try {
    const text = JSON.stringify(response);
    return typeof text === 'string' ? text : null;
  } catch {
    return null;
  }
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function invokeAi(
  env: AppEnv,
  model: string,
  inputs: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  const ai = env.AI;
  if (!ai) return null;
  if (signal) return ai.run(model as never, inputs as never, { signal });
  return ai.run(model as never, inputs as never);
}
