import type { AppEnv } from '../env';
import { BULK_RECOMPUTE_CURSOR_KEY, BULK_RECOMPUTE_KV_KEY, LAST_RECOMPUTE_META_KEY } from '../constants/pipeline';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { recomputeMatchProbability } from './recomputeMatch';
import { refreshChampionOdds } from './tournamentChampionOdds';
import { logError, logInfo } from '../utils/logger';
import { nowIso } from '../utils/time';

export type RecomputeScheduleOptions = {
  /** Run one bounded chunk in this invocation, then queue the rest. */
  immediate?: boolean;
  /** Enqueue async bulk job when not running immediately. */
  queue?: boolean;
};

export type BulkRecomputeRunOptions = {
  /** Last match id already finished. Absent means start from the saved cursor, or the first match. */
  cursor?: string;
  phase?: 'matches' | 'champion';
  budgetMs?: number;
  now?: () => number;
  reason?: string;
};

type BulkPending = { reason: string; cursor?: string };

export function readBulkPending(raw: string | null): BulkPending | null {
  if (!raw) return null;
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { reason?: string; cursor?: string };
      if (typeof parsed.reason === 'string' && parsed.reason) {
        return { reason: parsed.reason, cursor: parsed.cursor };
      }
    } catch {
      /* A plain source string is a fresh schedule. */
    }
  }
  return { reason: raw };
}

async function writeBulkPending(env: AppEnv, reason: string, cursor?: string): Promise<void> {
  const value = cursor ? JSON.stringify({ reason, cursor }) : reason;
  await env.KV.put(BULK_RECOMPUTE_KV_KEY, value, { expirationTtl: 86400 });
}

/**
 * Stay under the 15-minute queue consumer limit, and under the 2-minute
 * briefing wait. At most this many matches per message, and never past the
 * time budget. The next message carries the cursor.
 */
export const BULK_RECOMPUTE_CHUNK_SIZE = 8;
export const BULK_RECOMPUTE_BUDGET_MS = 60_000;

export type BulkChunkResult = {
  done: boolean;
  processed: number;
  nextCursor?: string;
};

function resumeIndex(ids: string[], cursors: Array<string | null | undefined>): number {
  let furthest = -1;
  for (const cursor of cursors) {
    if (!cursor) continue;
    const index = ids.indexOf(cursor);
    if (index > furthest) furthest = index;
  }
  return furthest < 0 ? 0 : furthest + 1;
}

