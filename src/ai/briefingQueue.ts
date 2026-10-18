import type { AppEnv } from '../env';
import { logInfo } from '../utils/logger';

export const BRIEFING_INFLIGHT_PREFIX = 'briefing:inflight:';
/** Long enough for a queue consumer to finish, short enough to retry after a crash. */
export const BRIEFING_INFLIGHT_TTL_SECONDS = 120;

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
  if (existing) return true;

  await env.KV.put(key, '1', { expirationTtl: BRIEFING_INFLIGHT_TTL_SECONDS });
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
