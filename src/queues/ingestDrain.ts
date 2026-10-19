/**
 * Drain check — do not use a remembered backlog count.
 *
 * Read the live queue depth from Queues metrics and the seconds one ack-only
 * batch just took. `estimateIngestDrainSeconds` is remaining time:
 * ceil(liveBacklog / 10) * observedSecondsPerBatch, at concurrency 1.
 * `/api/health` exposes `ingestStaleDrops` (ticks acked without running) and
 * `ingestLastRefreshRunMs` (epoch ms of the last accepted minute refresh).
 * The health payload is cached for 15s. Workers Logs stay off.
 *
 * A tick older than 10 minutes is superseded: refresh_minute, crawl_news,
 * sync_leagues, and refresh_live_probabilities are acked and not run.
 * Continuations (a feed or league cursor, or a refresh follow-up step) use
 * their own idempotency key, so a fresh slice is not collapsed into the tick.
 *
 * DLQ policy (WC58-PD-07): a failed message is retried, parked, or dropped
 * only when it is a stale duplicate. `wc-ingest-dlq` and `wc-ingest-dlq-uat`
 * have consumers (batch 10, max_retries 1, max_concurrency 1, no nested DLQ).
 * Anything that is not a stale duplicate is written to KV before it is acked.
 * If that park fails, the message is retried with a delay. It is not left
 * unacked: the platform would ack it and drop the body.
 *
 * Stale duplicates (refresh, crawl, league, and live-probability ticks older
 * than 10 minutes) are acked and not stored: a later cron tick has replaced
 * them. A fresh idempotent job with a usable timestamp is sent once with
 * `fromDlq`, at most one every DRAIN_REPLAY_GAP_SECONDS. A job with no
 * timestamp is parked, the same as every other message that already used its
 * retries. A second visit, a fresh refresh tick, a webhook, an unknown body,
 * and every model-DLQ message are parked under `ingest:dlq_parked:` for four
 * days. If the replay send fails, the body is parked and the cursor stays.
 * Cloudflare Queues reject a delay of 86400 seconds. A delay at or above that
 * 24 hour cap is parked, and the cursor is not moved.
 *
 * QA measured lastFifaSync change 8 times from 02:36:47 to 02:49:43 ICT while
 * lastDataRefresh stayed at 02:36:47. Several refreshes wrote the FIFA stamp
 * and ended before the data-refresh stamp. That window is not one in-flight
 * refresh. There is no 5-minute refresh schedule. The minute and 15-minute
 * handlers only enqueue, and the 300s retry starts only after msg.retry().
 *
 * Reported after the #58 deploy, not measured in this repo: prod DLQ 3,072
 * and UAT DLQ 4,422. An ack-only consumer batch holds 10 messages, then waits
 * DRAIN_PAUSE_SECONDS (10) when it acked at least DRAIN_ACK_BURST (4) and
 * replayed nothing. 3,072 is 307 batches of 10 plus a remainder of 2, so
 * 307 waits: 3,070 seconds, about 51 minutes. 4,422 is 442 batches of 10
 * plus a remainder of 2, so 442 waits: 4,420 seconds, about 74 minutes.
 * Idempotent replays are one every DRAIN_REPLAY_GAP_SECONDS (30): 3,072 is
 * 92,160 seconds (25.6 hours) and 4,422 is 132,660 seconds (36.85 hours).
 * Read the live depth before expecting either number. Do not purge.
 */
import { readPipelineCounter, rememberPipelineCounter, writePipelineCounter } from '../services/pipelineCounters';
import { logError } from '../utils/logger';

export const REFRESH_STALE_MS = 10 * 60_000;

/**
 * Minute cron is about 60s. A gap under that lets the next tick run.
 * The old 60s KV TTL could still be present a minute later and skip that tick,
 * leaving a gap of about two minutes.
 */
export const REFRESH_MIN_GAP_MS = 50_000;

export const INGEST_BATCH_SIZE = 10;

/**
 * D1 was down for about 2 minutes while a backlog drained in one tight loop.
 * Ack-only work does not call D1, but the next batch used to start at once
 * and a refresh was in that same window. After this many ack-only messages
 * and no real job, the consumer waits before it pulls again.
 */
export const DRAIN_ACK_BURST = 4;
export const DRAIN_PAUSE_SECONDS = 10;

