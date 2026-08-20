import type { AppEnv } from '../env';
import type { IngestJob } from '../queues/types';
import { logInfo } from '../utils/logger';
import { runBulkRecomputeIfPending } from '../services/bulkRecomputeRunner';
import { crawlWorldCupNews } from '../ingestion/newsCrawler';
import { runProbabilitySnapshotRetention } from '../services/probabilitySnapshotRetention';

export async function handleScheduledCron(
  env: AppEnv,
  cron: string,
  ctx?: ExecutionContext,
): Promise<void> {
  if (cron === '* * * * *' || cron === 'every-minute') {
    const job: IngestJob = { type: 'refresh_minute', idempotencyKey: crypto.randomUUID() };
    await env.INGEST_QUEUE?.send(job);
    const warm = import('../services/cacheWarm').then(({ warmPayloadCaches }) => warmPayloadCaches(env));
    if (ctx) ctx.waitUntil(warm.catch(() => undefined));
    else await warm.catch(() => undefined);
    logInfo('scheduled minute refresh enqueued');
    return;
  }

  if (cron === '*/15 * * * *' || cron === 'every-15-min') {
    if (env.INGEST_QUEUE) {
      await env.INGEST_QUEUE.send({
        type: 'refresh_live_probabilities',
        idempotencyKey: crypto.randomUUID(),
      });
      await env.INGEST_QUEUE.send({ type: 'crawl_news', idempotencyKey: crypto.randomUUID() });
      await env.INGEST_QUEUE.send({ type: 'sync_leagues', idempotencyKey: crypto.randomUUID() });
      logInfo('scheduled live prob refresh + news crawl + league sync enqueued');
      return;
    }

    const { refreshLiveProbabilitiesFromStats } = await import('../services/liveProbabilityRefresh');
    const { syncAllClubLeagues } = await import('../ingestion/leagues/syncLeagues');
    const liveProb = refreshLiveProbabilitiesFromStats(env);
    const news = crawlWorldCupNews(env);
    const leagues = syncAllClubLeagues(env);
    if (ctx) {
      ctx.waitUntil(Promise.all([liveProb, news, leagues]).catch(() => undefined));
    } else {
      await liveProb;
      await news;
      await leagues;
    }
    logInfo('scheduled live prob refresh + news crawl + league sync inline');
    return;
  }

  if (cron === '0 3 * * 1' || cron === 'weekly-statsbomb') {
    const retention = runProbabilitySnapshotRetention(env).catch((err) =>
      console.error('[probability-retention] weekly prune failed', err),
    );
    if (ctx) ctx.waitUntil(retention);
    else await retention;

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
