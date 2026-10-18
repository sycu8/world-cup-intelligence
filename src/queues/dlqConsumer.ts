import type { AppEnv } from '../env';
import { logError } from '../utils/logger';
import {
  dlqMessageAction,
  drainPauseMs,
  parkDlqMessage,
  takeDlqReplayDelaySeconds,
} from './ingestDrain';

type DlqBody = {
  type?: string;
  fromDlq?: boolean;
  idempotencyKey?: string;
} | null;

/**
 * Explicit DLQ consumer. A message is retried onto ingest, parked in KV for
 * replay, or acked only when it is a stale duplicate. See dlqMessageAction.
 * Parking happens before ack, because max_retries is 1 and there is no nested
 * dead-letter queue. An unacked message is discarded after that retry.
 */
export async function handleDlqBatch(
  batch: MessageBatch<unknown>,
  env: AppEnv,
  options?: { pause?: (ms: number) => Promise<void> },
): Promise<void> {
  const counts: Record<string, number> = {};
  let replayed = 0;
  let dropped = 0;
  let parked = 0;
  const queue = typeof batch.queue === 'string' ? batch.queue : 'unknown';
  const ingestDlq = queue.includes('ingest');

  async function park(msg: Message<unknown>, body: DlqBody, type: string, reason: string): Promise<void> {
    const stored = await parkDlqMessage(env, { queue, id: msg.id, type, body, reason });
    if (!stored) return;
    msg.ack();
    parked += 1;
  }

  for (const msg of batch.messages) {
    const body = (msg.body ?? null) as DlqBody;
    const type = body && typeof body.type === 'string' ? body.type : 'unknown';
    counts[type] = (counts[type] ?? 0) + 1;
    const action = dlqMessageAction(body, msg.timestamp, ingestDlq);

    if (action === 'drop_stale') {
      msg.ack();
      dropped += 1;
      continue;
    }

    if (action === 'replay' && env.INGEST_QUEUE) {
      try {
        const delaySeconds = await takeDlqReplayDelaySeconds(env);
        const payload = { ...body, fromDlq: true };
        if (delaySeconds > 0) await env.INGEST_QUEUE.send(payload, { delaySeconds });
        else await env.INGEST_QUEUE.send(payload);
        msg.ack();
        replayed += 1;
      } catch (error) {
        logError('queue dlq replay failed', { queue, id: msg.id, type, error: String(error) });
        await park(msg, body, type, 'replay_failed');
      }
      continue;
    }

    await park(msg, body, type, action === 'replay' ? 'replay_failed' : 'not_a_stale_duplicate');
  }

  logError('queue dlq batch', {
    queue,
    counts: JSON.stringify(counts),
    replayed,
    dropped,
    parked,
  });

  const waitMs = drainPauseMs(dropped + parked, replayed > 0);
  if (waitMs > 0) {
    logError('queue dlq drain paused', { dropped, parked, pauseMs: waitMs });
    await (options?.pause ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms))))(waitMs);
  }
}