/** One idempotent DLQ replay this far after the previous one. */
export const DRAIN_REPLAY_GAP_SECONDS = 30;
/** Cloudflare Queues reject a delay of 86400 seconds. Park at or above that. */
export const QUEUE_DELAY_LIMIT_SECONDS = 86_399;
/** Hard platform cap. A send must stay strictly below this. */
export const QUEUE_DELAY_MAX_SECONDS = 86_400;
/** D1 row. Not a hot KV key: one KV key accepts about one write per second. */
export const DLQ_REPLAY_CURSOR_KEY = 'dlq_replay_not_before_ms';
/** Last cursor D1 accepted, and the pre-cutover KV value. Written after a successful D1 write. */
export const DLQ_REPLAY_CURSOR_KV_KEY = 'ingest:dlq_replay_not_before_ms';

type CursorEnv = {
  DB: {
    prepare(sql: string): {
      bind(...args: unknown[]): {
        first<T>(): Promise<T | null>;
        run(): Promise<unknown>;
      };
      run(): Promise<unknown>;
    };
  };
  KV: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<unknown>;
  };
};

export type ReplayPlan = { delaySeconds: number; nextCursorMs: number };

/** A delay of 86400 seconds or more is parked. Smaller delays are sent as integers. */
export function cappedQueueDelay(delaySeconds: number): number | 'park' {
  if (!Number.isFinite(delaySeconds) || delaySeconds >= QUEUE_DELAY_MAX_SECONDS) return 'park';
  return Math.max(0, Math.floor(delaySeconds));
}

/** Delay for the current cursor. Does not store the next slot. */
export function replayDelayForCursor(cursorMs: number, now: number): ReplayPlan | 'park' {
  const notBefore = Math.max(cursorMs, now);
  const rawDelay = Math.max(0, Math.ceil((notBefore - now) / 1000));
  const delaySeconds = cappedQueueDelay(rawDelay);
  if (delaySeconds === 'park') return 'park';
  return { delaySeconds, nextCursorMs: notBefore + DRAIN_REPLAY_GAP_SECONDS * 1000 };
}

export async function loadReplayCursorMs(env: CursorEnv): Promise<number> {
  return readPipelineCounter(env, DLQ_REPLAY_CURSOR_KEY, DLQ_REPLAY_CURSOR_KV_KEY);
}

/**
 * Call only after the queue send succeeds.
 * False means D1 rejected the write. The D1 row and its KV backup stay at the
 * last accepted value. This isolate still remembers cursorMs so the next
 * replay in the same process waits another DRAIN_REPLAY_GAP_SECONDS.
 */
export async function saveReplayCursorMs(env: CursorEnv, cursorMs: number): Promise<boolean> {
  const saved = await writePipelineCounter(env, DLQ_REPLAY_CURSOR_KEY, cursorMs, DLQ_REPLAY_CURSOR_KV_KEY);
  if (!saved) rememberPipelineCounter(env, DLQ_REPLAY_CURSOR_KEY, cursorMs);
  return saved;
}

export function drainPauseMs(ackOnly: number, ranWork: boolean, burst = DRAIN_ACK_BURST): number {
  if (ranWork || ackOnly < burst) return 0;
  return DRAIN_PAUSE_SECONDS * 1000;
}

/**
 * Seconds until this replay may hit the main queue.
 * The next slot is stored only when `commit` stays true. A failed send passes
 * false so the following message keeps this slot.
 */
export async function takeDlqReplayDelaySeconds(
  env: CursorEnv,
  now = Date.now(),
  commit = true,
): Promise<number | 'park'> {
  const planned = replayDelayForCursor(await loadReplayCursorMs(env), now);
  if (planned === 'park') return 'park';
  if (commit) await saveReplayCursorMs(env, planned.nextCursorMs);
  return planned.delaySeconds;
}

export { INGEST_LAST_RUN_KEY, INGEST_STALE_DROPS_KEY } from '../constants/pipeline';

const STALE_TICK_TYPES = new Set([
  'refresh_minute',
  'crawl_news',
  'sync_leagues',
  'refresh_live_probabilities',
]);

/**
 * Jobs the DLQ may send back once. refresh_minute is idempotent too, but every
 * tick is acked on the DLQ instead: cron already enqueues the next one, and a
 * replay would start another score sync. webhook_deliver is a side effect.
 */
export const IDEMPOTENT_INGEST_TYPES = new Set([
  'crawl_news',
  'sync_leagues',
  'source_ingest',
  'bulk_ingest',
  'refresh_live_probabilities',
  'match_complete',
  'sync_match_recap',
]);

export function messageAgeMs(timestamp: Date | undefined, now: number): number | null {
  if (!timestamp || Number.isNaN(timestamp.getTime())) return null;
  return Math.max(0, now - timestamp.getTime());
}

