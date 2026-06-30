import { describe, it, expect } from 'vitest';
import { computeProbability } from '../src/models/probability/engine';
import type { MatchFeatureInput, TeamFeatures } from '../src/models/probability/types';

function wcTeam(id: string, fifa: number, elo: number, strength: number): TeamFeatures {
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

const portugalCongoInput = (): MatchFeatureInput => ({
  matchId: 'm-w26-gk-1v2',
  tournamentYear: 2026,
  stage: 'Group',
  minute: 0,
  second: 0,
  homeTeam: wcTeam('team-w26-k1', 6, 1955, 0.88),
  awayTeam: wcTeam('team-w26-k2', 67, 1490, 0.54),
  currentScore: { home: 0, away: 0 },
  sourceConfidence: 0.92,
});

/** Secondary benchmark — non-host favorite under wc-prob-v5 (Portugal vs Congo DR). */
describe('Portugal vs Congo DR model calibration (benchmark)', () => {
  it('favours Portugal pre-kickoff with tight win scoreline', async () => {
    const r = await computeProbability(portugalCongoInput());
    expect(r.modelVersion).toBe('wc-prob-v5');
    expect(r.homeWinProb).toBeGreaterThan(0.52);
    expect(r.mostLikelyScore).not.toBe('1-1');
    expect(['1-0', '2-0', '2-1']).toContain(r.mostLikelyScore);
  });
});
