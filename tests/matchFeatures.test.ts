import { describe, expect, it } from 'vitest';
import { buildMatchFeatures } from '../src/services/matchFeatures';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './helpers/fixtures';
import type { TeamFormSnapshot } from '../src/services/teamFormStats';

describe('buildMatchFeatures', () => {
  const home = FIXTURE_TEAMS[0];
  const away = FIXTURE_TEAMS[1];

  it('builds feature input from teams and match state', () => {
    const features = buildMatchFeatures(FIXTURE_MATCH, home, away, 2026);
    expect(features.matchId).toBe(FIXTURE_MATCH.id);
    expect(features.homeTeam.teamId).toBe(home.id);
    expect(features.awayTeam.teamId).toBe(away.id);
    expect(features.sourceConfidence).toBeGreaterThanOrEqual(0.88);
    expect(features.isHomeHost).toBe(false);
  });

  it('blends form snapshots into team features', () => {
    const homeForm: TeamFormSnapshot = {
      matchesPlayed: 3,
      pointsPerGame: 2,
      goalsForPerGame: 2.1,
      goalsAgainstPerGame: 0.8,
      xgForPerGame: 1.9,
      xgAgainstPerGame: 0.7,
      recentForm: 0.75,
      sourceConfidence: 0.9,
    };
    const features = buildMatchFeatures(FIXTURE_MATCH, home, away, 2026, { home: homeForm });
    expect(features.homeTeam.recentForm).toBe(0.75);
    expect(features.sourceConfidence).toBeGreaterThanOrEqual(0.9);
  });

  it('uses lower base confidence for pre-2026 tournaments', () => {
    const features = buildMatchFeatures(FIXTURE_MATCH, home, away, 2022);
    expect(features.sourceConfidence).toBe(0.82);
  });
});
