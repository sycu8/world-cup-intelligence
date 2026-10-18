import type { IngestJob } from './types';
import type { AppEnv } from '../env';
import { aiEnqueueBlocked, aiRunFlagsFromDelivery, isAiCapacityError, noteAiCapacity, withAiRun } from '../ai/aiCallGuard';
import { logInfo } from '../utils/logger';
import { refreshMatchData, handleCompletedMatches, runRefreshFollowUp } from '../ingestion/matchDataRefresh';
import { crawlWorldCupNews, type NewsCrawlChunk } from '../ingestion/newsCrawler';
import { ingestStatsbombWorldCup } from '../ingestion/statsbombIngest';
import { getIngestHandler } from '../ingestion/sourceRegistry';
import { recomputeMatchProbability } from '../services/recomputeMatch';
import { processMatchCompletion, replayKnockoutBracketFromCompleted } from '../services/tournamentProgression';
import {
  isBulkWalkLeaseActive,
  scheduleRecomputeAfterDataChange,
} from '../services/bulkRecomputeRunner';
import { runChampionOddsRefreshIfPending } from '../services/tournamentChampionOdds';
import { deliverWebhook } from '../services/publicApi/webhooks';
import { syncOfficialLineupsToMatches } from '../services/officialLineupSync';
import { INGEST_LAST_RUN_KEY, INGEST_STALE_DROPS_KEY, STATSBOMB_INGEST_DIRTY_KEY } from '../constants/pipeline';
import {
  CONSUMER_BATCH_DEADLINE_MS,
  INGEST_CHUNK_BUDGET_MS,
  REFRESH_MAX_HOLD_MS,
  deferQueuedMessage,
  ingestMessageTimeoutMs,
  queueRetryDelaySeconds,
  throwIfMessageAborted,
  withMessageTimeout,
} from './modelJobLane';
import {
  drainPauseMs,
  ingestDedupeKey,
  isStaleIngestTick,
  parseLastRunMs,
  REFRESH_STALE_MS,
  refreshRunIsDue,
} from './ingestDrain';

async function readLastRefreshRunMs(env: AppEnv): Promise<number | null> {
  try {
    return parseLastRunMs(await env.KV.get(INGEST_LAST_RUN_KEY));
  } catch (error) {
    logInfo('ingest refresh last-run read failed', { error: String(error) });
    return null;
  }
}

async function markRefreshStarted(env: AppEnv, now: number): Promise<void> {
  try {
    await env.KV.put(INGEST_LAST_RUN_KEY, String(now));
  } catch (error) {
    logInfo('ingest refresh last-run write failed', { error: String(error) });
  }
}

async function clearRefreshRun(env: AppEnv): Promise<void> {
  try {
    await env.KV.delete(INGEST_LAST_RUN_KEY);
  } catch (error) {
    logInfo('ingest refresh last-run clear failed', { error: String(error) });
  }
}

/** Best-effort. A concurrent batch can overwrite the count; one reread repairs a lost add. */
async function recordIngestStaleDrops(env: AppEnv, count: number): Promise<void> {
  try {
    const raw = await env.KV.get(INGEST_STALE_DROPS_KEY);
    const base = Number.parseInt(raw ?? '0', 10);
    const next = String((Number.isFinite(base) ? base : 0) + count);
    await env.KV.put(INGEST_STALE_DROPS_KEY, next);
    const seen = await env.KV.get(INGEST_STALE_DROPS_KEY);
    if (seen === next) return;
    const again = Number.parseInt(seen ?? '0', 10);
    const merged = String((Number.isFinite(again) ? again : 0) + count);
    if (merged !== seen) await env.KV.put(INGEST_STALE_DROPS_KEY, merged);
  } catch (error) {
    logInfo('ingest stale drop count failed', { error: String(error) });
  }
}

function statsbombDataChanged(result: {
  matchesInserted: number;
  teamsUpdated: number;
}): boolean {
  return result.matchesInserted > 0 || result.teamsUpdated > 0;
}

function pauseMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleIngestBatch(
  batch: MessageBatch<IngestJob>,
  env: AppEnv,
  options?: {
    deadlineMs?: number;
    messageTimeoutMs?: number;
    pause?: (ms: number) => Promise<void>;
  },
): Promise<void> {
  const deadlineMs = options?.deadlineMs ?? CONSUMER_BATCH_DEADLINE_MS;
  const batchStarted = Date.now();
  const seen = new Set<string>();
  let ackOnly = 0;
  let ranWork = false;
  for (const msg of batch.messages) {
    if (isStaleIngestTick(msg.body, msg.timestamp, Date.now())) {
      logInfo('ingest tick skipped stale', {
        type: msg.body.type,
        idempotencyKey: msg.body.idempotencyKey,
        staleAfterMs: REFRESH_STALE_MS,
      });
      await recordIngestStaleDrops(env, 1);
      msg.ack();
      ackOnly += 1;
      continue;
    }
    const dedupeKey = ingestDedupeKey(msg.body);
    if (dedupeKey && seen.has(dedupeKey)) {
      logInfo('ingest duplicate acked', { key: dedupeKey });
      msg.ack();
      ackOnly += 1;
      continue;
    }
    if (dedupeKey) seen.add(dedupeKey);

    const elapsed = Date.now() - batchStarted;
    if (elapsed >= deadlineMs) {
      logInfo('ingest batch deferred', { type: msg.body.type });
      await deferQueuedMessage(env.INGEST_QUEUE, msg);
      continue;
    }

    const starterRefresh = msg.body.type === 'refresh_minute' && !msg.body.step;
    if (starterRefresh && !refreshRunIsDue(await readLastRefreshRunMs(env), Date.now())) {
      logInfo('ingest refresh skipped recent', { idempotencyKey: msg.body.idempotencyKey });
      msg.ack();
      ackOnly += 1;
      continue;
    }
    if (starterRefresh) await markRefreshStarted(env, Date.now());
    ranWork = true;

    const timeoutMs = Math.max(
      1,
      Math.min(
        ingestMessageTimeoutMs(msg.body.type),
        options?.messageTimeoutMs ?? Number.POSITIVE_INFINITY,
        deadlineMs - elapsed,
      ),
    );
    let finished = false;
    try {
      await withAiRun(
        aiRunFlagsFromDelivery({
          attempts: msg.attempts,
          fromDlq: msg.body.fromDlq,
          runId: msg.body.idempotencyKey,
        }),
        () =>
          withMessageTimeout(timeoutMs, async (signal) => {
            await runIngestMessage(msg, env, signal);
            finished = true;
          }),
      );
      msg.ack();
    } catch (e) {
      if (finished) {
        msg.ack();
        continue;
      }
      if (isAiCapacityError(e)) {
        await noteAiCapacity(env, e);
        logInfo('ingest acked after ai capacity', { type: msg.body.type });
        msg.ack();
        continue;
      }
      const timedOut = e instanceof Error && e.message === 'model message timed out';
      const callerCapped =
        options?.messageTimeoutMs != null &&
        options.messageTimeoutMs < REFRESH_MAX_HOLD_MS &&
        timeoutMs <= options.messageTimeoutMs;
      const hitRefreshHold = msg.body.type === 'refresh_minute' && timeoutMs >= REFRESH_MAX_HOLD_MS;
      const hitBatchDeadline = timeoutMs >= CONSUMER_BATCH_DEADLINE_MS;
      if (timedOut && !callerCapped && (hitRefreshHold || hitBatchDeadline)) {
        logInfo('ingest refresh released at hold cap', { timeoutMs });
        if (starterRefresh) await clearRefreshRun(env);
        msg.ack();
        continue;
      }
      if (starterRefresh) await clearRefreshRun(env);
      const delaySeconds =
        msg.body.type === 'refresh_minute'
          ? Math.min(15, queueRetryDelaySeconds(msg.attempts))
          : queueRetryDelaySeconds(msg.attempts);
      logInfo('ingest retry', { error: String(e) });
      msg.retry({ delaySeconds });
    }
  }
  const waitMs = drainPauseMs(ackOnly, ranWork);
  if (waitMs > 0) {
    logInfo('ingest drain paused', { ackOnly, pauseMs: waitMs });
    await (options?.pause ?? pauseMs)(waitMs);
  }
}

