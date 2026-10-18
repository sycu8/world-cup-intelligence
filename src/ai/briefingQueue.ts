import type { AppEnv } from '../env';
import { logInfo } from '../utils/logger';

export const BRIEFING_INFLIGHT_PREFIX = 'briefing:inflight:';
/**
 * A batch can hold 5 messages, and each briefing call may use the full 120s
 * AI timeout, so the marker must outlive 5 × 120s.
 */
export const BRIEFING_INFLIGHT_TTL_SECONDS = 660;
/** After this, the page must stop saying "generating". The attempt is failed and retryable. */
export const BRIEFING_STALE_MS = 150_000;

const INFLIGHT_WITHHELD = 'withheld';

export type BriefingEnqueueResult = {
  generating: boolean;
  /** The in-flight marker was already too old. A fresh job was queued; this attempt is not-ready. */
  failed: boolean;
};

/** A blank reply already stored this value. Do not enqueue or generate again. */
export async function isBriefingWithheld(env: AppEnv, matchId: string): Promise<boolean> {
  return (await env.KV.get(inflightKey(matchId))) === INFLIGHT_WITHHELD;
}

/** `1:<epochMs>`. A bare `1` is the pre-timestamp marker and is treated as stale. */
export function briefingQueuedMarker(now = Date.now()): string {
  return `1:${now}`;
}

function inflightAge(value: string | null, now: number): 'empty' | 'withheld' | 'fresh' | 'stale' {
  if (!value) return 'empty';
  if (value === INFLIGHT_WITHHELD) return 'withheld';
  const match = /^1:(\d+)$/.exec(value);
  if (!match) return 'stale';
  const age = now - Number(match[1]);
  if (age >= 0 && age < BRIEFING_STALE_MS) return 'fresh';
  return 'stale';
}

function inflightKey(matchId: string) {
  return `${BRIEFING_INFLIGHT_PREFIX}${matchId}`;
}

/**
 * Enqueue one briefing job per match. A fresh marker drops duplicates.
 * A marker older than BRIEFING_STALE_MS, or a legacy `1` with no timestamp,
 * is a failed attempt: one replacement is queued and the caller reports not-ready.
 */
export async function requestBriefingGeneration(
  env: AppEnv,
  matchId: string,
  now = Date.now(),
): Promise<BriefingEnqueueResult> {
  if (!env.MODEL_QUEUE) return { generating: false, failed: false };
  const key = inflightKey(matchId);
  const state = inflightAge(await env.KV.get(key), now);
  if (state === 'withheld') return { generating: false, failed: false };
  if (state === 'fresh') return { generating: true, failed: false };

  await env.KV.put(key, briefingQueuedMarker(now), { expirationTtl: BRIEFING_INFLIGHT_TTL_SECONDS });
  try {
    await env.MODEL_QUEUE.send({ type: 'ai_briefing', matchId });
  } catch (error) {
    await env.KV.delete(key);
    throw error;
  }
  logInfo('tactical briefing enqueued', { matchId, stale: state === 'stale' });
  if (state === 'stale') return { generating: false, failed: true };
  return { generating: true, failed: false };
}

export async function clearBriefingInflight(env: AppEnv, matchId: string): Promise<void> {
  await env.KV.delete(inflightKey(matchId));
}

/** Keep the marker, but stop the page from showing "generating" after a blank reply. */
export async function markBriefingWithheld(env: AppEnv, matchId: string): Promise<void> {
  await env.KV.put(inflightKey(matchId), INFLIGHT_WITHHELD, {
    expirationTtl: BRIEFING_INFLIGHT_TTL_SECONDS,
  });
}
