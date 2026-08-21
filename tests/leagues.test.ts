import { describe, expect, it, vi } from 'vitest';
import {
  CLUB_LEAGUES,
  LA_LIGA_ID,
  V_LEAGUE_ID,
  clubMatchId,
  clubTeamId,
  getLeagueById,
  getLeagueBySlug,
  isClubLeagueTournamentId,
} from '../src/constants/leagues';
import {
  mapEspnStatus,
  parseEspnLeaders,
  parseEspnNews,
  parseEspnScoreboardEvents,
  parseEspnStandings,
  parseTheSportsDbEvents,
  parseTheSportsDbTable,
} from '../src/ingestion/leagues/parseLeagueSources';
import { buildMockLeagueMatches, buildMockLeagueStandings } from '../src/ingestion/leagues/mockLeagueData';
import { syncLeague } from '../src/ingestion/leagues/syncLeagues';
import { buildLeagueCatalogPayload, buildLeagueHubPayload } from '../src/services/leaguePayload';
import { buildMatchSlug } from '../src/utils/matchSlug';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { jsonRoute } from './helpers/routeHarness';
import { leagueRoutes } from '../src/routes/leagues';

describe('league catalog', () => {
  it('covers one flagship competition per region', () => {
    expect(CLUB_LEAGUES.map((l) => l.region).sort()).toEqual([
      'africa',
      'asean',
      'europe',
      'japan',
      'vietnam',
    ]);
    expect(getLeagueBySlug('la-liga')?.id).toBe(LA_LIGA_ID);
    expect(getLeagueById(V_LEAGUE_ID)?.slug).toBe('v-league-1');
    expect(getLeagueBySlug('asean-championship')?.espnSlug).toBe('aff.championship');
    expect(getLeagueBySlug('v-league-1')?.theSportsDbId).toBe('4803');
    expect(getLeagueBySlug('j1-league')?.theSportsDbId).toBe('4633');
    expect(getLeagueBySlug('caf-champions-league')?.theSportsDbId).toBe('4720');
    expect(getLeagueBySlug('la-liga')?.season).toBe('2026-2027');
    expect(isClubLeagueTournamentId(LA_LIGA_ID)).toBe(true);
    expect(isClubLeagueTournamentId('t-2026')).toBe(false);
    expect(clubTeamId(getLeagueBySlug('la-liga')!, '86')).toBe('team-liga-86');
    expect(clubMatchId(getLeagueBySlug('j1-league')!, '99')).toBe('m-j1-99');
    expect(clubMatchId(getLeagueBySlug('asean-championship')!, '12')).toBe('m-aff-12');
  });

  it('prefixes club match slugs and keeps World Cup slugs unchanged', () => {
    expect(
      buildMatchSlug({
        stage: 'Group',
        groupCode: 'A',
        homeName: 'United States',
        awayName: 'Mexico',
      }),
    ).toBe('vong-bang-a-united-states-vs-mexico');
    expect(
      buildMatchSlug({
        stage: 'Round 12',
        groupCode: null,
        homeName: 'Real Madrid',
        awayName: 'Barcelona',
        tournamentSlug: 'la-liga',
      }),
    ).toBe('la-liga-round-12-real-madrid-vs-barcelona');
  });
});

