import { describe, expect, it, vi } from 'vitest';
import { buildMatchFeaturesWithForm } from '../src/services/matchFeatures';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './helpers/fixtures';

vi.mock('../src/services/teamFormStats', () => ({
  getTeamFormSnapshot: vi.fn(async () => ({
    matchesPlayed: 2,
    pointsPerGame: 1.5,
    goalsForPerGame: 1.2,
    goalsAgainstPerGame: 1.0,
    xgForPerGame: 1.1,
    xgAgainstPerGame: 0.9,
    recentForm: 0.6,
    sourceConfidence: 0.8,
  })),
  blendFormWithBase: vi.fn((base: number) => base),
}));

vi.mock('../src/services/matchStaff', () => ({
  loadStaffFeaturesForMatch: vi.fn(async () => ({
    homeCoach: { coachId: 'c1', name: 'Coach', wcAppearances: 2, tenureYears: 3, tacticalRating: 0.7, disciplineIndex: 0.5, homeNationMatch: true },
    awayCoach: undefined,
    referee: { name: 'Ref', strictness: 0.6, avgYellowCards: 4, avgRedCards: 0.1 },
  })),
}));

describe('buildMatchFeaturesWithForm', () => {
  it('loads form, lineup, and staff modifiers', async () => {
    const lineupId = 'lu-1';
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM lineups')) {
            return { id: lineupId, formation: '4-3-3', is_official: 1 };
          }
          if (sql.includes("role = 'referee'")) return null;
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM lineup_players')) {
            return {
              results: Array.from({ length: 11 }, (_, i) => ({
                is_starter: 1,
                position_slot: i === 0 ? 'GK' : 'CM',
                role: null,
                position: null,
              })),
            };
          }
          return { results: [] };
        },
      }),
    });

    const features = await buildMatchFeaturesWithForm(
      env,
      FIXTURE_MATCH,
      FIXTURE_TEAMS[0],
      FIXTURE_TEAMS[1],
      2026,
    );

    expect(features.homeLineup?.strengthModifier).toBeDefined();
    expect(features.homeCoach?.coachId).toBe('c1');
    expect(features.referee?.name).toBe('Ref');
    expect(features.sourceConfidence).toBeGreaterThan(0.88);
  });
});
