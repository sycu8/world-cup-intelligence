import type { ModelJob } from './types';
import type { AppEnv } from '../env';
import { logInfo, logError, logWarn } from '../utils/logger';
import { resolveMatchRef } from '../services/matchRef';
import { isLegacyMatchId } from '../utils/matchSlug';
import { recomputeMatchProbability } from '../services/recomputeMatch';
import { runBulkRecomputeIfPending } from '../services/bulkRecomputeRunner';
import {
  generateMatchScenarios,
  updateScenariosFromRealtimeEvent,
  broadcastScenarioUpdate,
} from '../services/matchScenarioService';
import { runScenarioBacktest } from '../models/scenarios/backtesting/scenarioBacktestRunner';
import { briefingWithheldFromCache, generateTacticalBriefing } from '../ai/tacticalBriefing';
import { clearBriefingInflight, isBriefingWithheld, markBriefingWithheld } from '../ai/briefingQueue';
import { runMultiVariableAnalysis } from '../ai/multiVariableAnalysis';
import { extractEntitiesFromArticle } from '../ai/entityExtraction';
import { processNewsDocumentImpact } from '../services/newsMatchImpact';
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
        case 'PRE_MATCH_RECOMPUTE':
          await recomputeMatchProbability(env, msg.body.matchId);
          await generateMatchScenarios(env, msg.body.matchId);
          break;
        case 'LIVE_RECOMPUTE': {
          await recomputeMatchProbability(env, msg.body.matchId);
          const liveSet = await updateScenariosFromRealtimeEvent(env, {
            matchId: msg.body.matchId,
            eventId: msg.body.eventId ?? crypto.randomUUID(),
            eventType: 'live_recompute',
            minute: 0,
          });
          if (liveSet) await broadcastScenarioUpdate(env, msg.body.matchId, liveSet);
          break;
        }
        case 'SCENARIO_GENERATE': {
          await generateMatchScenarios(env, msg.body.matchId);
          break;
        }
        case 'SCENARIO_RECOMPUTE': {
          const set = await updateScenariosFromRealtimeEvent(env, {
            matchId: msg.body.matchId,
            eventId: msg.body.eventId ?? crypto.randomUUID(),
            eventType: 'scenario_recompute',
            minute: 0,
          });
          if (set) await broadcastScenarioUpdate(env, msg.body.matchId, set);
          break;
        }
        case 'SCENARIO_BACKTEST':
          await runScenarioBacktest(env, msg.body.tournamentYear);
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
          const requestedRef = msg.body.matchId;
          let matchId = requestedRef;
          if (!isLegacyMatchId(requestedRef)) {
            const resolved = await resolveMatchRef(env.DB, requestedRef, env.KV);
            if (!resolved) {
              logWarn('tactical briefing match ref unresolved', { matchId: requestedRef });
              await clearBriefingInflight(env, requestedRef);
              break;
            }
            matchId = resolved.id;
          }
          const snap = await probabilityRepo.getLatestSnapshot(env.DB, matchId);
          if (!snap) {
            logWarn('tactical briefing snapshot missing', { matchId });
            await clearBriefingInflight(env, requestedRef);
            if (matchId !== requestedRef) await clearBriefingInflight(env, matchId);
            break;
          }
          // The queued value is '1'. Only 'withheld' means this message must not call the model.
          if (
            (await isBriefingWithheld(env, matchId)) ||
            (matchId !== requestedRef && (await isBriefingWithheld(env, requestedRef)))
          ) {
            logWarn('tactical briefing skipped', { matchId });
            break;
          }
          const briefing = await generateTacticalBriefing(env, {
            matchId,
            probability: {
              homeWinProb: snap.home_win_prob,
              drawProb: snap.draw_prob,
              awayWinProb: snap.away_win_prob,
              expectedHomeGoals: snap.expected_home_goals,
              expectedAwayGoals: snap.expected_away_goals,
            },
            aiFallback: config.aiFallback,
          });
          if (briefingWithheldFromCache(briefing)) {
            logWarn('tactical briefing not cached', { matchId });
            await markBriefingWithheld(env, matchId);
            if (matchId !== requestedRef) await markBriefingWithheld(env, requestedRef);
            break;
          }
          await env.KV.put(`briefing:${matchId}`, JSON.stringify(briefing), { expirationTtl: 3600 });
          await clearBriefingInflight(env, matchId);
          if (matchId !== requestedRef) await clearBriefingInflight(env, requestedRef);
          logInfo('ai briefing cached', { match_id: matchId });
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
            await processNewsDocumentImpact(
              env,
              msg.body.documentId,
              msg.body.content,
              entities,
            );
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
