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
 * DLQ policy: `wc-ingest-dlq` and `wc-ingest-dlq-uat` have explicit consumers
 * (batch 10, max_retries 1, max_concurrency 1, no nested dead-letter queue).
 * A message that is not acked is discarded after that retry. Refresh ticks
 * are acked and not replayed. Other idempotent jobs are sent once with
 * `fromDlq` set, at most one every DRAIN_REPLAY_GAP_SECONDS; a second visit
 * is acked. Stale crawl, league, and live-probability ticks are acked and
 * not replayed. Model DLQ messages are counted and acked. Without a consumer,
 * Cloudflare keeps a DLQ message for four days and then deletes it — these
 * queues have consumers, so that retention is not the drain path.
 *
 * Reported after the #58 deploy, not measured in this repo: prod DLQ 3,072
 * and UAT DLQ 4,422. An ack-only batch of 10 then waits DRAIN_PAUSE_SECONDS,
 * so those depths are on the order of 2 hours (prod) and 3 hours (UAT) when
 * the messages are refresh ticks. A DLQ that is all idempotent replays is
 * one replay every 30s: about 26 hours prod and 37 hours UAT. Read the live
 * depth before expecting either number. Do not purge.
 */
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
export const DLQ_REPLAY_NOT_BEFORE_KEY = 'ingest:dlq_replay_not_before_ms';

export function drainPauseMs(ackOnly: number, ranWork: boolean, burst = DRAIN_ACK_BURST): number {
  if (ranWork || ackOnly < burst) return 0;
  return DRAIN_PAUSE_SECONDS * 1000;
}

/** Seconds until this replay may hit the main queue. Moves the cursor forward by one gap. */
export async function takeDlqReplayDelaySeconds(
  env: { KV: { get(key: string): Promise<string | null>; put(key: string, value: string, options?: { expirationTtl?: number }): Promise<unknown> } },
  now = Date.now(),
): Promise<number> {
  let notBefore = now;
  try {
    const stored = Number(await env.KV.get(DLQ_REPLAY_NOT_BEFORE_KEY));
    if (Number.isFinite(stored) && stored > now) notBefore = stored;
  } catch {
    notBefore = now;
  }
  try {
    await env.KV.put(DLQ_REPLAY_NOT_BEFORE_KEY, String(notBefore + DRAIN_REPLAY_GAP_SECONDS * 1000), {
      expirationTtl: 86_400,
    });
  } catch {
    // A missed cursor lets the next replay go sooner. The message is still sent.
  }
  return Math.max(0, Math.ceil((notBefore - now) / 1000));
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
