import { describe, expect, it } from 'vitest';
import {
  getHeadToHead,
  getTeamRecentWorldCupMatches,
  getTeamWorldCupHeadToHead,
  getWorldCupHeadToHeadBetween,
  groupTeamWorldCupMeetings,
  mapMatchesToTeamPerspective,
  resolveTeamIdsForWcHistory,
  summarizePairFromPerspective,
  type HeadToHeadMatch,
} from '../src/services/matchHistory';
import { createMockDb, createMockEnv } from './helpers/mockEnv';

function meeting(
  id: string,
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number,
  year: number,
): HeadToHeadMatch {
  return {
    id,
    kickoff_utc: `${year}-06-01T12:00:00Z`,
    stage: 'Group',
    status: 'completed',
    home_team_id: homeId,
    away_team_id: awayId,
    home_name: homeId,
    away_name: awayId,
    home_short: null,
    away_short: null,
    home_score: homeScore,
    away_score: awayScore,
    home_xg: 1,
    away_xg: 1,
    tournament_year: year,
    tournament_name: `WC ${year}`,
  };
}

describe('summarizePairFromPerspective', () => {
  it('counts wins from current match home/away orientation', () => {
    const meetings = [
      meeting('a', 'team-arg', 'team-fra', 3, 3, 2022),
      meeting('b', 'team-fra', 'team-arg', 4, 3, 2018),
    ];
    const summary = summarizePairFromPerspective(meetings, 'team-arg', 'team-fra');
    expect(summary.totalMatches).toBe(2);
    expect(summary.homeTeamWins).toBe(0);
    expect(summary.awayTeamWins).toBe(1);
    expect(summary.draws).toBe(1);
  });

  it('returns neutral summary when no meetings exist', () => {
    expect(summarizePairFromPerspective([], 'team-a', 'team-b')).toEqual({
      totalMatches: 0,
      homeTeamWins: 0,
      awayTeamWins: 0,
      draws: 0,
      avgGoalsHome: 0,
      avgGoalsAway: 0,
      recentFormHome: '—',
      recentFormAway: '—',
    });
  });
});

describe('groupTeamWorldCupMeetings', () => {
  it('groups meetings by opponent with aggregate record', () => {
    const meetings = [
      meeting('1', 'team-arg', 'team-fra', 3, 3, 2022),
      meeting('2', 'team-fra', 'team-arg', 4, 3, 2018),
      meeting('3', 'team-arg', 'team-mex', 2, 1, 2006),
    ];
    const grouped = groupTeamWorldCupMeetings('team-arg', meetings);
    expect(grouped).toHaveLength(2);
    const fra = grouped.find((g) => g.opponentId === 'team-fra');
    expect(fra?.meetings).toHaveLength(2);
    expect(fra?.wins).toBe(0);
    expect(fra?.losses).toBe(1);
    expect(fra?.draws).toBe(1);
    const mex = grouped.find((g) => g.opponentId === 'team-mex');
    expect(mex?.wins).toBe(1);
  });
});

describe('mapMatchesToTeamPerspective', () => {
  it('maps scores and result from team perspective with alias ids', () => {
    const meetings = [
      {
        ...meeting('1', 'team-mex', 'team-bra', 0, 2, 2018),
        home_name: 'Mexico',
        away_name: 'Brazil',
        home_short: 'MEX',
        away_short: 'BRA',
      },
      {
        ...meeting('2', 'team-fra', 'team-mex', 0, 2, 2010),
        home_name: 'France',
        away_name: 'Mexico',
        home_short: 'FRA',
        away_short: 'MEX',
      },
    ];
    const aliasIds = new Set(['team-w26-a1', 'team-mex']);
    const mapped = mapMatchesToTeamPerspective(aliasIds, meetings);
    expect(mapped).toHaveLength(2);
    expect(mapped[0]).toMatchObject({
      opponentName: 'Brazil',
      teamScore: 0,
      opponentScore: 2,
      result: 'L',
      isHome: true,
    });
    expect(mapped[1]).toMatchObject({
      opponentName: 'France',
      teamScore: 2,
      opponentScore: 0,
      result: 'W',
      isHome: false,
    });
  });

  it('maps drawn matches from the away perspective', () => {
    const mapped = mapMatchesToTeamPerspective(
      new Set(['team-draw-away']),
      [
        {
          ...meeting('draw-1', 'team-home', 'team-draw-away', 1, 1, 2014),
          home_name: 'Home',
          away_name: 'Away',
          home_short: 'HOM',
          away_short: 'AWY',
        },
      ],
    );
    expect(mapped[0]).toMatchObject({
      opponentId: 'team-home',
      teamScore: 1,
      opponentScore: 1,
      result: 'D',
      isHome: false,
    });
  });
});

