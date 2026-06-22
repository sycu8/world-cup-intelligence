import { describe, it, expect } from 'vitest';
import { computeProbability } from '../src/models/probability/engine';
import { buildLineupFeaturesFromPlayers } from '../src/services/lineupFeatures';
import type { MatchFeatureInput, TeamFeatures } from '../src/models/probability/types';

function wcTeam(
  id: string,
  fifa: number,
  elo: number,
  strength: number,
): TeamFeatures {
  return {
    teamId: id,
    eloRating: elo,
    fifaRanking: fifa,
    recentForm: strength - 0.1,
    goalDifference: (strength - 0.5) * 10,
    xgDifference: strength - 0.5,
    xgFor: 1.2 + strength * 0.5,
    xgAgainst: 1.1 - strength * 0.3,
    possessionProfile: 0.45 + strength * 0.2,
    fieldTilt: 0.5 + (strength - 0.5) * 0.3,
    ppda: 10 - strength * 3,
    highTurnovers: strength * 0.8,
    transitionThreat: strength * 0.7,
    setPieceXg: 0.2 + strength * 0.15,
    setPieceXga: 0.18,
    defensiveCompactness: strength,
    formationStability: strength,
    benchDepth: strength * 0.9,
    goalkeeperStrength: strength * 0.85,
    restDays: 5,
  };
}

const mexicoSaInput = (): MatchFeatureInput => ({
  matchId: 'm-w26-ga-1v2',
  tournamentYear: 2026,
  stage: 'Group',
  minute: 0,
  second: 0,
  isHomeHost: true,
  homeCountryCode: 'MX',
  awayCountryCode: 'ZA',
  homeTeam: wcTeam('team-w26-a1', 15, 1840, 0.78),
  awayTeam: wcTeam('team-w26-a2', 61, 1510, 0.52),
  homeLineup: buildLineupFeaturesFromPlayers(
    '4-3-3',
    Array.from({ length: 11 }, (_, i) => ({
      is_starter: 1,
      position_slot: i === 0 ? 'GK' : i < 5 ? 'DF' : i < 9 ? 'MF' : 'FW',
      role: null,
    })),
    true,
  ),
  awayLineup: buildLineupFeaturesFromPlayers(
    '5-3-2',
    Array.from({ length: 11 }, (_, i) => ({
      is_starter: 1,
      position_slot: i === 0 ? 'GK' : i < 6 ? 'DF' : i < 9 ? 'MF' : 'FW',
      role: null,
    })),
    true,
  ),
  currentScore: { home: 0, away: 0 },
  sourceConfidence: 0.92,
  homeCoach: {
    coachId: 'coach-mex-aguirre',
    name: 'Javier Aguirre',
    wcAppearances: 3,
    tenureYears: 2,
    tacticalRating: 0.86,
    disciplineIndex: 0.62,
    homeNationMatch: true,
  },
  awayCoach: {
    coachId: 'coach-rsa-broos',
    name: 'Hugo Broos',
    wcAppearances: 1,
    tenureYears: 5.5,
    tacticalRating: 0.76,
    disciplineIndex: 0.68,
    homeNationMatch: false,
  },
  referee: {
    name: 'Wilton Sampaio',
    strictness: 0.82,
    avgYellowCards: 4.6,
    avgRedCards: 0.18,
  },
});

describe('Mexico vs South Africa model calibration (wc-prob-v5)', () => {
  it('favours Mexico at Azteca with staff-adjusted lambdas', async () => {
    const r = await computeProbability(mexicoSaInput());
    expect(r.modelVersion).toBe('wc-prob-v5');
    expect(r.homeWinProb).toBeGreaterThan(0.58);
    expect(r.awayWinProb).toBeLessThan(0.22);
    expect(r.expectedHomeGoals).toBeGreaterThan(1.2);
    expect(r.expectedHomeGoals).toBeLessThan(2.65);
    expect(r.expectedAwayGoals).toBeLessThan(0.85);
    expect(['1-0', '2-0', '2-1']).toContain(r.mostLikelyScore);
    expect(r.scorelineDistribution['2-0'] ?? 0).toBeGreaterThan(r.scorelineDistribution['1-1'] ?? 0);
  });

  it('uses pre-match state for completed fixtures (no final-score leak)', async () => {
    const { predictionMatchState } = await import('../src/models/probability/matchState');
    const state = predictionMatchState('completed', 90, 2, 0);
    expect(state).toEqual({ minute: 0, home: 0, away: 0 });
  });
});
