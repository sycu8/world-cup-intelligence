/**
 * Prod on 2026-10-18: wc-ingest-queue held about 7,480 messages and wc-ingest-dlq
 * about 310. UAT was acking. Prod was reading and not acking, because every
 * refresh_minute died at the old 60s cap.
 *
 * N = 10 minutes. A minute tick older than that is superseded by a later cron
 * tick, so it is acked and not run. One batch is 10 messages and the ingest
 * consumer runs one batch at a time. 7,480 / 10 = 748 batches. At 1–2s per
 * ack-only batch that stale backlog is about 15–25 minutes, plus at most one
 * fresh refresh (up to 4 minutes). The 310 DLQ messages are about 31 batches,
 * about a minute. Refresh ticks in that DLQ are acked and not replayed. Any
 * other replay is sent once with fromDlq set, and a second visit is dropped.
 * The DLQ consumer has no nested dead-letter queue, so a failed replay is
 * discarded after its retry instead of returning to the main queue forever.
 */
export const REFRESH_STALE_MS = 10 * 60_000;

/**
 * Cross-batch refresh claim. KV expiration is best-effort, so age is checked in code.
 *
 * Prod on 2026-10-18: wc-ingest-queue was empty by 02:41 ICT and lastDataRefresh
 * stayed at 02:36:47 until 02:49:43. This claim only blocks for 60s, a stale
 * skip only drops a tick older than 10 minutes, and in-batch dedupe lasts one
 * batch, so none of those hold a stamp for the 8.5 minutes after the drain.
 * An empty backlog still leaves the one in-flight refresh that already wrote
 * meta:last_fifa_sync and has not yet written meta:last_data_refresh.
 *
 * There is no 5-minute refresh trigger on production. The schedules are
 * every minute, every 15 minutes, and the weekly pull. From 02:41 to 02:49 ICT
 * the minute cron still fired every minute (success, a few milliseconds of
 * CPU) and the 15-minute cron fired at 02:45. Both only enqueue. Neither
 * writes meta:last_data_refresh. The 300s step in QUEUE_RETRY_DELAYS_SECONDS
 * starts only after msg.retry(). That in-flight refresh had not failed, so
 * the 5-minute retry never started and could not recover the stamp. A new
 * tick also cannot stamp until the single ingest consumer returns.
 */
export const REFRESH_CLAIM_KEY = 'ingest:dedupe:refresh_minute';
export const REFRESH_CLAIM_MAX_AGE_MS = 60_000;

/**
 * A stored claim blocks a new refresh only while it is younger than the max age.
 * Empty, missing, and non-numeric values do not block, so a key KV never deletes
 * cannot stop refresh permanently.
 */
export function refreshClaimBlocks(stored: string | null, now = Date.now()): boolean {
  if (!stored) return false;
  const takenAt = Number(stored);
  if (!Number.isFinite(takenAt)) return false;
  return now - takenAt < REFRESH_CLAIM_MAX_AGE_MS;
}

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

export function isStaleRefreshMinute(
  body: { type?: string } | null | undefined,
  timestamp: Date | undefined,
  now = Date.now(),
): boolean {
  if (body?.type !== 'refresh_minute') return false;
  const age = messageAgeMs(timestamp, now);
  return age != null && age > REFRESH_STALE_MS;
}

/**
 * refresh_minute ticks share one logical key, so a batch keeps a single run.
 * Every other job is deduped by its idempotency key.
 */
export function ingestDedupeKey(body: { type?: string; idempotencyKey?: string } | null | undefined): string | null {
  if (!body?.type) return null;
  if (body.type === 'refresh_minute') return 'refresh_minute';
  if (!body.idempotencyKey) return null;
  return `${body.type}:${body.idempotencyKey}`;
}
