import { describe, expect, it } from 'vitest';
import { computeGroupStandingsFromMatchRows } from '../src/services/tournamentProgression';
import { buildGroupStandingsPayload, sortStandingRows, type StandingRow } from '../src/services/tournamentStandings';
import { createMockDb, createMockEnv } from './helpers/mockEnv';

function row(
  teamId: string,
  teamName: string,
  played: number,
  points: number,
  gd = 0,
): StandingRow {
  return {
    teamId,
    teamName,
    shortName: null,
    rank: 0,
    played,
    points,
    gf: 0,
    ga: 0,
    gd,
  };
}

describe('computeGroupStandingsFromMatchRows', () => {
  it('aggregates completed group matches in memory', () => {
    const standings = computeGroupStandingsFromMatchRows(
      [
        {
          group_code: 'A',
          home_team_id: 't-mex',
          away_team_id: 't-rsa',
          home_score: 2,
          away_score: 0,
          status: 'completed',
        },
        {
          group_code: 'B',
          home_team_id: 't-usa',
          away_team_id: 't-can',
          home_score: 1,
          away_score: 1,
          status: 'completed',
        },
      ],
      'A',
    );
    expect(standings.find((r) => r.teamId === 't-mex')?.points).toBe(3);
    expect(standings.find((r) => r.teamId === 't-rsa')?.points).toBe(0);
    expect(standings).toHaveLength(2);
  });
});

describe('sortStandingRows', () => {
  it('sorts alphabetically when no matches played', () => {
    const ranked = sortStandingRows([
      row('t-usa', 'United States', 0, 0),
      row('t-mex', 'Mexico', 0, 0),
      row('t-can', 'Canada', 0, 0),
      row('t-bra', 'Brazil', 0, 0),
    ]);
    expect(ranked.map((r) => r.teamName)).toEqual([
      'Brazil',
      'Canada',
      'Mexico',
      'United States',
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('sorts by goal difference when points are tied', () => {
    const ranked = sortStandingRows([
      row('t-usa', 'United States', 1, 3, 5),
      row('t-mex', 'Mexico', 1, 3, 1),
    ]);
    expect(ranked[0]?.teamId).toBe('t-usa');
    expect(ranked[1]?.teamId).toBe('t-mex');
  });

  it('sorts by points after results', () => {
    const ranked = sortStandingRows([
      row('t-usa', 'United States', 1, 3, 2),
      row('t-mex', 'Mexico', 1, 0, -2),
      row('t-can', 'Canada', 1, 3, 1),
      row('t-bra', 'Brazil', 1, 0, -1),
    ]);
    expect(ranked[0]?.teamId).toBe('t-usa');
    expect(ranked[1]?.teamId).toBe('t-can');
    expect(ranked[2]?.isThirdPlaceCandidate).toBe(true);
  });

  it('breaks ties on goal difference when points are equal', () => {
    const ranked = sortStandingRows([
      { ...row('t-usa', 'United States', 2, 4, 1), gf: 3, ga: 2 },
      { ...row('t-mex', 'Mexico', 2, 4, 0), gf: 2, ga: 2 },
    ]);
    expect(ranked[0]?.teamId).toBe('t-usa');
  });
});

describe('buildGroupStandingsPayload', () => {
  it('falls back to team id when team metadata is missing', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('FROM matches') && sql.includes('group_code')) {
            return {
              results: [{
                group_code: 'A',
                home_team_id: 't-unknown',
                away_team_id: 't-mex',
                home_score: 1,
                away_score: 0,
                status: 'completed',
              }],
            };
          }
          if (sql.includes('GROUP BY group_code')) {
            return { results: [{ group_code: 'A', total: 1, done: 1 }] };
          }
          if (sql.includes('FROM teams')) {
            return { results: [{ id: 't-mex', name: 'Mexico', short_name: 'MEX', country_code: 'MX' }] };
          }
          return { results: [] };
        },
      }),
    });
    const payload = await buildGroupStandingsPayload(env);
    expect(payload.groups.A?.rows.some((r) => r.teamName === 't-unknown')).toBe(true);
    expect(payload.groups.A?.rows.find((r) => r.teamId === 't-mex')?.shortName).toBe('MEX');
  });
});
