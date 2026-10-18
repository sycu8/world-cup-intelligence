import type { ModelJob } from './types';
import type { AppEnv } from '../env';
import { aiEnqueueBlocked, aiRunFlagsFromDelivery, isAiCapacityError, noteAiCapacity, withAiRun } from '../ai/aiCallGuard';
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
import {
  clearBriefingInflight,
  isBriefingWithheld,
  markBriefingWithheld,
  requestBriefingGeneration,
} from '../ai/briefingQueue';
import { MODEL_QUEUE_STALE_DROPS_KEY } from '../constants/pipeline';
import { runMultiVariableAnalysis } from '../ai/multiVariableAnalysis';
import { extractEntitiesFromArticle } from '../ai/entityExtraction';
import { processNewsDocumentImpact } from '../services/newsMatchImpact';
import { parseEnv } from '../env';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import {
  CONSUMER_BATCH_DEADLINE_MS,
  STALE_DROP_COUNT_TIMEOUT_MS,
  deferQueuedMessage,
  modelJobPriority,
  modelMessageDisposition,
  modelMessageTimeoutMs,
  queueRetryDelaySeconds,
  withMessageTimeout,
} from './modelJobLane';

export async function handleModelBatch(
  batch: MessageBatch<ModelJob>,
  env: AppEnv,
  options?: { deadlineMs?: number; messageTimeoutMs?: number },
): Promise<void> {
  const config = parseEnv(env);
  const now = Date.now();
  const dropped: Message<ModelJob>[] = [];
  const runnable: Message<ModelJob>[] = [];
  for (const msg of batch.messages) {
    if (modelMessageDisposition(msg.body, msg.timestamp, now) === 'drop') dropped.push(msg);
    else runnable.push(msg);
  }
  for (const msg of dropped) msg.ack();
  if (dropped.length > 0) {
    logInfo('model queue dropped stale', {
      dropped: dropped.length,
      types: dropped
        .map((msg) => (msg.body && typeof msg.body.type === 'string' ? msg.body.type : 'unknown'))
        .join(','),
    });
    try {
      await withMessageTimeout(STALE_DROP_COUNT_TIMEOUT_MS, () =>
        recordStaleDrops(env, dropped.length),
      );
    } catch (error) {
      logError('model queue drop count failed', { error: String(error) });
    }
  }
  runnable.sort((a, b) => modelJobPriority(a.body.type) - modelJobPriority(b.body.type));

  const deadlineMs = options?.deadlineMs ?? CONSUMER_BATCH_DEADLINE_MS;
  const batchStarted = Date.now();
  for (const msg of runnable) {
    const elapsed = Date.now() - batchStarted;
    if (elapsed >= deadlineMs) {
      logInfo('model batch deferred', { type: msg.body.type });
      await deferQueuedMessage(env.MODEL_QUEUE, msg);
      continue;
    }
    const timeoutMs = Math.max(
      1,
      Math.min(modelMessageTimeoutMs(msg.body.type), options?.messageTimeoutMs ?? Number.POSITIVE_INFINITY, deadlineMs - elapsed),
    );
    try {
      await withAiRun(
        aiRunFlagsFromDelivery({
          attempts: msg.attempts,
          fromDlq: 'fromDlq' in msg.body && Boolean((msg.body as { fromDlq?: boolean }).fromDlq),
          runId: msg.id,
        }),
        () => withMessageTimeout(timeoutMs, (signal) => runModelMessage(msg, env, config, signal)),
      );
      msg.ack();
    } catch (e) {
      if (isAiCapacityError(e)) {
        await noteAiCapacity(env, e);
        logInfo('model job acked after ai capacity', { type: msg.body.type });
        msg.ack();
        continue;
      }
      logError('model job failed', { error: String(e), type: msg.body.type });
      msg.retry({ delaySeconds: queueRetryDelaySeconds(msg.attempts) });
    }
  }
}

/** Best-effort. A concurrent batch can overwrite the count; one reread repairs a lost add. */
async function recordStaleDrops(env: AppEnv, count: number): Promise<void> {
  const raw = await env.KV.get(MODEL_QUEUE_STALE_DROPS_KEY);
  const base = Number.parseInt(raw ?? '0', 10);
  const next = String((Number.isFinite(base) ? base : 0) + count);
  await env.KV.put(MODEL_QUEUE_STALE_DROPS_KEY, next);
  const seen = await env.KV.get(MODEL_QUEUE_STALE_DROPS_KEY);
  if (seen === next) return;
  const again = Number.parseInt(seen ?? '0', 10);
  const merged = String((Number.isFinite(again) ? again : 0) + count);
  if (merged !== seen) await env.KV.put(MODEL_QUEUE_STALE_DROPS_KEY, merged);
}

async function runModelMessage(
  msg: Message<ModelJob>,
  env: AppEnv,
  config: ReturnType<typeof parseEnv>,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) throw new Error('model message timed out');
      switch (msg.body.type) {
        case 'recompute':
          await recomputeMatchProbability(env, msg.body.matchId);
          if (!aiEnqueueBlocked()) {
            await requestBriefingGeneration(env, msg.body.matchId);
            await env.MODEL_QUEUE?.send({ type: 'ai_multi_analyze', matchId: msg.body.matchId });
          }
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
            if (signal.aborted) throw new Error('model message timed out');
            await recomputeMatchProbability(env, matchId);
            if (aiEnqueueBlocked()) continue;
            await requestBriefingGeneration(env, matchId);
            await env.MODEL_QUEUE?.send({ type: 'ai_multi_analyze', matchId });
          }
          break;
        case 'recompute_wc2026_bulk':
          await runBulkRecomputeIfPending(env, {
            cursor: msg.body.cursor,
            phase: msg.body.phase,
            walkId: msg.body.walkId,
            reason: msg.body.reason,
          });
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
          const briefing = await generateTacticalBriefing(
            env,
            {
              matchId,
              probability: {
                homeWinProb: snap.home_win_prob,
                drawProb: snap.draw_prob,
                awayWinProb: snap.away_win_prob,
                expectedHomeGoals: snap.expected_home_goals,
                expectedAwayGoals: snap.expected_away_goals,
              },
              aiFallback: config.aiFallback,
            },
            { signal },
          );
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
          const content = msg.body.content;
          if (content) {
            const entities = await extractEntitiesFromArticle(env, content);
            if (entities) {
              await env.DB.prepare(
                'UPDATE source_documents SET extracted_entities_json = ? WHERE id = ?',
              )
                .bind(JSON.stringify(entities), msg.body.documentId)
                .run();
            }
            await processNewsDocumentImpact(env, msg.body.documentId, content, entities);
          }
          break;
        }
      }
}
