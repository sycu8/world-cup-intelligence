import type { AppEnv } from '../env';
import { logInfo } from '../utils/logger';

export const BRIEFING_INFLIGHT_PREFIX = 'briefing:inflight:';
/**
 * A batch can hold 5 messages, and each briefing call may use the full 120s
 * AI timeout, so the marker must outlive 5 × 120s.
 */
export const BRIEFING_INFLIGHT_TTL_SECONDS = 660;

const INFLIGHT_QUEUED = '1';
const INFLIGHT_WITHHELD = 'withheld';

function inflightKey(matchId: string) {
  return `${BRIEFING_INFLIGHT_PREFIX}${matchId}`;
}

/**
 * Enqueue one briefing job per match. A live KV marker drops duplicates
 * while a consumer is still running.
 * Returns true when a job is queued or already in flight.
 */
export async function requestBriefingGeneration(env: AppEnv, matchId: string): Promise<boolean> {
  if (!env.MODEL_QUEUE) return false;
  const key = inflightKey(matchId);
  const existing = await env.KV.get(key);
  // A blank reply already fell back. Do not report "generating" or enqueue again.
  if (existing === INFLIGHT_WITHHELD) return false;
  if (existing) return true;

  await env.KV.put(key, INFLIGHT_QUEUED, { expirationTtl: BRIEFING_INFLIGHT_TTL_SECONDS });
  try {
    await env.MODEL_QUEUE.send({ type: 'ai_briefing', matchId });
  } catch (error) {
    await env.KV.delete(key);
    throw error;
  }
  logInfo('tactical briefing enqueued', { matchId });
  return true;
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