export function isStaleIngestTick(
  body: { type?: string } | null | undefined,
  timestamp: Date | undefined,
  now = Date.now(),
): boolean {
  if (!body?.type || !STALE_TICK_TYPES.has(body.type)) return false;
  const age = messageAgeMs(timestamp, now);
  return age != null && age > REFRESH_STALE_MS;
}

export const DLQ_PARK_TTL_SECONDS = 4 * 24 * 60 * 60;

export type DlqMessageAction = 'replay' | 'drop_stale' | 'park';

/**
 * replay: send back to ingest once.
 * drop_stale: a scheduled tick older than 10 minutes. A newer cron tick replaced it.
 * park: store the body, then ack. Not a stale duplicate, so it is not deleted.
 */
export function dlqMessageAction(
  body: { type?: string; fromDlq?: boolean } | null | undefined,
  timestamp: Date | undefined,
  ingestDlq: boolean,
  now = Date.now(),
): DlqMessageAction {
  if (!ingestDlq || !body?.type) return 'park';
  if (isStaleIngestTick(body, timestamp, now)) return 'drop_stale';
  if (body.fromDlq) return 'park';
  // No timestamp: this already used its retries, and it is not a proven stale duplicate.
  // Park it. Do not replay it just because the type is idempotent.
  if (messageAgeMs(timestamp, now) == null) return 'park';
  if (IDEMPOTENT_INGEST_TYPES.has(body.type)) return 'replay';
  return 'park';
}

export function dlqParkKey(queue: string, id: string): string {
  return `ingest:dlq_parked:${queue}:${id}`;
}

export async function parkDlqMessage(
  env: {
    KV: {
      get(key: string): Promise<string | null>;
      put(key: string, value: string, options?: { expirationTtl?: number }): Promise<unknown>;
    };
  },
  message: { queue: string; id: string; type: string; body: unknown; reason: string },
): Promise<boolean> {
  try {
    await env.KV.put(
      dlqParkKey(message.queue, message.id),
      JSON.stringify({
        queue: message.queue,
        id: message.id,
        type: message.type,
        reason: message.reason,
        body: message.body,
        parkedAt: new Date().toISOString(),
      }),
      { expirationTtl: DLQ_PARK_TTL_SECONDS },
    );
  } catch (error) {
    logError('queue dlq park failed', {
      queue: message.queue,
      id: message.id,
      type: message.type,
      error: String(error),
    });
    return false;
  }
  return true;
}

export function isStaleRefreshMinute(
  body: { type?: string } | null | undefined,
  timestamp: Date | undefined,
  now = Date.now(),
): boolean {
  if (body?.type !== 'refresh_minute') return false;
  return isStaleIngestTick(body, timestamp, now);
}

type DedupeBody = {
  type?: string;
  idempotencyKey?: string;
  step?: string;
  feedCursor?: number;
  leagueCursor?: number;
};

/**
 * Starter ticks of one type share a key, so a batch keeps a single run.
 * A follow-up step or a cursor slice keeps its own key.
 */
export function ingestDedupeKey(body: DedupeBody | null | undefined): string | null {
  if (!body?.type) return null;
  if (body.type === 'refresh_minute') {
    if (body.step) return `refresh_minute:${body.step}:${body.idempotencyKey ?? ''}`;
    return 'refresh_minute';
  }
  if (body.type === 'crawl_news' && body.feedCursor == null) return 'crawl_news';
  if (body.type === 'sync_leagues' && body.leagueCursor == null) return 'sync_leagues';
  if (body.type === 'refresh_live_probabilities') return 'refresh_live_probabilities';
  if (!body.idempotencyKey) return null;
  return `${body.type}:${body.idempotencyKey}`;
}

export function parseLastRunMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** True when no run is stored, or the stored start is at least `minGapMs` ago. */
export function refreshRunIsDue(
  lastRunMs: number | null,
  now: number,
  minGapMs = REFRESH_MIN_GAP_MS,
): boolean {
  if (lastRunMs == null) return true;
  return now - lastRunMs >= minGapMs;
}

/**
 * Remaining drain time from a live backlog and one observed batch.
 * `backlog` and `secondsPerBatch` come from the current metrics, not from a snapshot.
 */
export function estimateIngestDrainSeconds(
  backlog: number,
  secondsPerBatch: number,
  batchSize = INGEST_BATCH_SIZE,
): number {
  if (!Number.isFinite(backlog) || backlog <= 0) return 0;
  if (!Number.isFinite(secondsPerBatch) || secondsPerBatch <= 0) return 0;
  if (!Number.isFinite(batchSize) || batchSize <= 0) return 0;
  return Math.ceil(backlog / batchSize) * secondsPerBatch;
}
