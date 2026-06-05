import type { AppEnv } from '../env';
import type { IngestJob } from '../queues/types';
import { logInfo } from '../utils/logger';
import { runBulkRecomputeIfPending } from '../services/bulkRecomputeRunner';

export async function handleScheduledCron(env: AppEnv, cron: string): Promise<void> {
  if (await runBulkRecomputeIfPending(env)) return;

  if (cron === '* * * * *' || cron === 'every-minute') {
    const job: IngestJob = { type: 'refresh_minute', idempotencyKey: crypto.randomUUID() };
    await env.INGEST_QUEUE?.send(job);
    logInfo('scheduled minute refresh enqueued');
    return;
  }
  if (cron === '*/15 * * * *' || cron === 'every-15-min') {
    const job: IngestJob = { type: 'crawl_news', idempotencyKey: crypto.randomUUID() };
    await env.INGEST_QUEUE?.send(job);
    logInfo('scheduled news crawl enqueued');
    return;
  }
  if (cron === '0 3 * * 1' || cron === 'weekly-statsbomb') {
    const job: IngestJob = {
      type: 'source_ingest',
      sourceId: 'src-statsbomb',
      idempotencyKey: crypto.randomUUID(),
    };
    await env.INGEST_QUEUE?.send(job);
    logInfo('scheduled statsbomb open-data pull enqueued');
  }
}