describe('resolveTeamIdsForWcHistory', () => {
  it('expands alias ids by country code and legacy name map', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ id: 'team-w26-a1', name: 'Mexico', country_code: 'MEX' }),
        all: () => ({ results: [{ id: 'team-mex' }, { id: 'team-w26-a1' }] }),
      }),
    });
    const ids = await resolveTeamIdsForWcHistory(env, 'team-w26-a1');
    expect(ids).toContain('team-mex');
    expect(ids).toContain('team-w26-a1');
  });

  it('falls back to the requested team id when team lookup is missing', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: () => ({ results: [] }),
      }),
    });
    await expect(resolveTeamIdsForWcHistory(env, 'team-missing')).resolves.toEqual(['team-missing']);
  });
});

describe('getHeadToHead async loaders', () => {
  const historyRow = (id: string, homeId: string, awayId: string, year: number): HeadToHeadMatch =>
    meeting(id, homeId, awayId, 2, 1, year);

  it('getWorldCupHeadToHeadBetween excludes current match id', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [historyRow('old-1', 'team-arg', 'team-fra', 2018)],
        }),
      }),
    });
    const rows = await getWorldCupHeadToHeadBetween(env, 'team-arg', 'team-fra', 'current-match');
    expect(rows).toHaveLength(1);
  });

  it('getWorldCupHeadToHeadBetween returns empty array when no rows exist', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({ results: undefined }),
      }),
    });
    await expect(getWorldCupHeadToHeadBetween(env, 'team-a', 'team-b')).resolves.toEqual([]);
  });

  it('getTeamWorldCupHeadToHead groups opponents', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ id: 'team-arg' }),
        all: () => ({
          results: [
            historyRow('1', 'team-arg', 'team-fra', 2018),
            historyRow('2', 'team-arg', 'team-mex', 2006),
          ],
        }),
      }),
    });
    const payload = await getTeamWorldCupHeadToHead(env, 'team-arg');
    expect(payload?.opponents).toHaveLength(2);
    expect(payload?.totalMeetings).toBe(2);
  });

  it('getTeamWorldCupHeadToHead returns null when the team is absent', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
      }),
    });
    await expect(getTeamWorldCupHeadToHead(env, 'team-ghost')).resolves.toBeNull();
  });

  it('getHeadToHead returns summary for WC2026 fixture', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('WHERE m.id = ?')) {
            return {
              ...meeting('current', 'team-w26-a1', 'team-w26-a2', 0, 0, 2026),
              home_team_id: 'team-w26-a1',
              away_team_id: 'team-w26-a2',
            };
          }
          if (sql.includes('country_code')) return { country_code: 'MEX' };
          return null;
        },
        all: () => ({ results: [] }),
      }),
    });
    const h2h = await getHeadToHead(env, 'current');
    expect(h2h?.summary.totalMatches).toBe(0);
    expect(h2h?.current?.id).toBe('current');
  });

  it('getHeadToHead returns null when the current WC2026 fixture is missing', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: () => ({ results: [] }),
      }),
    });
    await expect(getHeadToHead(env, 'missing')).resolves.toBeNull();
  });

  it('getTeamRecentWorldCupMatches maps team perspective', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ id: 'team-mex', name: 'Mexico', country_code: 'MEX' }),
        all: () => ({
          results: [historyRow('1', 'team-mex', 'team-bra', 2014)],
        }),
      }),
    });
    const recent = await getTeamRecentWorldCupMatches(env, 'team-mex', 3);
    expect(recent[0].result).toBeDefined();
  });

  it('getTeamRecentWorldCupMatches returns empty array when history rows are undefined', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ id: 'team-mex', name: 'Mexico', country_code: null }),
        all: (sql) => {
          if (sql.includes('country_code = ?')) return { results: [] };
          return { results: undefined };
        },
      }),
    });
    await expect(getTeamRecentWorldCupMatches(env, 'team-mex', 2, 'exclude-me')).resolves.toEqual([]);
  });
});
