import type { ModelJob } from './types';
import type { AppEnv } from '../env';
import { logInfo, logError } from '../utils/logger';
import { recomputeMatchProbability } from '../services/recomputeMatch';
import { runBulkRecomputeIfPending } from '../services/bulkRecomputeRunner';
import { generateTacticalBriefing } from '../ai/tacticalBriefing';
import { runMultiVariableAnalysis } from '../ai/multiVariableAnalysis';
import { extractEntitiesFromArticle } from '../ai/entityExtraction';
import { parseEnv } from '../env';
import * as probabilityRepo from '../db/repositories/probabilityRepo';

export async function handleModelBatch(batch: MessageBatch<ModelJob>, env: AppEnv): Promise<void> {
  const config = parseEnv(env);

  for (const msg of batch.messages) {
    try {
      switch (msg.body.type) {
        case 'recompute':
          await recomputeMatchProbability(env, msg.body.matchId);
          await env.MODEL_QUEUE?.send({ type: 'ai_briefing', matchId: msg.body.matchId });
          await env.MODEL_QUEUE?.send({ type: 'ai_multi_analyze', matchId: msg.body.matchId });
          break;
        case 'recompute_all':
          for (const matchId of msg.body.matchIds) {
            await recomputeMatchProbability(env, matchId);
            await env.MODEL_QUEUE?.send({ type: 'ai_briefing', matchId });
            await env.MODEL_QUEUE?.send({ type: 'ai_multi_analyze', matchId });
          }
          break;
        case 'recompute_wc2026_bulk':
          await runBulkRecomputeIfPending(env);
          break;
        case 'ai_multi_analyze':
          await runMultiVariableAnalysis(env, msg.body.matchId);
          break;
        case 'ai_briefing': {
          const snap = await probabilityRepo.getLatestSnapshot(env.DB, msg.body.matchId);
          if (!snap) break;
          const briefing = await generateTacticalBriefing(env, {
            matchId: msg.body.matchId,
            probability: {
              homeWinProb: snap.home_win_prob,
              drawProb: snap.draw_prob,
              awayWinProb: snap.away_win_prob,
              expectedHomeGoals: snap.expected_home_goals,
              expectedAwayGoals: snap.expected_away_goals,
            },
            aiFallback: config.aiFallback,
          });
          await env.KV.put(
            `briefing:${msg.body.matchId}`,
            JSON.stringify(briefing),
            { expirationTtl: 3600 },
          );
          logInfo('ai briefing cached', { match_id: msg.body.matchId });
          break;
        }
        case 'ai_extract_news': {
          if (msg.body.content) {
            const entities = await extractEntitiesFromArticle(env, msg.body.content);
            if (entities) {
              await env.DB.prepare(
                'UPDATE source_documents SET extracted_entities_json = ? WHERE id = ?',
              )
                .bind(JSON.stringify(entities), msg.body.documentId)
                .run();
            }
          }
          break;
        }
      }
      msg.ack();
    } catch (e) {
      logError('model job failed', { error: String(e) });
      msg.retry();
    }
  }
}
