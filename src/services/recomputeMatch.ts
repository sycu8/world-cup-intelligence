import type { AppEnv } from '../env';
import * as matchesRepo from '../db/repositories/matchesRepo';
import * as teamsRepo from '../db/repositories/teamsRepo';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import * as teamSystemRepo from '../db/repositories/teamSystemRepo';
import * as scenarioRepo from '../db/repositories/scenarioRepo';
import { computeFullMatchProbability } from '../models/probability/fullMatchOutput';
import type { ProbabilityResult } from '../models/probability/types';
import { buildMatchFeaturesWithForm } from './matchFeatures';
import { buildModelVsMarket } from '../market/services/marketSignalService';
import { logInfo, logError } from '../utils/logger';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';

export async function recomputeMatchProbability(
  env: AppEnv,
  matchId: string,
): Promise<ProbabilityResult | null> {
  const match = await matchesRepo.getMatch(env.DB, matchId);
  if (!match) return null;
  const home = await teamsRepo.getTeam(env.DB, match.home_team_id);
  const away = await teamsRepo.getTeam(env.DB, match.away_team_id);
  if (!home || !away) return null;

  const tournament = await env.DB.prepare('SELECT year FROM tournaments WHERE id = ?')
    .bind(match.tournament_id)
    .first<{ year: number }>();

  const features = await buildMatchFeaturesWithForm(env, match, home, away, tournament?.year ?? 2026);
  const full = await computeFullMatchProbability(features);

  const result: ProbabilityResult = {
    matchId: full.matchId,
    timestamp: full.timestamp,
    minute: features.minute,
    second: features.second,
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

  await probabilityRepo.saveSnapshot(env.DB, result);

  await teamSystemRepo.upsertTeamSystemProfile(
    env.DB,
    home.id,
    match.tournament_id,
    full.teamSystemFactors.home,
    full.modelVersion,
    full.inputHash,
  );
  await teamSystemRepo.upsertTeamSystemProfile(
    env.DB,
    away.id,
    match.tournament_id,
    full.teamSystemFactors.away,
    full.modelVersion,
    full.inputHash,
  );

  await scenarioRepo.replaceScenarioProbabilities(
    env.DB,
    matchId,
    full.scenarioLikelihoods,
    full.modelVersion,
    full.inputHash,
  );

  await buildModelVsMarket(env, matchId).catch(() => undefined);

  logInfo('probability recomputed', { match_id: matchId, model_version: result.modelVersion });
  return result;
}

export async function recomputeAllActiveMatches(env: AppEnv): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM matches
     WHERE tournament_id = ?
       AND (status IN ('scheduled', 'live')
            OR kickoff_utc >= datetime('now', '-1 day'))
     ORDER BY kickoff_utc ASC`,
  )
    .bind(WC2026_TOURNAMENT_ID)
    .all<{ id: string }>();

  const ids = (results ?? []).map((r) => r.id);
  const done: string[] = [];
  for (const matchId of ids) {
    try {
      const r = await recomputeMatchProbability(env, matchId);
      if (r) done.push(matchId);
    } catch (e) {
      logError('recompute failed', { match_id: matchId, error: String(e) });
    }
  }
  return done;
}

export type RecomputeAllResult = {
  total: number;
  recomputed: number;
  sampleConfidence?: number;
  failed: { id: string; error: string }[];
};

/** Recompute probability, team systems, and scenarios for every WC 2026 match. */
export async function recomputeAllWc2026Matches(env: AppEnv): Promise<RecomputeAllResult> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM matches WHERE tournament_id = ? ORDER BY kickoff_utc ASC`,
  )
    .bind(WC2026_TOURNAMENT_ID)
    .all<{ id: string }>();

  const ids = (results ?? []).map((r) => r.id);
  const failed: { id: string; error: string }[] = [];
  let recomputed = 0;
  let sampleConfidence: number | undefined;

  for (const matchId of ids) {
    try {
      const r = await recomputeMatchProbability(env, matchId);
      if (r) {
        recomputed += 1;
        if (sampleConfidence == null) sampleConfidence = r.confidence;
      } else {
        failed.push({ id: matchId, error: 'match or teams missing' });
      }
    } catch (e) {
      logError('recompute failed', { match_id: matchId, error: String(e) });
      failed.push({ id: matchId, error: String(e) });
    }
  }

  logInfo('wc2026 bulk recompute done', {
    total: ids.length,
    recomputed,
    failed: failed.length,
  });

  return { total: ids.length, recomputed, sampleConfidence, failed };
}
