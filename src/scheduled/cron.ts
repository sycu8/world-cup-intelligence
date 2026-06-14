import type { AppEnv } from '../env';
import type { IngestJob } from '../queues/types';
import { logInfo } from '../utils/logger';
import { runBulkRecomputeIfPending } from '../services/bulkRecomputeRunner';
import { crawlWorldCupNews } from '../ingestion/newsCrawler';

export async function handleScheduledCron(
  env: AppEnv,
  cron: string,
  ctx?: ExecutionContext,
): Promise<void> {
  if (cron === '* * * * *' || cron === 'every-minute') {
    const job: IngestJob = { type: 'refresh_minute', idempotencyKey: crypto.randomUUID() };
    await env.INGEST_QUEUE?.send(job);
    logInfo('scheduled minute refresh enqueued');
    return;
  }

  if (cron === '*/15 * * * *' || cron === 'every-15-min') {
    if (env.INGEST_QUEUE) {
      const job: IngestJob = { type: 'crawl_news', idempotencyKey: crypto.randomUUID() };
      await env.INGEST_QUEUE.send(job);
      logInfo('scheduled news crawl enqueued');
      return;
    }

    const run = crawlWorldCupNews(env);
    if (ctx) ctx.waitUntil(run);
    else await run;
    logInfo('scheduled news crawl inline');
    return;
  }

  if (cron === '0 3 * * 1' || cron === 'weekly-statsbomb') {
    if (await runBulkRecomputeIfPending(env)) return;

    const job: IngestJob = {
      type: 'source_ingest',
      sourceId: 'src-statsbomb',
      idempotencyKey: crypto.randomUUID(),
    };
    await env.INGEST_QUEUE?.send(job);
    logInfo('scheduled statsbomb open-data pull enqueued');

    const refreshMc = import('../services/tournamentChampionOdds').then(({ refreshChampionOdds }) =>
      refreshChampionOdds(env),
    );
    if (ctx) ctx.waitUntil(refreshMc.catch((err) => console.error('[champion-odds] weekly refresh failed', err)));
    else await refreshMc;
    logInfo('scheduled champion odds refresh started');
  }
}