describe('parse league sources', () => {
  it('maps ESPN status states', () => {
    expect(mapEspnStatus('in')).toBe('live');
    expect(mapEspnStatus('post', true)).toBe('completed');
    expect(mapEspnStatus('pre')).toBe('scheduled');
  });

  it('parses scoreboard, standings, leaders, and news', () => {
    const matches = parseEspnScoreboardEvents({
      events: [
        {
          id: '401',
          date: '2026-08-20T19:00:00Z',
          week: { number: 2, text: 'Round 2' },
          competitions: [
            {
              status: { type: { state: 'in', detail: '67' }, displayClock: '67', period: 2 },
              competitors: [
                { homeAway: 'home', score: '1', team: { id: '86', displayName: 'Real Madrid', abbreviation: 'RMA' } },
                { homeAway: 'away', score: '0', team: { id: '83', displayName: 'Barcelona', abbreviation: 'BAR' } },
              ],
              venue: { fullName: 'Bernabéu' },
            },
          ],
        },
      ],
    });
    expect(matches[0]).toMatchObject({
      sourceEventId: '401',
      status: 'live',
      homeScore: 1,
      awayScore: 0,
      matchweek: 2,
    });

    const table = parseEspnStandings({
      standings: {
        entries: [
          {
            team: { id: '86', displayName: 'Real Madrid', abbreviation: 'RMA' },
            stats: [
              { name: 'rank', value: 1 },
              { name: 'gamesPlayed', value: 3 },
              { name: 'wins', value: 3 },
              { name: 'ties', value: 0 },
              { name: 'losses', value: 0 },
              { name: 'points', value: 9 },
              { name: 'pointsFor', value: 7 },
              { name: 'pointsAgainst', value: 1 },
            ],
          },
        ],
      },
    });
    expect(table[0]).toMatchObject({ rank: 1, points: 9, gf: 7, gd: 6 });

    const grouped = parseEspnStandings({
      children: [
        {
          name: 'Group A',
          standings: {
            entries: [
              {
                team: { id: 'ahly', displayName: 'Al Ahly' },
                stats: [{ name: 'points', value: 7 }],
              },
            ],
          },
        },
      ],
    });
    expect(grouped[0]?.groupCode).toBe('A');

    const scorers = parseEspnLeaders({
      leaders: [{ name: 'scorers', leaders: [{ athlete: { id: '1', displayName: 'Mbappé' }, team: { id: '86', displayName: 'Real Madrid' }, value: 5 }] }],
    });
    expect(scorers[0]).toMatchObject({ playerName: 'Mbappé', goals: 5, rank: 1 });

    const news = parseEspnNews({
      articles: [{ headline: 'El Clásico preview', description: 'Form notes', published: '2026-08-20T00:00:00Z', links: { web: { href: 'https://espn.com/a' } } }],
    });
    expect(news[0]?.title).toContain('Clásico');
  });

  it('parses TheSportsDB events and table', () => {
    const matches = parseTheSportsDbEvents({
      events: [
        {
          idEvent: 'ev1',
          strHomeTeam: 'Hà Nội FC',
          strAwayTeam: 'Hải Phòng',
          intHomeScore: '2',
          intAwayScore: '1',
          dateEvent: '2026-08-19',
          strTime: '11:00:00',
          strTimestamp: '2026-08-19T11:00:00',
          strTimeLocal: '18:00:00',
          strStatus: 'Match Finished',
          intRound: '6',
          idHomeTeam: 'hanoi',
          idAwayTeam: 'hp',
        },
      ],
    });
    expect(matches[0]).toMatchObject({
      status: 'completed',
      homeScore: 2,
      matchweek: 6,
      kickoffUtc: '2026-08-19T11:00:00.000Z',
    });

    const table = parseTheSportsDbTable({
      table: [{ intRank: '1', strTeam: 'Hà Nội FC', idTeam: 'hanoi', intPlayed: '8', intWin: '6', intDraw: '1', intLoss: '1', intGoalsFor: '16', intGoalsAgainst: '7', intPoints: '19' }],
    });
    expect(table[0]).toMatchObject({ points: 19, gd: 9 });
  });

  it('builds mock fixtures with whole-hour Vietnam kickoffs', () => {
    for (const league of CLUB_LEAGUES) {
      const matches = buildMockLeagueMatches(league);
      expect(matches.length).toBeGreaterThan(0);
      expect(buildMockLeagueStandings(league).length).toBeGreaterThan(0);
      for (const match of matches) {
        expect(match.kickoffUtc).toMatch(/T\d{2}:00:00\.000Z$/);
      }
    }
  });
});

describe('theSportsDb season candidates', () => {
  it('expands slash seasons into hyphenated variants', async () => {
    const { theSportsDbSeasonCandidates } = await import('../src/ingestion/leagues/leagueApiClient');
    expect(theSportsDbSeasonCandidates('2026/27', 2026)).toEqual(
      expect.arrayContaining(['2026/27', '2026-2027', '2026', '2025-2026']),
    );
  });
});

describe('league payload and routes', () => {
  it('GET /api/leagues returns regional catalog', async () => {
    const { res, json } = await jsonRoute<{ data: { regions: unknown[]; leagues: unknown[]; featured: { slug: string } } }>(
      leagueRoutes,
      '/',
    );
    expect(res.status).toBe(200);
    expect(json.data.featured.slug).toBe('world-cup-2026');
    expect(json.data.leagues).toHaveLength(5);
    expect(json.data.regions).toHaveLength(5);
    expect(
      (json.data.leagues as { slug: string }[]).some((l) => l.slug === 'asean-championship'),
    ).toBe(true);
  });

  it('GET /api/leagues/:slug returns hub payload', async () => {
    const { res, json } = await jsonRoute<{ data: { league: { slug: string } } }>(leagueRoutes, '/la-liga');
    expect(res.status).toBe(200);
    expect(json.data.league.slug).toBe('la-liga');
  });

  it('GET /api/leagues/unknown returns 404', async () => {
    const { res } = await jsonRoute(leagueRoutes, '/serie-a');
    expect(res.status).toBe(404);
  });

  it('buildLeagueHubPayload returns null for World Cup slug', async () => {
    const env = createMockEnv();
    expect(await buildLeagueHubPayload(env, 'world-cup-2026')).toBeNull();
  });

  it('buildLeagueCatalogPayload counts live matches', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('GROUP BY status')) {
            return { results: [{ status: 'live', n: 2 }, { status: 'scheduled', n: 3 }] };
          }
          return { results: [] };
        },
      }),
    });
    const payload = await buildLeagueCatalogPayload(env);
    expect(payload.leagues.every((l) => l.liveCount === 2)).toBe(true);
  });
});

describe('syncLeague mock sources', () => {
  it('upserts mock matches and standings when MOCK_SOURCES=true', async () => {
    const run = vi.fn(async () => ({ success: true }));
    const env = createMockEnv({
      MOCK_SOURCES: 'true',
      DB: createMockDb({
        run: () => {
          void run();
          return { success: true };
        },
      }),
    });
    const league = getLeagueBySlug('v-league-1')!;
    const result = await syncLeague(env, league);
    expect(result.source).toBe('mock');
    expect(result.matchesUpserted).toBeGreaterThan(0);
    expect(result.standingsUpserted).toBeGreaterThan(0);
  });
});
