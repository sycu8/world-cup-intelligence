import type { MatchFeatureInput, ProbabilityResult } from './types';
import { sha256Hex } from '../../utils/hash';
import { nowIso } from '../../utils/time';
import {
  collectiveModifier,
  teamAttackStrength,
  teamDefenseWeakness,
} from './teamStrength';
import { lineupModifier } from './playerAvailability';
import { tacticalMatchupModifier } from './tacticalMatchup';
import { gameStateModifier } from './liveGameState';
import { liveMatchStatsModifier } from './liveMatchStatsModifier';
import { aggregateWdl, buildScorelineMatrix, mostLikelyScore } from './scoreline';
import { buildIntervalDistribution } from './interval';
import { buildExplanationFactors } from './explainFactors';
import { matchContextModifier, rankingGapModifier } from './matchContext';
import { coachModifier, refereeModifier } from './staffModifiers';

export const MODEL_VERSION = 'wc-prob-v5';
const BASE_GOAL_RATE = 1.35;
const LAMBDA_MIN = 0.05;
const LAMBDA_MAX = 5.5;

function clampLambda(v: number): number {
  return Math.max(LAMBDA_MIN, Math.min(LAMBDA_MAX, v));
}

export async function computeProbability(input: MatchFeatureInput): Promise<ProbabilityResult> {
  const tactical = tacticalMatchupModifier(input.homeLineup, input.awayLineup);
  const gameState = gameStateModifier(input.minute, input.currentScore.home, input.currentScore.away);
  const liveStats = input.liveMatchStats
    ? liveMatchStatsModifier(input.liveMatchStats)
    : { home: 1, away: 1 };
  const context = matchContextModifier(input);
  const rankGap = rankingGapModifier(input.homeTeam, input.awayTeam);
  const coaches = coachModifier(input.homeCoach, input.awayCoach);
  const official = refereeModifier(
    input.referee,
    input.homeTeam.fifaRanking,
    input.awayTeam.fifaRanking,
  );

  const lambdaHome = clampLambda(
    BASE_GOAL_RATE *
      teamAttackStrength(input.homeTeam) *
      teamDefenseWeakness(input.awayTeam) *
      collectiveModifier(input.homeTeam) *
      lineupModifier(input.homeLineup) *
      tactical.home *
      gameState.home *
      liveStats.home *
      context.home *
      rankGap.home *
      coaches.home *
      official.home,
  );

  const lambdaAway = clampLambda(
    BASE_GOAL_RATE *
      teamAttackStrength(input.awayTeam) *
      teamDefenseWeakness(input.homeTeam) *
      collectiveModifier(input.awayTeam) *
      lineupModifier(input.awayLineup) *
      tactical.away *
      gameState.away *
      liveStats.away *
      context.away *
      rankGap.away *
      coaches.away *
      official.away,
  );

  const matrix = buildScorelineMatrix(lambdaHome, lambdaAway);
  const wdl = aggregateWdl(matrix);
  const intervals = buildIntervalDistribution(
    lambdaHome,
    lambdaAway,
    input.minute,
    input.currentScore.home,
    input.currentScore.away,
    wdl,
  );
  const { positive, negative } = buildExplanationFactors(input);

  const confidence = computeModelConfidence(input);

  const inputHash = await sha256Hex(JSON.stringify({ input, lambdaHome, lambdaAway }));

  return {
    matchId: input.matchId,
    timestamp: nowIso(),
    minute: input.minute,
    second: input.second,
    modelVersion: MODEL_VERSION,
    inputHash,
    homeWinProb: wdl.homeWin,
    drawProb: wdl.draw,
    awayWinProb: wdl.awayWin,
    expectedHomeGoals: lambdaHome,
    expectedAwayGoals: lambdaAway,
    mostLikelyScore: mostLikelyScore(matrix),
    scorelineDistribution: matrix,
    intervalDistribution: intervals,
    confidence,
    topPositiveFactors: positive,
    topNegativeFactors: negative,
    sourceSummary: [],
    explanation: 'Statistical model output — AI layer provides narrative explanation only.',
  };
}

/** Reflects input completeness — not predictive accuracy of W/D/L. */
export function computeModelConfidence(input: MatchFeatureInput): number {
  const missingRoles =
    (input.homeLineup?.missingKeyRoles.length ?? 0) +
    (input.awayLineup?.missingKeyRoles.length ?? 0);

  const lineupHome = input.homeLineup ? 0.92 : 0.86;
  const lineupAway = input.awayLineup ? 0.92 : 0.86;
  const tournamentPrior = input.tournamentYear >= 2026 ? 0.9 : 0.84;
  const rosterCompleteness = Math.max(0.8, 1 - missingRoles * 0.04);
  const staffBoost =
    (input.homeCoach ? 0.015 : 0) + (input.awayCoach ? 0.015 : 0) + (input.referee ? 0.01 : 0);

  const weighted =
    input.sourceConfidence * 0.28 +
    lineupHome * 0.18 +
    lineupAway * 0.18 +
    tournamentPrior * 0.16 +
    rosterCompleteness * 0.12 +
    0.88 * 0.08 +
    staffBoost;

  return Math.min(0.96, Math.max(0.5, weighted));
}
