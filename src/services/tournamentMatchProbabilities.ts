import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import * as matchesRepo from '../db/repositories/matchesRepo';
import * as teamsRepo from '../db/repositories/teamsRepo';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import { computeFullMatchProbability } from '../models/probability/fullMatchOutput';
import type { ProbabilityResult } from '../models/probability/types';
import { buildMatchFeaturesWithForm } from './matchFeatures';
import { recomputeMatchProbability } from './recomputeMatch';
import { logInfo } from '../utils/logger';

export type MatchProbabilityTriple = { homeWin: number; draw: number; awayWin: number };

export type TournamentMatchProbabilitiesPayload = {
  data: Record<string, MatchProbabilityTriple>;
  meta: { total: number; withProbability: number; pending: number; missingIds: string[] };
};

const SYNC_FILL_BUDGET_MS = 3_000;
const GAP_FILL_KV_KEY = 'tournament-prob-gap-fill';

function fullOutputToResult(
  full: Awaited<ReturnType<typeof computeFullMatchProbability>>,
  minute: number,
): ProbabilityResult {
  return {
    matchId: full.matchId,
    timestamp: full.timestamp,
    minute,
    second: 0,
    modelVersion: full.modelVersion,
    inputHash: full.inputHash,
    homeWinProb: full.homeWinProb,
    drawProb: full.drawProb,
    awayWinProb: full.awayWinProb,
    expectedHomeGoals: full.expectedHomeGoals,
    expectedAwayGoals: full.expectedAwayGoals,
    mostLikelyScore: full.mostLikelyScore,
    scorelineDistribution: full.scorelineDistribution,
    intervalDistribution: full.intervalDistribution,
    confidence: full.confidence,
    topPositiveFactors: full.topPositiveFactors,
    topNegativeFactors: full.topNegativeFactors,
    sourceSummary: [],
    explanation: 'Statistical engine output — AI provides narrative only.',
  };
}

async function computeAndPersistPreview(
  env: AppEnv,
  matchId: string,
): Promise<MatchProbabilityTriple | null> {
  const match = await matchesRepo.getMatch(env.DB, matchId);
  if (!match) return null;
  const home = await teamsRepo.getTeam(env.DB, match.home_team_id);
  const away = await teamsRepo.getTeam(env.DB, match.away_team_id);
  if (!home || !away) return null;

  const features = await buildMatchFeaturesWithForm(env, match, home, away, 2026);
  const full = await computeFullMatchProbability(features);
  await probabilityRepo.saveSnapshot(env.DB, fullOutputToResult(full, match.minute));
  return {
    homeWin: full.homeWinProb,
    draw: full.drawProb,
    awayWin: full.awayWinProb,
  };
}

/** Persist full snapshots (scenarios, market) for matches still missing after preview fill. */
export async function persistMissingTournamentProbabilities(
  env: AppEnv,
  matchIds: string[],
): Promise<void> {
  if (matchIds.length === 0) return;

  const already = await env.KV.get(GAP_FILL_KV_KEY);
  if (already) return;

  await env.KV.put(GAP_FILL_KV_KEY, 'running', { expirationTtl: 600 });

  let saved = 0;
  for (const matchId of matchIds) {
    try {
      const snap = await probabilityRepo.getLatestSnapshot(env.DB, matchId);
      if (snap) continue;
      const result = await recomputeMatchProbability(env, matchId);
      if (result) saved += 1;
    } catch {
      // continue with remaining matches
    }
  }

  logInfo('tournament probability gap-fill finished', {
    requested: matchIds.length,
    saved,
  });
  await env.KV.delete(GAP_FILL_KV_KEY);
}

/**
 * Latest WDL per match for tournament board. Fills gaps inline (preview) within a
 * time budget, then schedules full persistence in the background when needed.
 */
export async function buildTournamentMatchProbabilitiesPayload(
  env: AppEnv,
  tournamentId: string,
  options: { scheduleBackgroundFill?: boolean } = {},
): Promise<TournamentMatchProbabilitiesPayload> {
  const { scheduleBackgroundFill = true } = options;

  const [rows, matches] = await Promise.all([
    probabilityRepo.listLatestSnapshotsForTournament(env.DB, tournamentId),
    matchesRepo.getMatchesByTournament(env.DB, tournamentId),
  ]);

  const data: Record<string, MatchProbabilityTriple> = {};
  for (const row of rows) {
    data[row.matchId] = {
      homeWin: row.homeWinProb,
      draw: row.drawProb,
      awayWin: row.awayWinProb,
    };
  }

  const missing = matches.map((m) => m.id).filter((id) => !data[id]);
  if (missing.length === 0) {
    return {
      data,
      meta: { total: matches.length, withProbability: matches.length, pending: 0, missingIds: [] },
    };
  }

  const started = Date.now();
  const stillMissing: string[] = [];

  for (const matchId of missing) {
    if (Date.now() - started > SYNC_FILL_BUDGET_MS) {
      stillMissing.push(matchId);
      continue;
    }
    const triple = await computeAndPersistPreview(env, matchId);
    if (triple) {
      data[matchId] = triple;
    } else {
      stillMissing.push(matchId);
    }
  }

  const pending = matches.length - Object.keys(data).length;
  if (scheduleBackgroundFill && stillMissing.length > 0) {
    void persistMissingTournamentProbabilities(env, stillMissing);
  }

  return {
    data,
    meta: {
      total: matches.length,
      withProbability: Object.keys(data).length,
      pending,
      missingIds: stillMissing,
    },
  };
}

export { WC2026_TOURNAMENT_ID };
