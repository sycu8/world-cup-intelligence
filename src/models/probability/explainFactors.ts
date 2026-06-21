import type { ExplanationFactor, MatchFeatureInput } from './types';
import { teamAttackStrength, teamDefenseWeakness } from './teamStrength';

export function buildExplanationFactors(input: MatchFeatureInput): {
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
} {
  const factors: ExplanationFactor[] = [
    {
      key: 'home_elo',
      label: 'Home Elo advantage',
      direction: input.homeTeam.eloRating >= input.awayTeam.eloRating ? 'home' : 'away',
      impact: Math.abs(input.homeTeam.eloRating - input.awayTeam.eloRating) / 500,
      confidence: 0.9,
      evidenceType: 'statistical',
    },
    {
      key: 'xg_for',
      label: 'Expected goals profile',
      direction: input.homeTeam.xgFor >= input.awayTeam.xgFor ? 'home' : 'away',
      impact: Math.abs(input.homeTeam.xgFor - input.awayTeam.xgFor) / 2,
      confidence: 0.85,
      evidenceType: 'statistical',
    },
    {
      key: 'defense',
      label: 'Defensive solidity',
      direction:
        teamDefenseWeakness(input.awayTeam) < teamDefenseWeakness(input.homeTeam) ? 'home' : 'away',
      impact: 0.15,
      confidence: 0.8,
      evidenceType: 'statistical',
    },
    {
      key: 'attack',
      label: 'Collective attack strength',
      direction:
        teamAttackStrength(input.homeTeam) >= teamAttackStrength(input.awayTeam) ? 'home' : 'away',
      impact: 0.2,
      confidence: 0.82,
      evidenceType: 'statistical',
    },
  ];
  if (input.homeCoach || input.awayCoach) {
    const homeRating = input.homeCoach?.tacticalRating ?? 0.72;
    const awayRating = input.awayCoach?.tacticalRating ?? 0.72;
    const coachSide: 'home' | 'away' = homeRating >= awayRating ? 'home' : 'away';
    factors.push({
      key: 'head_coach',
      label: 'Head coach profile',
      direction: coachSide,
      impact: 0.12,
      confidence: 0.78,
      evidenceType: 'official',
    });
  }
  if (input.referee && input.referee.strictness > 0.65) {
    factors.push({
      key: 'referee_strictness',
      label: 'Referee card profile',
      direction: input.homeTeam.fifaRanking <= input.awayTeam.fifaRanking ? 'home' : 'away',
      impact: (input.referee.strictness - 0.5) * 0.2,
      confidence: 0.72,
      evidenceType: 'official',
    });
  }

  const sorted = [...factors].sort((a, b) => b.impact - a.impact);
  return { positive: sorted.slice(0, 3), negative: sorted.slice(-2) };
}
