import type { AppEnv } from '../env';
import { BULK_RECOMPUTE_KV_KEY, LAST_RECOMPUTE_META_KEY } from '../constants/pipeline';
import { recomputeAllWc2026Matches } from './recomputeMatch';
import { refreshChampionOdds } from './tournamentChampionOdds';
import { logInfo } from '../utils/logger';
import { nowIso } from '../utils/time';

export type RecomputeScheduleOptions = {
  /** Run all 104 WC 2026 matches immediately in this Worker invocation. */
  immediate?: boolean;
  /** Enqueue async bulk job when not running immediately. */
  queue?: boolean;
};

/** Run bulk recompute if KV flag is set (any non-empty value = pending). */
export async function runBulkRecomputeIfPending(env: AppEnv): Promise<boolean> {
  const reason = await env.KV.get(BULK_RECOMPUTE_KV_KEY);
  if (!reason) return false;

  const result = await recomputeAllWc2026Matches(env);
  await env.KV.delete(BULK_RECOMPUTE_KV_KEY);
  await env.KV.put(LAST_RECOMPUTE_META_KEY, nowIso(), { expirationTtl: 86400 * 7 });
  logInfo('bulk wc2026 recompute finished', {
    reason,
    total: result.total,
    recomputed: result.recomputed,
    failed: result.failed.length,
  });
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
