import type { MatchFeatureInput, ProbabilityResult } from './types';
import type { TeamSystemProfile } from './teamSystemStrength';
import {
  isKnockoutMatchStage,
  knockoutExtraTimeProbability,
  knockoutPenaltyProbability,
} from './knockoutForecast';

export type ScenarioLikelihood = {
  scenarioType: string;
  probability: number;
  confidence: number;
  explanationFactors: string[];
};

const SCENARIO_TYPES = [
  'early_goal_0_15',
  'first_half_goal',
  'late_goal_75_90',
  'both_teams_score',
  'low_event_match',
  'high_event_match',
  'set_piece_goal',
  'red_card_swing',
  'extra_time_tendency',
  'penalty_shootout_tendency',
] as const;

function clamp01(v: number): number {
  return Math.max(0.02, Math.min(0.98, v));
}

export function computeScenarioLikelihoods(
  input: MatchFeatureInput,
  prob: ProbabilityResult,
  homeSystem: TeamSystemProfile,
  awaySystem: TeamSystemProfile,
): ScenarioLikelihood[] {
  const xgTotal = prob.expectedHomeGoals + prob.expectedAwayGoals;
  const bttsBase = clamp01(0.35 + xgTotal * 0.12);
  const lowEvent = clamp01(1 - xgTotal / 4.5);
  const highEvent = clamp01(xgTotal / 3.8);
  const early = clamp01(0.18 + (homeSystem.tempoScore + awaySystem.tempoScore) * 0.08);
  const firstHalf = clamp01(0.42 + xgTotal * 0.1);
  const late = clamp01(0.22 + (homeSystem.benchDepthScore + awaySystem.benchDepthScore) * 0.12);
  const setPiece = clamp01((homeSystem.setPieceScore + awaySystem.setPieceScore) / 2 + 0.15);
  const redCard = clamp01(0.08 + highEvent * 0.06);
  const isKnockout = isKnockoutMatchStage(input.stage);
  const extraTime = isKnockout
    ? clamp01(knockoutExtraTimeProbability(prob.drawProb, input.stage)!)
    : clamp01(prob.drawProb * 0.15);
  const pens = isKnockout ? clamp01(knockoutPenaltyProbability(prob.drawProb, input.stage)!) : 0.03;

  const map: Record<string, { p: number; factors: string[] }> = {
    early_goal_0_15: { p: early, factors: ['High tempo increases early-phase chance volume.'] },
    first_half_goal: { p: firstHalf, factors: ['Expected goals support first-half scoring.'] },
    late_goal_75_90: { p: late, factors: ['Bench depth and game-state fatigue factor.'] },
    both_teams_score: {
      p: bttsBase,
      factors: ['Attack strengths suggest both sides can score.'],
    },
    low_event_match: { p: lowEvent, factors: ['Low combined xG implies fewer scoring events.'] },
    high_event_match: { p: highEvent, factors: ['Elevated xG supports an open match profile.'] },
    set_piece_goal: { p: setPiece, factors: ['Set-piece indices above baseline for one or both sides.'] },
    red_card_swing: { p: redCard, factors: ['High-event profile correlates with discipline volatility.'] },
    extra_time_tendency: {
      p: extraTime,
      factors: isKnockout ? ['Knockout stage increases draw / ET path.'] : ['Group stage — ET rare.'],
    },
    penalty_shootout_tendency: {
      p: pens,
      factors: isKnockout ? ['Tied knockout matches may reach penalties.'] : ['Group matches rarely go to pens.'],
    },
  };

  return SCENARIO_TYPES.map((scenarioType) => ({
    scenarioType,
    probability: map[scenarioType].p,
    confidence: clamp01(prob.confidence * 0.9),
    explanationFactors: map[scenarioType].factors,
  }));
}
