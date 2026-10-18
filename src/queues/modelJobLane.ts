import { BRIEFING_STALE_MS } from '../ai/briefingQueue';

/**
 * ai_briefing stays on MODEL_QUEUE. A second queue binding would isolate it
 * from bulk work, and that is a wrangler change that needs Cuong's OK.
 * Until then, stale messages are acked without AI, a fresh briefing runs
 * before other work in the same batch, and bulk runs last.
 */
/** One AI message cannot hold the rest of the batch past the briefing call cap. */
export const AI_MESSAGE_TIMEOUT_MS = 120_000;
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
  if (type === 'ai_briefing') return 0;
  if (type === 'recompute_wc2026_bulk') return 2;
  return 1;
}

/**
 * Rejects when `ms` elapses and aborts `signal`, even if `work` never settles.
 * The caller acks or retries that message and continues the batch.
 */
export function withMessageTimeout<T>(
  ms: number,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('model message timed out'));
    }, ms);
    try {
      work(controller.signal).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
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
