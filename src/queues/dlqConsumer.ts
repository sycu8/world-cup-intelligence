import type { AppEnv } from '../env';
import { logError } from '../utils/logger';

/**
 * Dead-letter messages are already past max_retries. Log them and ack so the
 * DLQ itself does not retry forever. A stalled bulk walk is re-sent by the cron
 * resumer from the walk record, not from this batch.
 */
export async function handleDlqBatch(batch: MessageBatch<unknown>, _env: AppEnv): Promise<void> {
  for (const msg of batch.messages) {
    const body = msg.body as { type?: string } | null;
    logError('queue dlq message', {
      queue: batch.queue,
      id: msg.id,
      attempts: msg.attempts,
      type: body && typeof body.type === 'string' ? body.type : 'unknown',
    });
    msg.ack();
  }
}
