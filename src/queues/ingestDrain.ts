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
 * `fromDlq` set; a second visit is acked. Stale crawl, league, and
 * live-probability ticks are acked and not replayed. Model DLQ messages are
 * counted and acked. Without a consumer, Cloudflare keeps a DLQ message for
 * four days and then deletes it — these queues have consumers, so that
 * retention is not the drain path.
 */
export const REFRESH_STALE_MS = 10 * 60_000;

/**
 * Minute cron is about 60s. A gap under that lets the next tick run.
 * The old 60s KV TTL could still be present a minute later and skip that tick,
 * leaving a gap of about two minutes.
 */
export const REFRESH_MIN_GAP_MS = 50_000;

export const INGEST_BATCH_SIZE = 10;

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
