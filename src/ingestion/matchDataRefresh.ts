import type { AppEnv } from '../env';
import { parseEnv } from '../env';
import { nowIso } from '../utils/time';
import { logError, logInfo } from '../utils/logger';
import { mockScoreAtMinute } from '../services/matchLifecycle';
import { processMatchCompletion, replayKnockoutBracketFromCompleted } from '../services/tournamentProgression';
import { resolveMatchDataProvider } from './matchDataProvider';
import { throwIfMessageAborted } from '../queues/modelJobLane';
import { syncFifaWc2026Matches } from './fifa/fifaLiveSync';
import { syncFifaLineupsForUpcomingMatches } from './fifa/fifaLineupSync';
import { backfillIncompleteFifaMatchStats, backfillMissingFifaRecaps } from './fifa/fifaLiveBlogSync';

export type RefreshMatchDataResult = {
  updatedIds: string[];
  completedIds: string[];
  teamUpdatedIds: string[];
  bracketUpdatedIds: string[];
};

export type RefreshMatchDataOptions = {
  /**
   * Score sync only. Lineups, finished matches, bracket replay, and cache warm
   * are separate queue messages so a slow FIFA sync cannot skip them.
   */
  scoresOnly?: boolean;
  /** Cancels the FIFA fetch when the queue message hits its budget. */
  signal?: AbortSignal;
};

export type RefreshFollowUpStep = 'lineups' | 'bracket' | 'warm' | 'completed';

function fifaLiveEnabled(env: AppEnv): boolean {
  const cfg = parseEnv(env);
  return cfg.fifaLiveEnabled || !cfg.mockSources;
}

export async function stampLastDataRefresh(env: AppEnv): Promise<void> {
  await env.KV.put('meta:last_data_refresh', nowIso(), { expirationTtl: 86400 });
}

/** Near-real-time refresh: FIFA Match Centre sync or mock ticks, then progression + recompute. */
export async function refreshMatchData(
  env: AppEnv,
  options: RefreshMatchDataOptions = {},
): Promise<RefreshMatchDataResult> {
  throwIfMessageAborted(options.signal);
  if (fifaLiveEnabled(env)) {
    const fifa = await syncFifaWc2026Matches(env, { signal: options.signal });
    // Stamp only after at least one FIFA write. From 02:36:47 to 02:49:43 ICT,
    // lastFifaSync changed 8 times while lastDataRefresh stayed at 02:36:47,
    // so several refreshes ended before this stamp. Backfill stays after it.
    if (fifa.synced > 0) await stampLastDataRefresh(env);
    await backfillIncompleteFifaMatchStats(env, 4).catch((e) => {
      logError('fifa stats backfill batch failed', { error: String(e) });
    });
    await backfillMissingFifaRecaps(env, 4).catch((e) => {
      logError('fifa recap backfill batch failed', { error: String(e) });
    });
    if (!options.scoresOnly) {
      await syncFifaLineupsForUpcomingMatches(env).catch(() => undefined);
      const { warmPayloadCaches } = await import('../services/cacheWarm');
      await warmPayloadCaches(env).catch(() => undefined);
    }
    return {
      updatedIds: fifa.updatedIds,
      completedIds: fifa.completedIds,
      teamUpdatedIds: fifa.teamUpdatedIds,
      bracketUpdatedIds: [],
    };
  }

  const updatedIds: string[] = [];
  const completedIds: string[] = [];
  const now = nowIso();
  const nowMs = Date.now();
  const provider = resolveMatchDataProvider(parseEnv(env).mockSources, mockScoreAtMinute);

  const { results: candidates } = await env.DB.prepare(
    `SELECT id, minute, home_score, away_score, status, kickoff_utc
     FROM matches
     WHERE tournament_id = 't-2026' AND status IN ('scheduled', 'live')
     ORDER BY kickoff_utc ASC`,
  ).all<{
    id: string;
    minute: number;
    home_score: number;
    away_score: number;
    status: string;
    kickoff_utc: string;
  }>();

  for (const m of candidates ?? []) {
    if (!m.kickoff_utc) continue;
    const tick = provider.getLiveTick(m.id, m.kickoff_utc, nowMs);
    if (!tick) continue;

    if (tick.status === 'completed') {
      await env.DB.prepare(
        `UPDATE matches
         SET status = 'completed', minute = 90,
             home_score = ?, away_score = ?,
             updated_at = ?
         WHERE id = ? AND status != 'completed'`,
      )
        .bind(tick.homeScore, tick.awayScore, now, m.id)
        .run();
      completedIds.push(m.id);
      logInfo('match finalized', { match_id: m.id, score: `${tick.homeScore}-${tick.awayScore}`, provider: provider.name });
      continue;
    }

    if (
      m.status === 'scheduled' ||
      m.minute !== tick.minute ||
      m.home_score !== tick.homeScore ||
      m.away_score !== tick.awayScore
    ) {
      await env.DB.prepare(
        `UPDATE matches
         SET status = 'live', minute = ?,
             home_score = ?, away_score = ?,
             home_xg = home_xg + 0.02, away_xg = away_xg + 0.01,
             updated_at = ?
         WHERE id = ?`,
      )
        .bind(tick.minute, tick.homeScore, tick.awayScore, now, m.id)
        .run();
      updatedIds.push(m.id);
    }
  }

  await stampLastDataRefresh(env);
  if (!options.scoresOnly) {
    const { warmPayloadCaches } = await import('../services/cacheWarm');
    await warmPayloadCaches(env).catch(() => undefined);
  }
  logInfo('minute refresh complete', {
    updated: updatedIds.length,
    completed: completedIds.length,
  });

  const bracketUpdatedIds =
    !options.scoresOnly && completedIds.length ? await replayKnockoutBracketFromCompleted(env) : [];

  return {
    updatedIds,
    completedIds,
    teamUpdatedIds: [],
    bracketUpdatedIds,
  };
}

/** Finalize scores + advance bracket for matches that just ended. */
export async function handleCompletedMatches(env: AppEnv, matchIds: string[]): Promise<void> {
  for (const matchId of matchIds) {
    await processMatchCompletion(env, matchId);
  }
}

/** One follow-up step. Stamps lastDataRefresh when the step finishes. */
export async function runRefreshFollowUp(
  env: AppEnv,
  step: RefreshFollowUpStep,
  completedIds: string[] = [],
): Promise<string[]> {
  if (step === 'lineups') {
    if (fifaLiveEnabled(env)) {
      await syncFifaLineupsForUpcomingMatches(env).catch(() => undefined);
    }
    await stampLastDataRefresh(env);
    return [];
  }
  if (step === 'warm') {
    const { warmPayloadCaches } = await import('../services/cacheWarm');
    await warmPayloadCaches(env).catch(() => undefined);
    await stampLastDataRefresh(env);
    return [];
  }
  if (step === 'completed') {
    await handleCompletedMatches(env, completedIds);
    await stampLastDataRefresh(env);
    return [];
  }
  const bracketUpdatedIds = await replayKnockoutBracketFromCompleted(env);
  await stampLastDataRefresh(env);
  return bracketUpdatedIds;
}
