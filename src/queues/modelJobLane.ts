import { BRIEFING_STALE_MS } from '../ai/briefingQueue';

/**
 * ai_briefing stays on MODEL_QUEUE. A second queue binding would isolate it
 * from this backlog, and that is a wrangler change that needs Cuong's OK.
 * Until then, stale messages are acked without AI, and a fresh briefing
 * runs before other fresh work in the same batch.
 */
export const MODEL_JOB_MAX_AGE_MS: Record<string, number> = {
  ai_briefing: BRIEFING_STALE_MS,
  ai_multi_analyze: 30 * 60_000,
  ai_extract_news: 30 * 60_000,
  LIVE_RECOMPUTE: 10 * 60_000,
  SCENARIO_RECOMPUTE: 10 * 60_000,
  recompute: 30 * 60_000,
  recompute_all: 30 * 60_000,
  PRE_MATCH_RECOMPUTE: 60 * 60_000,
  SCENARIO_GENERATE: 60 * 60_000,
  SCENARIO_BACKTEST: 6 * 60 * 60_000,
  recompute_wc2026_bulk: 6 * 60 * 60_000,
};

export function modelJobPriority(type: string): number {
  return type === 'ai_briefing' ? 0 : 1;
}

/** Drop unknown types and messages older than that type's TTL. No AI call. */
export function modelMessageDisposition(
  body: { type?: string } | null | undefined,
  timestamp: Date | undefined,
  now = Date.now(),
): 'run' | 'drop' {
  const type = body?.type;
  if (!type || !(type in MODEL_JOB_MAX_AGE_MS)) return 'drop';
  if (!timestamp || Number.isNaN(timestamp.getTime())) return 'drop';
  if (now - timestamp.getTime() > MODEL_JOB_MAX_AGE_MS[type]) return 'drop';
  return 'run';
}
