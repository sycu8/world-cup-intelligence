import { describe, expect, it } from 'vitest';
import { dixonColesAdjust } from '../src/models/probability/dixonColes';
import { tacticalMatchupModifier } from '../src/models/probability/tacticalMatchup';
import { gameStateModifier } from '../src/models/probability/liveGameState';
import { lineupModifier } from '../src/models/probability/playerAvailability';
import { predictionMatchState } from '../src/models/probability/matchState';
import { computeFullMatchProbability } from '../src/models/probability/fullMatchOutput';
import {
  isWc2026HostTeam,
  matchContextModifier,
  rankingGapModifier,
} from '../src/models/probability/matchContext';
import type { MatchFeatureInput, TeamFeatures } from '../src/models/probability/types';

function baseTeam(id: string, overrides: Partial<TeamFeatures> = {}): TeamFeatures {
  return {
    teamId: id,
    eloRating: 1800,
    fifaRanking: 12,
    recentForm: 0.4,
    goalDifference: 3,
    xgDifference: 0.4,
    xgFor: 1.5,
    xgAgainst: 1.1,
    possessionProfile: 0.52,
    fieldTilt: 0.5,
    ppda: 9,
    highTurnovers: 0.55,
    transitionThreat: 0.5,
    setPieceXg: 0.2,
    setPieceXga: 0.18,
    defensiveCompactness: 0.65,
    formationStability: 0.7,
    benchDepth: 0.65,
    goalkeeperStrength: 0.68,
    restDays: 4,
    ...overrides,
  };
}

const baseInput: MatchFeatureInput = {
  matchId: 'm-prob-1',
  tournamentYear: 2026,
  stage: 'Group',
  minute: 0,
  second: 0,
  homeTeam: baseTeam('home'),
  awayTeam: baseTeam('away', { fifaRanking: 40, eloRating: 1700 }),
  currentScore: { home: 0, away: 0 },
  sourceConfidence: 0.85,
  isHomeHost: true,
};

describe('dixonColesAdjust', () => {
  it('adjusts low-score correlations', () => {
    const adjusted = dixonColesAdjust(1, 1, 0.12, 1.4, 1.1);
    expect(adjusted).not.toBe(0.12);
    expect(dixonColesAdjust(2, 2, 0.05, 1.4, 1.1)).toBe(0.05);
  });
});

describe('tacticalMatchupModifier', () => {
  it('boosts attacking home vs low block away', () => {
    const mod = tacticalMatchupModifier(
      { formation: '4-3-3', strengthModifier: 1, missingKeyRoles: [] },
      { formation: '5-4-1', strengthModifier: 1, missingKeyRoles: [] },
    );
    expect(mod.home).toBeGreaterThan(1);
    expect(mod.away).toBeLessThan(1);
  });
});

describe('gameStateModifier', () => {
  it('favors trailing team late in match', () => {
    const tied = gameStateModifier(30, 0, 0);
    expect(tied).toEqual({ home: 1, away: 1 });

    const late = gameStateModifier(80, 1, 0);
    expect(late.home).toBeGreaterThan(late.away);
  });
});

describe('lineupModifier', () => {
  it('penalizes missing key roles', () => {
    expect(lineupModifier(undefined)).toBe(0.97);
    expect(
      lineupModifier({ formation: '4-3-3', strengthModifier: 1, missingKeyRoles: ['striker', 'cb'] }),
    ).toBeLessThan(1);
  });
});

describe('predictionMatchState', () => {
  it('zeros score for non-live fixtures', () => {
    expect(predictionMatchState('completed', 90, 2, 1)).toEqual({ minute: 0, home: 0, away: 0 });
    expect(predictionMatchState('live', 55, 1, 0)).toEqual({ minute: 55, home: 1, away: 0 });
  });
});

describe('matchContextModifier', () => {
  it('applies host lift for WC2026 hosts', () => {
    expect(isWc2026HostTeam('US')).toBe(true);
    expect(isWc2026HostTeam('BR')).toBe(false);
    const mod = matchContextModifier(baseInput);
    expect(mod.home).toBeGreaterThan(mod.away);
  });

  it('rankingGapModifier widens gap for large FIFA ranking differences', () => {
    const mod = rankingGapModifier(baseInput.homeTeam, baseInput.awayTeam);
    expect(mod.home).toBeGreaterThan(1);
    expect(mod.away).toBeLessThan(1);
  });
});

describe('computeFullMatchProbability', () => {
  it('returns scenario likelihoods and team system factors', async () => {
    const output = await computeFullMatchProbability(baseInput, '4-3-3', '5-4-1');
    const sum = output.homeWinProb + output.drawProb + output.awayWinProb;
    expect(sum).toBeCloseTo(1, 2);
    expect(output.scenarioLikelihoods.length).toBeGreaterThan(0);
    expect(output.teamSystemFactors.home.tacticalIdentity).toBeTruthy();
    expect(output.teamSystemFactors.away.primaryFormation).toBe('5-4-1');
  });
});
