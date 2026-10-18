import type { AppEnv } from '../env';
import { logError } from '../utils/logger';
import { IDEMPOTENT_INGEST_TYPES, isStaleRefreshMinute } from './ingestDrain';

type DlqBody = {
  type?: string;
  fromDlq?: boolean;
  idempotencyKey?: string;
} | null;

/**
 * Ingest DLQ drain. Counts are logged by type. Every refresh_minute tick is
 * acked and not replayed: a stale tick is superseded, and a fresh one is
 * already replaced by the next cron tick. Replaying either would start another
 * score sync. Other idempotent jobs are sent to the ingest queue once, with
 * fromDlq set, then acked. A message that already has fromDlq is dropped, so
 * a replay that fails cannot bounce forever. The DLQ consumer has no nested
 * dead-letter queue. Model DLQ messages are counted and acked, not sent back.
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
      isStaleRefreshMinute(body, msg.timestamp)
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