async function runIngestMessage(msg: Message<IngestJob>, env: AppEnv, signal: AbortSignal): Promise<void> {
      throwIfMessageAborted(signal);
      switch (msg.body.type) {
        case 'refresh_minute': {
          if (msg.body.step) {
            const bracketUpdatedIds = await runRefreshFollowUp(env, msg.body.step, msg.body.completedIds ?? []);
            if (msg.body.step === 'bracket' && bracketUpdatedIds.length) {
              await scheduleRecomputeAfterDataChange(env, 'knockout-teams-bracket', { queue: true });
            }
            break;
          }

          const split = Boolean(env.INGEST_QUEUE);
          if (split && env.INGEST_QUEUE) {
            for (const step of ['lineups', 'bracket', 'warm'] as const) {
              await env.INGEST_QUEUE.send({
                type: 'refresh_minute',
                step,
                idempotencyKey: crypto.randomUUID(),
              });
            }
          }

          const { updatedIds, completedIds, teamUpdatedIds } = await refreshMatchData(env, {
            scoresOnly: split,
            signal,
          });

          if (completedIds.length) {
            if (split && env.INGEST_QUEUE) {
              await env.INGEST_QUEUE.send({
                type: 'refresh_minute',
                step: 'completed',
                completedIds,
                idempotencyKey: crypto.randomUUID(),
              });
            } else {
              await handleCompletedMatches(env, completedIds);
            }
          }

          let bracketUpdatedIds: string[] = [];
          if (!split) {
            bracketUpdatedIds = await replayKnockoutBracketFromCompleted(env);
          }
          if ((teamUpdatedIds.length || bracketUpdatedIds.length) && !aiEnqueueBlocked()) {
            await scheduleRecomputeAfterDataChange(env, 'knockout-teams-bracket', { queue: true });
          }

          if (await isBulkWalkLeaseActive(env)) break;

          if (await runChampionOddsRefreshIfPending(env)) break;

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

          if (recomputeIds.length && !aiEnqueueBlocked()) {
            if (env.MODEL_QUEUE) {
              await env.MODEL_QUEUE.send({ type: 'recompute_all', matchIds: recomputeIds });
            } else {
              for (const id of recomputeIds) await recomputeMatchProbability(env, id);
            }
          }
          break;
        }
        case 'match_complete': {
          await processMatchCompletion(env, msg.body.matchId);
          break;
        }
        case 'crawl_news': {
          await runNewsCrawl(env, msg.body.feedCursor, 'crawl_news', signal);
          break;
        }
        case 'sync_leagues': {
          const { syncAllClubLeagues } = await import('../ingestion/leagues/syncLeagues');
          let leagueCursor = msg.body.leagueCursor;
          for (;;) {
            throwIfMessageAborted(signal);
            const results = await syncAllClubLeagues(env, {
              leagueCursor,
              budgetMs: INGEST_CHUNK_BUDGET_MS,
            });
            if (results.done !== false) break;
            if (env.INGEST_QUEUE) {
              await env.INGEST_QUEUE.send({
                type: 'sync_leagues',
                idempotencyKey: crypto.randomUUID(),
                leagueCursor: results.leagueCursor,
              });
              break;
            }
            if (results.leagueCursor == null || results.leagueCursor === leagueCursor) break;
            leagueCursor = results.leagueCursor;
          }
          break;
        }
        case 'refresh_live_probabilities': {
          throwIfMessageAborted(signal);
          const { refreshLiveProbabilitiesFromStats } = await import('../services/liveProbabilityRefresh');
          await refreshLiveProbabilitiesFromStats(env);
          break;
        }
        case 'source_ingest': {
          const handler = getIngestHandler(msg.body.sourceId);
          if (handler === 'statsbomb') {
            await runStatsbombChunk(env, msg.body.seasonCursor, 'source_ingest', msg.body.sourceId);
          } else {
            logInfo('source ingest not configured', { sourceId: msg.body.sourceId });
          }
          break;
        }
        case 'bulk_ingest': {
          if ((msg.body.stage ?? 'statsbomb') === 'statsbomb') {
            const finished = await runStatsbombChunk(env, msg.body.seasonCursor, 'bulk_ingest');
            if (!finished) break;
            if (env.INGEST_QUEUE) {
              await env.INGEST_QUEUE.send({
                type: 'bulk_ingest',
                idempotencyKey: crypto.randomUUID(),
                stage: 'news',
              });
              break;
            }
          }
          await runNewsCrawl(env, msg.body.feedCursor, 'bulk_ingest', signal);
          break;
        }
        case 'webhook_deliver': {
          await deliverWebhook(env, msg.body.subscriptionId, msg.body.eventId);
          break;
        }
      }
}

