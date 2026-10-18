import { BRIEFING_INFLIGHT_TTL_SECONDS } from '../ai/briefingQueue';
import { logError } from '../utils/logger';

/**
 * How long an ai_briefing may sit on the queue before it is dropped.
 * One batch can be 5 AI calls at 120s each (600s). The in-flight marker lives
 * for the same 660s, so a briefing waiting its turn is not dropped early.
 * The 150s page guard is separate. Hours-old backlog messages are still dropped.
 */
export const AI_BRIEFING_QUEUE_MAX_AGE_MS = BRIEFING_INFLIGHT_TTL_SECONDS * 1000;

/**
 * ai_briefing stays on MODEL_QUEUE. A second queue binding would isolate it
 * from bulk work, and that is a wrangler change that needs Cuong's OK.
 * Until then, stale messages are acked without AI, a fresh briefing runs
 * before other work in the same batch, and bulk runs last.
 */
/** One AI message cannot hold the rest of the batch past the briefing call cap. */
export const AI_MESSAGE_TIMEOUT_MS = 120_000;
/**
 * Whole queue-consumer invocation. The platform wall is 15 minutes;
 * staying at 4 minutes leaves room for the runtime to ack and return.
 */
export const CONSUMER_BATCH_DEADLINE_MS = 240_000;
/**
 * One refresh_minute may hold the ingest consumer (max_concurrency 1) for at most 3 minutes.
 * A longer hold is what leaves lastDataRefresh unchanged until the 15 minute platform wall.
 */
export const REFRESH_MAX_HOLD_MS = 3 * 60_000;
/** Non-AI messages, including a bulk chunk, stay inside the batch deadline. */
export const MODEL_MESSAGE_TIMEOUT_MS = 90_000;
/**
 * One slice of crawl_news, statsbomb, league sync, or bulk_ingest.
 * Short enough that the message returns and queues the next slice.
 */
export const INGEST_CHUNK_BUDGET_MS = 45_000;
/**
 * Backstop for those four jobs. Above the old 90s cap, so a slice is not
 * killed and restarted from the beginning, and under the 4-minute batch deadline.
 */
export const INGEST_LONG_JOB_TIMEOUT_MS = 180_000;
/** KV write for the stale-drop counter. It must not outlive the message timeout. */
export const STALE_DROP_COUNT_TIMEOUT_MS = 2_000;
/**
 * Growing backoff for an explicit retry. `wrangler` `retry_delay` is the
 * platform default (the first step). Later attempts wait longer, then the DLQ.
 */
export const QUEUE_RETRY_DELAYS_SECONDS = [10, 30, 90, 300] as const;

export function queueRetryDelaySeconds(attempts: number | undefined): number {
  const attempt = typeof attempts === 'number' && attempts > 0 ? attempts : 1;
  const index = Math.min(QUEUE_RETRY_DELAYS_SECONDS.length, attempt) - 1;
  return QUEUE_RETRY_DELAYS_SECONDS[index]!;
}

const INGEST_TIMEOUT_MS: Record<string, number> = {
  crawl_news: INGEST_LONG_JOB_TIMEOUT_MS,
  sync_leagues: INGEST_LONG_JOB_TIMEOUT_MS,
  source_ingest: INGEST_LONG_JOB_TIMEOUT_MS,
  bulk_ingest: INGEST_LONG_JOB_TIMEOUT_MS,
  // Was 60s, then the 4 minute batch budget. The minute cron still enqueues
  // every 60s, but this consumer has max_concurrency 1, so lastDataRefresh
  // advances when the FIFA score sync finishes (about 2 minutes). A single
  // 163s gap is one of those syncs and sits inside this 3 minute hold.
  refresh_minute: REFRESH_MAX_HOLD_MS,
  match_complete: 60_000,
  refresh_live_probabilities: 60_000,
  webhook_deliver: 30_000,
};

export function ingestMessageTimeoutMs(type: string): number {
  return INGEST_TIMEOUT_MS[type] ?? MODEL_MESSAGE_TIMEOUT_MS;
}

/**
 * The batch ran out of time. Re-queue the same body and ack so max_retries
 * stays unused. `retry()` would spend an attempt and can land the message on the DLQ.
 */
export async function deferQueuedMessage<Body>(
  queue: { send(body: Body, options?: { delaySeconds?: number }): Promise<unknown> } | undefined,
  msg: Message<Body>,
): Promise<void> {
  if (!queue) {
    logError('queue defer skipped', { reason: 'no queue' });
    return;
  }
  try {
    await queue.send(msg.body);
    msg.ack();
  } catch (error) {
    logError('queue defer failed', { error: String(error) });
  }
}

export const MODEL_JOB_MAX_AGE_MS: Record<string, number> = {
  ai_briefing: AI_BRIEFING_QUEUE_MAX_AGE_MS,
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

/** Cap for one message. The batch loop also clamps this to the time still left. */
export function modelMessageTimeoutMs(type: string): number {
  if (type === 'ai_briefing' || type === 'ai_multi_analyze' || type === 'ai_extract_news') {
    return AI_MESSAGE_TIMEOUT_MS;
  }
  return MODEL_MESSAGE_TIMEOUT_MS;
}

export function modelJobPriority(type: string): number {
  if (type === 'ai_briefing') return 0;
  if (type === 'recompute_wc2026_bulk') return 2;
  return 1;
}

/**
 * Rejects when `ms` elapses and aborts `signal`, even if `work` never settles.
 * The caller acks or retries that message and continues the batch.
 */
export function throwIfMessageAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error('model message timed out');
}

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