function awaitWithin<T>(work: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return Promise.reject(new Error('bulk recompute budget exhausted'));
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('bulk recompute budget exhausted')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function listWc2026MatchIds(env: AppEnv): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM matches WHERE tournament_id = ? ORDER BY kickoff_utc ASC, id ASC`,
  )
    .bind(WC2026_TOURNAMENT_ID)
    .all<{ id: string }>();
  return (results ?? []).map((row) => row.id);
}

/**
 * Recompute matches until the budget is spent. A match that throws or exceeds
 * the remaining time is skipped so the same id cannot pin the next invocation.
 * The cursor is that match id. Running the same cursor twice recomputes only
 * what is still after the further of the message cursor and the saved cursor.
 */
export async function runWc2026BulkChunk(
  env: AppEnv,
  options: BulkRecomputeRunOptions = {},
): Promise<BulkChunkResult> {
  const budgetMs = options.budgetMs ?? BULK_RECOMPUTE_BUDGET_MS;
  const now = options.now ?? Date.now;
  const started = now();
  const ids = await listWc2026MatchIds(env);
  const saved = await env.KV.get(BULK_RECOMPUTE_CURSOR_KEY);
  let index = resumeIndex(ids, [options.cursor, saved]);
  let processed = 0;
  let last = index > 0 ? ids[index - 1] : undefined;

  while (index < ids.length && processed < BULK_RECOMPUTE_CHUNK_SIZE) {
    const elapsed = now() - started;
    if (elapsed >= budgetMs) break;
    const matchId = ids[index]!;
    const outcome = recomputeMatchProbability(env, matchId).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    let budgetHit = false;
    try {
      const result = await awaitWithin(outcome, budgetMs - elapsed);
      if (!result.ok) {
        logError('recompute failed', { match_id: matchId, error: String(result.error) });
      }
    } catch (error) {
      budgetHit = true;
      logError('recompute failed', { match_id: matchId, error: String(error) });
    }
    last = matchId;
    processed += 1;
    index += 1;
    await env.KV.put(BULK_RECOMPUTE_CURSOR_KEY, matchId, { expirationTtl: 86400 });
    if (options.reason) await writeBulkPending(env, options.reason, matchId);
    if (budgetHit) break;
  }

  const done = index >= ids.length;
  return { done, processed, nextCursor: done ? undefined : last };
}

async function enqueueBulk(
  env: AppEnv,
  body: { reason?: string; cursor?: string; phase?: 'matches' | 'champion' },
): Promise<void> {
  if (!env.MODEL_QUEUE) {
    logInfo('bulk wc2026 recompute paused', {
      reason: body.reason,
      cursor: body.cursor,
      phase: body.phase,
    });
    return;
  }
  await env.MODEL_QUEUE.send({ type: 'recompute_wc2026_bulk', ...body });
}

/** Run one bulk slice if the KV flag is set. A continuation carries the cursor. */
export async function runBulkRecomputeIfPending(
  env: AppEnv,
  options: BulkRecomputeRunOptions = {},
): Promise<boolean> {
  if (options.phase === 'champion') {
    try {
      await awaitWithin(refreshChampionOdds(env), options.budgetMs ?? BULK_RECOMPUTE_BUDGET_MS);
      logInfo('champion odds refreshed after bulk recompute', {});
    } catch (err) {
      logInfo('champion odds refresh failed after bulk recompute', { error: String(err) });
    }
    return true;
  }

  const pending = readBulkPending(await env.KV.get(BULK_RECOMPUTE_KV_KEY));
  if (!pending && !options.cursor) return false;
  const reason = pending?.reason ?? options.reason ?? 'continuation';

  let chunk: BulkChunkResult;
  try {
    chunk = await runWc2026BulkChunk(env, {
      ...options,
      reason,
      cursor: options.cursor ?? pending?.cursor,
    });
  } catch (error) {
    const cursor = (await env.KV.get(BULK_RECOMPUTE_CURSOR_KEY)) ?? pending?.cursor;
    if (cursor) {
      await writeBulkPending(env, reason, cursor);
      await enqueueBulk(env, { reason, cursor });
      logInfo('bulk wc2026 recompute paused', { reason, cursor, error: String(error) });
      return true;
    }
    throw error;
  }

  if (!chunk.done) {
    await enqueueBulk(env, { reason, cursor: chunk.nextCursor });
    logInfo('bulk wc2026 recompute continued', {
      reason,
      processed: chunk.processed,
      cursor: chunk.nextCursor,
    });
    return true;
  }

  await env.KV.delete(BULK_RECOMPUTE_KV_KEY);
  await env.KV.delete(BULK_RECOMPUTE_CURSOR_KEY);
  await env.KV.put(LAST_RECOMPUTE_META_KEY, nowIso(), { expirationTtl: 86400 * 7 });
  logInfo('bulk wc2026 recompute finished', { reason, processed: chunk.processed });
  if (env.MODEL_QUEUE) {
    await env.MODEL_QUEUE.send({ type: 'recompute_wc2026_bulk', reason, phase: 'champion' });
    return true;
  }
  try {
    await refreshChampionOdds(env);
    logInfo('champion odds refreshed after bulk recompute', { reason });
  } catch (err) {
    logInfo('champion odds refresh failed after bulk recompute', { reason, error: String(err) });
  }
  return true;
}

/**
 * Mark probabilities stale after reference/live data changes.
 * Call from ingest, progression, and manual pull scripts (via KV).
 */
export async function scheduleRecomputeAfterDataChange(
  env: AppEnv,
  source: string,
  options: RecomputeScheduleOptions = {},
): Promise<void> {
  const { immediate = false, queue = true } = options;

  await env.KV.delete(BULK_RECOMPUTE_CURSOR_KEY);
  await env.KV.put(BULK_RECOMPUTE_KV_KEY, source, { expirationTtl: 86400 });
  await env.KV.put(LAST_RECOMPUTE_META_KEY, nowIso(), { expirationTtl: 86400 * 7 });
  logInfo('wc2026 recompute scheduled', { source, immediate, queue });

  if (immediate) {
    await runBulkRecomputeIfPending(env);
    return;
  }

  if (queue && env.MODEL_QUEUE) {
    await env.MODEL_QUEUE.send({ type: 'recompute_wc2026_bulk', reason: source });
  }
}
