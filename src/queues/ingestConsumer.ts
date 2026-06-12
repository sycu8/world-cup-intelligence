import type { IngestJob } from './types';
import type { AppEnv } from '../env';
import { logInfo } from '../utils/logger';
import { refreshMatchData, handleCompletedMatches } from '../ingestion/matchDataRefresh';
import { crawlWorldCupNews } from '../ingestion/newsCrawler';
import { ingestStatsbombWorldCup } from '../ingestion/statsbombIngest';
import { getIngestHandler } from '../ingestion/sourceRegistry';
import { recomputeMatchProbability } from '../services/recomputeMatch';
import { processMatchCompletion } from '../services/tournamentProgression';
import {
  runBulkRecomputeIfPending,
  scheduleRecomputeAfterDataChange,
} from '../services/bulkRecomputeRunner';
import { syncOfficialLineupsToMatches } from '../services/officialLineupSync';

function statsbombDataChanged(result: {
  matchesInserted: number;
  teamsUpdated: number;
}): boolean {
  return result.matchesInserted > 0 || result.teamsUpdated > 0;
}

export async function handleIngestBatch(
  batch: MessageBatch<IngestJob>,
  env: AppEnv,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      switch (msg.body.type) {
        case 'refresh_minute': {
          const { updatedIds, completedIds } = await refreshMatchData(env);

          if (completedIds.length) {
            await handleCompletedMatches(env, completedIds);
          }

          if (await runBulkRecomputeIfPending(env)) break;

          const recomputeIds =
            updatedIds.length > 0
              ? updatedIds
              : completedIds.length > 0
                ? []
                : (
                    await env.DB.prepare(
                      `SELECT id FROM matches
                       WHERE tournament_id = 't-2026' AND status IN ('scheduled', 'live')
                       ORDER BY kickoff_utc ASC LIMIT 8`,
                    ).all<{ id: string }>()
                  ).results?.map((r) => r.id) ?? [];

          if (recomputeIds.length && env.MODEL_QUEUE) {
            await env.MODEL_QUEUE.send({ type: 'recompute_all', matchIds: recomputeIds });
          } else if (recomputeIds.length) {
            for (const id of recomputeIds) await recomputeMatchProbability(env, id);
          }
          break;
        }
        case 'match_complete': {
          await processMatchCompletion(env, msg.body.matchId);
          await runBulkRecomputeIfPending(env);
          break;
        }
        case 'crawl_news': {
          await crawlWorldCupNews(env);
          await syncOfficialLineupsToMatches(env, { recompute: true });
          break;
        }
        case 'source_ingest': {
          const handler = getIngestHandler(msg.body.sourceId);
          if (handler === 'statsbomb') {
            const result = await ingestStatsbombWorldCup(env);
            if (statsbombDataChanged(result)) {
              await scheduleRecomputeAfterDataChange(env, 'statsbomb-ingest', { immediate: true });
            }
          } else {
            logInfo('source ingest not configured', { sourceId: msg.body.sourceId });
          }
          break;
        }
        case 'bulk_ingest': {
          const result = await ingestStatsbombWorldCup(env);
          await crawlWorldCupNews(env);
          if (statsbombDataChanged(result)) {
            await scheduleRecomputeAfterDataChange(env, 'bulk-ingest', { immediate: true });
          }
          break;
        }
      }
      msg.ack();
    } catch (e) {
      logInfo('ingest retry', { error: String(e) });
      msg.retry();
    }
  }
}
