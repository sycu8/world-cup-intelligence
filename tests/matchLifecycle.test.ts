import { describe, expect, it } from 'vitest';
import {
  mockScoreAtMinute,
  resolveLoserTeamId,
  resolveWinnerTeamId,
} from '../src/services/matchLifecycle';

describe('matchLifecycle', () => {
  it('resolves group draw without winner', () => {
    const outcome = {
      home_team_id: 'team-a',
      away_team_id: 'team-b',
      home_score: 1,
      away_score: 1,
      stage: 'Group',
    };
    expect(resolveWinnerTeamId(outcome)).toBeNull();
    expect(resolveLoserTeamId(outcome)).toBeNull();
  });

  it('resolves knockout winner on goals', () => {
    const outcome = {
      home_team_id: 'team-a',
      away_team_id: 'team-b',
      home_score: 2,
      away_score: 1,
      stage: 'Quarter-final',
    };
    expect(resolveWinnerTeamId(outcome)).toBe('team-a');
    expect(resolveLoserTeamId(outcome)).toBe('team-b');
  });

  it('uses home tie-break on knockout level scores', () => {
    const outcome = {
      home_team_id: 'team-a',
      away_team_id: 'team-b',
      home_score: 0,
      away_score: 0,
      stage: 'Final',
    };
    expect(resolveWinnerTeamId(outcome)).toBe('team-a');
    expect(resolveLoserTeamId(outcome)).toBe('team-b');
  });

  it('mock scores stay stable for same minute', () => {
    const a = mockScoreAtMinute('m-w26-ga-1v2', 45);
    const b = mockScoreAtMinute('m-w26-ga-1v2', 45);
    expect(a).toEqual(b);
    expect(a.home).toBeGreaterThanOrEqual(0);
    expect(a.away).toBeGreaterThanOrEqual(0);
  });
});

describe('group standings sort', () => {
  it('ranks by points then goal difference', async () => {
    const { computeGroupStandings } = await import('../src/services/tournamentProgression');
    let call = 0;
    const db = {
      prepare: () => ({
        bind: () => ({
          all: async () => {
            call += 1;
            if (call === 1) {
              return {
                results: [{ team_id: 't1' }, { team_id: 't2' }, { team_id: 't3' }],
              };
            }
            return {
              results: [
                { home_team_id: 't1', away_team_id: 't2', home_score: 2, away_score: 0 },
                { home_team_id: 't3', away_team_id: 't1', home_score: 1, away_score: 1 },
                { home_team_id: 't2', away_team_id: 't3', home_score: 0, away_score: 3 },
              ],
            };
          },
        }),
      }),
    } as unknown as D1Database;

    const standings = await computeGroupStandings(db, 'A');
    expect(standings[0]?.teamId).toBe('t3');
    expect(standings[0]?.points).toBe(4);
    expect(standings[1]?.teamId).toBe('t1');
    expect(standings[1]?.points).toBe(4);
  });

  it('seeds four teams with zero stats before results', async () => {
    const { computeGroupStandings } = await import('../src/services/tournamentProgression');
    let call = 0;
    const db = {
      prepare: () => ({
        bind: () => ({
          all: async () => {
            call += 1;
            if (call === 1) {
              return {
                results: [
                  { team_id: 't-usa' },
                  { team_id: 't-mex' },
                  { team_id: 't-can' },
                  { team_id: 't-bra' },
                ],
              };
            }
            return { results: [] };
          },
        }),
      }),
    } as unknown as D1Database;

    const standings = await computeGroupStandings(db, 'A');
    expect(standings).toHaveLength(4);
    expect(standings.every((s) => s.played === 0 && s.points === 0)).toBe(true);
  });
});
