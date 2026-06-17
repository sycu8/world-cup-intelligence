import { describe, it, expect } from 'vitest';
import { computeProbability } from '../src/models/probability/engine';
import { buildLineupFeaturesFromPlayers } from '../src/services/lineupFeatures';
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

function favoriteVsUnderdog(
  matchId: string,
  favorite: { id: string; fifa: number; elo: number; strength: number },
  underdog: { id: string; fifa: number; elo: number; strength: number },
  homeFavorite = true,
): MatchFeatureInput {
  const home = homeFavorite ? favorite : underdog;
  const away = homeFavorite ? underdog : favorite;
  return {
    matchId,
    tournamentYear: 2026,
    stage: 'Group',
    minute: 0,
    second: 0,
    isHomeHost: homeFavorite && favorite.fifa <= 20,
    homeCountryCode: homeFavorite ? 'DE' : 'CU',
    awayCountryCode: homeFavorite ? 'CU' : 'DE',
    homeTeam: wcTeam(home.id, home.fifa, home.elo, home.strength),
    awayTeam: wcTeam(away.id, away.fifa, away.elo, away.strength),
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
      '5-4-1',
      Array.from({ length: 11 }, (_, i) => ({
        is_starter: 1,
        position_slot: i === 0 ? 'GK' : i < 6 ? 'DF' : i < 10 ? 'MF' : 'FW',
        role: null,
      })),
      true,
    ),
    currentScore: { home: 0, away: 0 },
    sourceConfidence: 0.92,
  };
}

const ELITE = [
  { name: 'Germany', id: 'team-de', fifa: 8, elo: 1990, strength: 0.88 },
  { name: 'Brazil', id: 'team-br', fifa: 5, elo: 2010, strength: 0.9 },
  { name: 'England', id: 'team-en', fifa: 4, elo: 2020, strength: 0.89 },
  { name: 'Portugal', id: 'team-pt', fifa: 6, elo: 2000, strength: 0.88 },
  { name: 'France', id: 'team-fr', fifa: 2, elo: 2060, strength: 0.92 },
] as const;

const UNDERDOG = { id: 'team-cu', fifa: 72, elo: 1480, strength: 0.48 };

describe('moderate favorites favour tight wins over 1-1', () => {
  const MODERATE_FAVORITES = [
    { label: 'USA vs Paraguay', home: { id: 'team-us', fifa: 11, elo: 1860, strength: 0.8 }, away: { id: 'team-py', fifa: 52, elo: 1560, strength: 0.56 } },
    { label: 'Belgium vs Tunisia', home: { id: 'team-be', fifa: 7, elo: 1980, strength: 0.86 }, away: { id: 'team-tn', fifa: 41, elo: 1640, strength: 0.62 } },
  ] as const;

  for (const match of MODERATE_FAVORITES) {
    it(`${match.label} most likely score is not 1-1`, async () => {
      const input = favoriteVsUnderdog(`m-${match.home.id}-${match.away.id}`, match.home, match.away, true);
      const r = await computeProbability(input);
      const tightWin = Math.max(
        r.scorelineDistribution['1-0'] ?? 0,
        r.scorelineDistribution['2-0'] ?? 0,
      );

      expect(r.homeWinProb).toBeGreaterThan(0.55);
      expect(r.mostLikelyScore).not.toBe('1-1');
      expect(['1-0', '2-0', '2-1']).toContain(r.mostLikelyScore);
      expect(tightWin).toBeGreaterThan(r.scorelineDistribution['1-1'] ?? 0);
    });
  }
});

describe('elite favorites favour tight wins over 1-1', () => {
  for (const elite of ELITE) {
    it(`${elite.name} vs Cuba favours 1-0/2-0 over 1-1`, async () => {
      const input = favoriteVsUnderdog(
        `m-${elite.id}-cu`,
        elite,
        UNDERDOG,
        true,
      );
      const r = await computeProbability(input);
      const tightWin = Math.max(
        r.scorelineDistribution['1-0'] ?? 0,
        r.scorelineDistribution['2-0'] ?? 0,
      );
      const draw11 = r.scorelineDistribution['1-1'] ?? 0;

      expect(r.homeWinProb).toBeGreaterThan(0.62);
      expect(['1-0', '2-0', '2-1']).toContain(r.mostLikelyScore);
      expect(tightWin).toBeGreaterThan(draw11);
      expect(r.mostLikelyScore).not.toBe('1-1');
    });
  }
});
