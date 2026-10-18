import type { AppEnv } from '../env';
import { logError } from '../utils/logger';
import { IDEMPOTENT_INGEST_TYPES, isStaleIngestTick } from './ingestDrain';

type DlqBody = {
  type?: string;
  fromDlq?: boolean;
  idempotencyKey?: string;
} | null;

/**
 * Explicit DLQ consumer. wrangler attaches this handler to wc-ingest-dlq and
 * wc-ingest-dlq-uat (batch 10, max_retries 1, max_concurrency 1, no nested
 * dead-letter queue). A message that is not acked is discarded after that
 * retry; it is not written to another queue. Counts are logged by type.
 *
 * Every refresh_minute tick is acked and not replayed. Cron replaces it, and
 * a replay would start another score sync. Stale crawl, league, and
 * live-probability ticks are acked and not replayed. Other idempotent jobs
 * are sent once with fromDlq set, then acked. A body that already has fromDlq
 * is dropped, so a failed replay cannot bounce. Model DLQ messages are
 * counted and acked, not sent to ingest. A stalled bulk walk is re-sent by
 * the cron resumer from the walk record.
 */
export async function handleDlqBatch(batch: MessageBatch<unknown>, env: AppEnv): Promise<void> {
  const counts: Record<string, number> = {};
  let replayed = 0;
  let dropped = 0;
  const ingestDlq = typeof batch.queue === 'string' && batch.queue.includes('ingest');

  for (const msg of batch.messages) {
    const body = (msg.body ?? null) as DlqBody;
    const type = body && typeof body.type === 'string' ? body.type : 'unknown';
    counts[type] = (counts[type] ?? 0) + 1;

    if (
      !ingestDlq ||
      !body ||
      body.fromDlq ||
      type === 'refresh_minute' ||
      isStaleIngestTick(body, msg.timestamp)
    ) {
      msg.ack();
      dropped += 1;
      continue;
    }

    if (IDEMPOTENT_INGEST_TYPES.has(type) && env.INGEST_QUEUE) {
      try {
        await env.INGEST_QUEUE.send({ ...body, fromDlq: true });
        msg.ack();
        replayed += 1;
      } catch (error) {
        logError('queue dlq replay failed', { queue: batch.queue, id: msg.id, type, error: String(error) });
      }
      continue;
    }

    msg.ack();
    dropped += 1;
  }

  logError('queue dlq batch', {
    queue: batch.queue,
    counts: JSON.stringify(counts),
    replayed,
    dropped,
  });
}
