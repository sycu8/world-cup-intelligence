import type { AppEnv } from '../env';
import { syncQueuedMatchRecap } from '../services/matchRecap';
import { logError } from '../utils/logger';
import { queueRetryDelaySeconds, withMessageTimeout } from './modelJobLane';

/** Recap syncs measured 34–48s. This queue is not the ingest consumer, so a refresh is not behind it. */
export const RECAP_SYNC_TIMEOUT_MS = 120_000;

type RecapBody = { type?: string; matchRef?: string };

/**
 * One recap sync at a time, on its own queue. The ingest consumer never runs
 * this work, so refresh_minute is not delayed by it.
 */
export async function handleRecapBatch(batch: MessageBatch<unknown>, env: AppEnv): Promise<void> {
  for (const msg of batch.messages) {
    const body = (msg.body ?? null) as RecapBody | null;
    if (!body || body.type !== 'sync_match_recap' || !body.matchRef) {
      msg.ack();
      continue;
    }
    try {
      await withMessageTimeout(RECAP_SYNC_TIMEOUT_MS, () => syncQueuedMatchRecap(env, body.matchRef!));
      msg.ack();
    } catch (error) {
      logError('recap sync job failed', { matchRef: body.matchRef, error: String(error) });
      msg.retry({ delaySeconds: queueRetryDelaySeconds(msg.attempts) });
    }
  }
}