function asNewsChunk(result: number | NewsCrawlChunk): NewsCrawlChunk {
  if (typeof result === 'number') return { inserted: result, done: true };
  return result;
}

async function runNewsCrawl(
  env: AppEnv,
  feedCursor: number | undefined,
  kind: 'crawl_news' | 'bulk_ingest',
  signal?: AbortSignal,
): Promise<void> {
  let cursor = feedCursor;
  for (;;) {
    throwIfMessageAborted(signal);
    const chunk = asNewsChunk(
      await crawlWorldCupNews(env, {
        feedCursor: cursor,
        budgetMs: INGEST_CHUNK_BUDGET_MS,
        chunk: true,
      }),
    );
    if (chunk.done !== false) break;
    if (env.INGEST_QUEUE) {
      if (kind === 'bulk_ingest') {
        await env.INGEST_QUEUE.send({
          type: 'bulk_ingest',
          idempotencyKey: crypto.randomUUID(),
          stage: 'news',
          feedCursor: chunk.feedCursor,
        });
      } else {
        await env.INGEST_QUEUE.send({
          type: 'crawl_news',
          idempotencyKey: crypto.randomUUID(),
          feedCursor: chunk.feedCursor,
        });
      }
      return;
    }
    if (chunk.feedCursor == null || chunk.feedCursor === cursor) break;
    cursor = chunk.feedCursor;
  }
  await syncOfficialLineupsToMatches(env, { recompute: true });
}

/** @returns true when this statsbomb walk has no further season to queue. */
async function runStatsbombChunk(
  env: AppEnv,
  seasonCursor: number | undefined,
  kind: 'source_ingest' | 'bulk_ingest',
  sourceId = 'statsbomb',
): Promise<boolean> {
  const result = await ingestStatsbombWorldCup(env, {
    seasonCursor,
    budgetMs: INGEST_CHUNK_BUDGET_MS,
  });
  if (statsbombDataChanged(result)) {
    await env.KV.put(STATSBOMB_INGEST_DIRTY_KEY, '1', { expirationTtl: 86400 });
  }
  if (result.done === false) {
    if (env.INGEST_QUEUE) {
      if (kind === 'bulk_ingest') {
        await env.INGEST_QUEUE.send({
          type: 'bulk_ingest',
          idempotencyKey: crypto.randomUUID(),
          stage: 'statsbomb',
          seasonCursor: result.seasonCursor,
        });
      } else {
        await env.INGEST_QUEUE.send({
          type: 'source_ingest',
          sourceId,
          idempotencyKey: crypto.randomUUID(),
          seasonCursor: result.seasonCursor,
        });
      }
      return false;
    }
    if (result.seasonCursor == null || result.seasonCursor === seasonCursor) return false;
    return runStatsbombChunk(env, result.seasonCursor, kind, sourceId);
  }
  if ((await env.KV.get(STATSBOMB_INGEST_DIRTY_KEY)) === '1' || statsbombDataChanged(result)) {
    await env.KV.delete(STATSBOMB_INGEST_DIRTY_KEY);
    await scheduleRecomputeAfterDataChange(
      env,
      kind === 'bulk_ingest' ? 'bulk-ingest' : 'statsbomb-ingest',
      { immediate: true },
    );
  }
  return true;
}
