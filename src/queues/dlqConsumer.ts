import type { AppEnv } from '../env';
import { DLQ_PARKED_COUNT_KEY, INGEST_STALE_DROPS_KEY } from '../constants/pipeline';
import { addPipelineCounter } from '../services/pipelineCounters';
import { logError } from '../utils/logger';
import { queueRetryDelaySeconds } from './modelJobLane';
import {
  dlqMessageAction,
  drainPauseMs,
  loadReplayCursorMs,
  parkDlqMessage,
  replayDelayForCursor,
  saveReplayCursorMs,
} from './ingestDrain';

type DlqBody = {
  type?: string;
  fromDlq?: boolean;
  idempotencyKey?: string;
} | null;

/**
 * Explicit DLQ consumer. A message is retried onto ingest, parked in KV for
 * replay, or acked only when it is a stale duplicate. See dlqMessageAction.
 * A failed park calls retry() with a delay. An unacked message is acked by
 * the platform and the body is lost. max_retries is 1 and there is no nested
 * dead-letter queue.
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
  let cursor = await loadReplayCursorMs(env);

  async function park(msg: Message<unknown>, body: DlqBody, type: string, reason: string): Promise<void> {
    const stored = await parkDlqMessage(env, { queue, id: msg.id, type, body, reason });
    if (!stored) {
      logError('queue dlq park retry', { queue, id: msg.id, type, reason });
      msg.retry({ delaySeconds: queueRetryDelaySeconds(msg.attempts) });
      return;
    }
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
      const planned = replayDelayForCursor(cursor, Date.now());
      if (planned === 'park' || planned.delaySeconds >= 86_400) {
        await park(msg, body, type, 'replay_delay_capped');
        continue;
      }
      const target = type === 'sync_match_recap' ? env.RECAP_QUEUE : env.INGEST_QUEUE;
      if (!target) {
        await park(msg, body, type, 'replay_failed');
        continue;
      }
      try {
        const payload = { ...body, fromDlq: true };
        if (planned.delaySeconds > 0) await target.send(payload, { delaySeconds: planned.delaySeconds });
        else await target.send(payload);
      } catch (error) {
        logError('queue dlq replay failed', { queue, id: msg.id, type, error: String(error) });
        await park(msg, body, type, 'replay_failed');
        continue;
      }
      const saved = await saveReplayCursorMs(env, planned.nextCursorMs);
      if (saved) cursor = planned.nextCursorMs;
      msg.ack();
      replayed += 1;
      continue;
    }

    await park(msg, body, type, action === 'replay' ? 'replay_failed' : 'not_a_stale_duplicate');
  }

  if (parked > 0) await addPipelineCounter(env, DLQ_PARKED_COUNT_KEY, parked);
  if (dropped > 0) await addPipelineCounter(env, INGEST_STALE_DROPS_KEY, dropped);

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
