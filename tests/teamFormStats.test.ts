import { describe, expect, it, vi } from 'vitest';
import { blendFormWithBase, getTeamFormSnapshot } from '../src/services/teamFormStats';
import { createMockDb } from './helpers/mockEnv';
import { resolveTeamId } from '../src/data/teamNameMap';
import {
  parseStatsbombMatches,
  mapStatsbombStage,
  estimateXgFromGoals,
  filterWorldCupSeasons,
} from '../src/ingestion/adapters/statsbombOpenData';

describe('teamFormStats', () => {
  it('blendFormWithBase weights form into base', () => {
    expect(blendFormWithBase(1.0, 2.0, 0.5)).toBe(1.5);
    expect(blendFormWithBase(1.0, undefined)).toBe(1.0);
  });

  it('getTeamFormSnapshot aggregates completed matches', async () => {
    const db = createMockDb({
      all: () => ({
        results: [
          {
            home_team_id: 'team-w26-a1',
            away_team_id: 'team-w26-a2',
            home_score: 2,
            away_score: 1,
            home_xg: 1.5,
            away_xg: 0.8,
          },
          {
            home_team_id: 'team-w26-b1',
            away_team_id: 'team-w26-a1',
            home_score: 0,
            away_score: 1,
            home_xg: 0.4,
            away_xg: 1.1,
          },
        ],
      }),
    });
    const form = await getTeamFormSnapshot(db, 'team-w26-a1', 6, 't-2026');
    expect(form?.matchesPlayed).toBe(2);
    expect(form?.pointsPerGame).toBe(3);
    expect(form?.recentForm).toBeGreaterThan(0);
  });

  it('falls back to all tournaments when tournament-scoped query empty', async () => {
    let calls = 0;
    const db = createMockDb({
      all: () => {
        calls += 1;
        if (calls === 1) return { results: [] };
        return {
          results: [
            {
              home_team_id: 'team-arg',
              away_team_id: 'team-fra',
              home_score: 1,
              away_score: 1,
              home_xg: 1,
              away_xg: 1,
            },
          ],
        };
      },
    });
    const form = await getTeamFormSnapshot(db, 'team-arg', 6, 't-2026');
    expect(form?.matchesPlayed).toBe(1);
  });
});

describe('teamNameMap', () => {
  it('resolves known national teams', () => {
    expect(resolveTeamId('Argentina')).toBe('team-arg');
    expect(resolveTeamId('United States')).toBe('team-usa');
    expect(resolveTeamId('Unknown FC')).toBeNull();
  });
});

describe('statsbombOpenData', () => {
  it('parses match array', () => {
    const parsed = parseStatsbombMatches([
      {
        match_id: 1,
        match_date: '2022-12-18',
        kick_off: '15:00:00.000',
        home_team: { home_team_name: 'Argentina' },
        away_team: { away_team_name: 'France' },
        home_score: 3,
        away_score: 3,
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].home_team.home_team_name).toBe('Argentina');
  });

  it('maps stages and estimates xG', () => {
    expect(mapStatsbombStage('Quarter-finals')).toBe('QF');
    expect(estimateXgFromGoals(2)).toBeGreaterThan(1.5);
  });

  it('discovers male FIFA World Cup seasons from competitions rows', () => {
    const seasons = filterWorldCupSeasons([
      {
        competition_id: 43,
        season_id: 106,
        competition_name: 'FIFA World Cup',
        competition_gender: 'male',
        competition_youth: false,
        season_name: '2022',
        match_available: '2026-01-01',
      },
      {
        competition_id: 43,
        season_id: 1,
        competition_name: 'FIFA U20 World Cup',
        competition_gender: 'male',
        competition_youth: true,
        season_name: '2023',
        match_available: '2026-01-01',
      },
    ]);
    expect(seasons).toHaveLength(1);
    expect(seasons[0].year).toBe(2022);
  });
});
