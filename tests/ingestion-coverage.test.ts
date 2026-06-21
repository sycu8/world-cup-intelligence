import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchEspnMatchSummary,
  fetchEspnTeamMatchStats,
  resolveEspnEventId,
} from '../src/ingestion/espn/espnStatsClient';
import {
  parseEspnBoxscoreTeams,
  parseEspnTeamStats,
} from '../src/ingestion/espn/parseEspnStats';
import {
  fetchFifaGamedayTeamMatchStats,
  fetchFifaGamedayToken,
  resetFifaGamedayTokenCache,
} from '../src/ingestion/fifa/fifaGamedayClient';
import {
  mapFifaPlayerPosition,
  resolveOrCreateFifaPlayer,
} from '../src/ingestion/fifa/fifaPlayerResolve';
import {
  deriveShotsFromTimeline,
  parseFifaTimelineCommentary,
  timelinePeriodLabel,
} from '../src/ingestion/fifa/parseFifaTimeline';
import { createMockDb } from './helpers/mockEnv';

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    return handler(url);
  });
}

describe('espnStatsClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolveEspnEventId scans scoreboard dates around kickoff', async () => {
    mockFetch((url) => {
      if (url.includes('scoreboard')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                id: '760416',
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'home', team: { displayName: 'Canada' } },
                      { homeAway: 'away', team: { displayName: 'Bosnia-Herzegovina' } },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    });
    const eventId = await resolveEspnEventId(
      'Canada',
      'Bosnia and Herzegovina',
      '2026-06-12T18:00:00Z',
    );
    expect(eventId).toBe('760416');
  });

  it('fetchEspnMatchSummary returns null on HTTP error', async () => {
    mockFetch(() => new Response('fail', { status: 500 }));
    expect(await fetchEspnMatchSummary('760416')).toBeNull();
  });

  it('fetchEspnTeamMatchStats maps boxscore stats', async () => {
    mockFetch((url) => {
      if (url.includes('scoreboard')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                id: '760416',
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'home', team: { displayName: 'Mexico' } },
                      { homeAway: 'away', team: { displayName: 'South Africa' } },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/summary?event=')) {
        return new Response(
          JSON.stringify({
            boxscore: {
              teams: [
                {
                  team: { displayName: 'Mexico' },
                  statistics: [
                    { name: 'possessionPct', displayValue: '58' },
                    { name: 'totalShots', displayValue: '12' },
                    { name: 'shotsOnTarget', displayValue: '5' },
                    { name: 'totalPasses', displayValue: '420' },
                    { name: 'passPct', displayValue: '0.82' },
                  ],
                },
                {
                  team: { displayName: 'South Africa' },
                  statistics: [
                    { name: 'possessionPct', displayValue: '42' },
                    { name: 'totalShots', displayValue: '8' },
                    { name: 'shotsOnTarget', displayValue: '2' },
                    { name: 'totalPasses', displayValue: '310' },
                    { name: 'passPct', displayValue: '0.75' },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    });

    const stats = await fetchEspnTeamMatchStats(
      'Mexico',
      'South Africa',
      '2026-06-11T19:00:00Z',
    );
    expect(stats?.eventId).toBe('760416');
    expect(stats?.home.possession).toBe(58);
    expect(stats?.away.passes).toBe(310);
  });

  it('fetchEspnTeamMatchStats returns null when core stats missing', async () => {
    mockFetch((url) => {
      if (url.includes('scoreboard')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                id: '1',
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'home', team: { displayName: 'A' } },
                      { homeAway: 'away', team: { displayName: 'B' } },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          boxscore: {
            teams: [
              {
                team: { displayName: 'A' },
                statistics: [{ name: 'possessionPct', displayValue: '0' }],
              },
              {
                team: { displayName: 'B' },
                statistics: [{ name: 'possessionPct', displayValue: '0' }],
              },
            ],
          },
        }),
        { status: 200 },
      );
    });
    expect(await fetchEspnTeamMatchStats('A', 'B', '2026-06-11T19:00:00Z')).toBeNull();
  });

  it('fetchEspnTeamMatchStats returns null when the summary has fewer than two team rows', async () => {
    mockFetch((url) => {
      if (url.includes('scoreboard')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                id: 'solo',
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'home', team: { displayName: 'A' } },
                      { homeAway: 'away', team: { displayName: 'B' } },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ boxscore: { teams: [{ team: { displayName: 'A' }, statistics: [] }] } }), {
        status: 200,
      });
    });
    await expect(fetchEspnTeamMatchStats('A', 'B', '2026-06-11T19:00:00Z')).resolves.toBeNull();
  });

  it('fetchEspnTeamMatchStats returns null when matched rows have no statistics', async () => {
    mockFetch((url) => {
      if (url.includes('scoreboard')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                id: 'nostats',
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'home', team: { displayName: 'A' } },
                      { homeAway: 'away', team: { displayName: 'B' } },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          boxscore: {
            teams: [
              { team: { displayName: 'A' }, statistics: [] },
              { team: { displayName: 'B' }, statistics: [] },
            ],
          },
        }),
        { status: 200 },
      );
    });
    await expect(fetchEspnTeamMatchStats('A', 'B', '2026-06-11T19:00:00Z')).resolves.toBeNull();
  });

  it('fetchEspnTeamMatchStats falls back to requested team names when display names are missing', async () => {
    mockFetch((url) => {
      if (url.includes('scoreboard')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                id: 'swap-home-fallback',
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'home', team: { displayName: 'Mexico' } },
                      { homeAway: 'away', team: { displayName: 'South Africa' } },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          boxscore: {
            teams: [
              {
                team: { displayName: 'South Africa' },
                statistics: [
                  { name: 'possessionPct', displayValue: '41' },
                  { name: 'totalPasses', displayValue: '305' },
                ],
              },
              {
                team: {},
                statistics: [
                  { name: 'possessionPct', displayValue: '59' },
                  { name: 'totalPasses', displayValue: '430' },
                ],
              },
            ],
          },
        }),
        { status: 200 },
      );
    });

    const stats = await fetchEspnTeamMatchStats('Mexico', 'South Africa', '2026-06-11T19:00:00Z');
    expect(stats?.homeEspnName).toBe('Mexico');
    expect(stats?.awayEspnName).toBe('South Africa');
    expect(stats?.home.passes).toBe(430);
  });

  it('fetchEspnTeamMatchStats returns null when summary is missing or core stats are undefined', async () => {
    mockFetch((url) => {
      if (url.includes('scoreboard')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                id: 'missing-summary',
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'home', team: { displayName: 'Mexico' } },
                      { homeAway: 'away', team: { displayName: 'South Africa' } },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    await expect(fetchEspnTeamMatchStats('Mexico', 'South Africa', '2026-06-11T19:00:00Z')).resolves.toBeNull();

    mockFetch((url) => {
      if (url.includes('scoreboard')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                id: 'undefined-core',
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'home', team: { displayName: 'Mexico' } },
                      { homeAway: 'away', team: { displayName: 'South Africa' } },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          boxscore: {
            teams: [
              { team: { displayName: 'Mexico' }, statistics: [{ name: 'shotsOnTarget', displayValue: '4' }] },
              { team: { displayName: 'South Africa' }, statistics: [{ name: 'shotsOnTarget', displayValue: '2' }] },
            ],
          },
        }),
        { status: 200 },
      );
    });
    await expect(fetchEspnTeamMatchStats('Mexico', 'South Africa', '2026-06-11T19:00:00Z')).resolves.toBeNull();
  });

  it('fetchEspnTeamMatchStats swaps team rows and falls back to away request name when needed', async () => {
    mockFetch((url) => {
      if (url.includes('scoreboard')) {
        return new Response(
          JSON.stringify({
            events: [
              {
                id: 'swap-away-fallback',
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'home', team: { displayName: 'Mexico' } },
                      { homeAway: 'away', team: { displayName: 'South Africa' } },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          boxscore: {
            teams: [
              {
                team: { displayName: 'South Africa' },
                statistics: [
                  { name: 'possessionPct', displayValue: '44' },
                  { name: 'totalPasses', displayValue: '320' },
                ],
              },
              {
                team: {},
                statistics: [
                  { name: 'possessionPct', displayValue: '56' },
                  { name: 'totalPasses', displayValue: '410' },
                ],
              },
            ],
          },
        }),
        { status: 200 },
      );
    });
    const stats = await fetchEspnTeamMatchStats('Mexico', 'South Africa', '2026-06-11T19:00:00Z');
    expect(stats?.home.passes).toBe(410);
    expect(stats?.awayEspnName).toBe('South Africa');
  });
});

describe('parseEspnStats extensions', () => {
  it('derives pass accuracy from accuratePasses when passPct missing', () => {
    const stats = parseEspnTeamStats([
      { name: 'totalPasses', displayValue: '400' },
      { name: 'accuratePasses', displayValue: '320' },
    ]);
    expect(stats.passAccuracy).toBe(80);
  });

  it('parseEspnBoxscoreTeams maps named teams', () => {
    const parsed = parseEspnBoxscoreTeams(
      {
        boxscore: {
          teams: [
            {
              team: { displayName: 'Mexico' },
              statistics: [{ name: 'totalShots', displayValue: '10' }],
            },
            {
              team: { displayName: 'South Africa' },
              statistics: [{ name: 'totalShots', displayValue: '6' }],
            },
          ],
        },
      },
      'Mexico',
      'South Africa',
    );
    expect(parsed.home?.shots).toBe(10);
    expect(parsed.away?.shots).toBe(6);
  });
});

describe('fifaGamedayClient', () => {
  beforeEach(() => {
    resetFifaGamedayTokenCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetFifaGamedayTokenCache();
  });

  it('fetchFifaGamedayToken caches JWT until expiry', async () => {
    const fetchMock = mockFetch((url) => {
      if (url.includes('/token')) {
        return new Response(
          JSON.stringify({ token: 'jwt-abc', expiresAt: new Date(Date.now() + 3600_000).toISOString() }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    });
    expect(await fetchFifaGamedayToken()).toBe('jwt-abc');
    expect(await fetchFifaGamedayToken()).toBe('jwt-abc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetchFifaGamedayTeamMatchStats parses teams payload', async () => {
    mockFetch((url) => {
      if (url.includes('/token')) {
        return new Response(JSON.stringify({ token: 'jwt-abc' }), { status: 200 });
      }
      if (url.includes('/teams.json')) {
        return new Response(
          JSON.stringify({
            '43822': [
              ['Possession', 55, false],
              ['AttemptAtGoal', 12, false],
            ],
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    });
    const teams = await fetchFifaGamedayTeamMatchStats('400021443');
    expect(teams).toHaveLength(1);
    expect(teams?.[0]?.idTeam).toBe('43822');
  });

  it('returns null when token request fails', async () => {
    mockFetch(() => new Response('fail', { status: 500 }));
    expect(await fetchFifaGamedayToken()).toBeNull();
    expect(await fetchFifaGamedayTeamMatchStats('400021443')).toBeNull();
  });
});

describe('fifaPlayerResolve', () => {
  it('mapFifaPlayerPosition defaults unknown codes to CM', () => {
    expect(mapFifaPlayerPosition(99)).toBe('CM');
    expect(mapFifaPlayerPosition(undefined)).toBe('CM');
  });

  it('resolveOrCreateFifaPlayer inserts new player row', async () => {
    const runCalls: string[] = [];
    const db = createMockDb({
      first: () => null,
      run: (sql) => {
        runCalls.push(sql);
        return { success: true };
      },
    });
    const id = await resolveOrCreateFifaPlayer(db, 'team-mex', 'MEX', {
      IdPlayer: '12345',
      PlayerName: [{ Locale: 'en-GB', Description: 'Test Player' }],
      Position: 3,
    });
    expect(id).toBe('p-fifa-12345');
    expect(runCalls.some((sql) => sql.includes('INSERT INTO players'))).toBe(true);
  });

  it('resolveOrCreateFifaPlayer updates existing row', async () => {
    const runCalls: string[] = [];
    const db = createMockDb({
      first: () => ({ id: 'p-fifa-12345' }),
      run: (sql) => {
        runCalls.push(sql);
        return { success: true };
      },
    });
    const id = await resolveOrCreateFifaPlayer(db, 'team-mex', 'MEX', {
      IdPlayer: '12345',
      ShortName: [{ Locale: 'en-GB', Description: 'Updated Name' }],
      Position: 1,
    });
    expect(id).toBe('p-fifa-12345');
    expect(runCalls.some((sql) => sql.includes('UPDATE players SET'))).toBe(true);
  });

  it('returns null when FIFA id or name missing', async () => {
    const db = createMockDb();
    expect(await resolveOrCreateFifaPlayer(db, 'team-mex', null, {})).toBeNull();
    expect(
      await resolveOrCreateFifaPlayer(db, 'team-mex', null, {
        IdPlayer: '999',
        PlayerName: [],
      }),
    ).toBeNull();
  });
});

describe('parseFifaTimeline extensions', () => {
  it('timelinePeriodLabel covers extra period codes', () => {
    expect(timelinePeriodLabel(4)).toBe('HT');
    expect(timelinePeriodLabel(6)).toBe('ET1');
    expect(timelinePeriodLabel(7)).toBe('ET2');
    expect(timelinePeriodLabel(8)).toBe('PEN');
    expect(timelinePeriodLabel(undefined)).toBe('PRE');
  });

  it('parseFifaTimelineCommentary skips empty text and unknown labels', () => {
    const lines = parseFifaTimelineCommentary(
      {
        Event: [
          {
            EventId: '1',
            TypeLocalized: [{ Locale: 'en-GB', Description: 'Yellow Card' }],
            EventDescription: [{ Locale: 'en-GB', Description: 'Booking' }],
          },
          {
            EventId: '2',
            TypeLocalized: [{ Locale: 'en-GB', Description: 'Goal!' }],
            EventDescription: [{ Locale: 'en-GB', Description: '   ' }],
          },
          {
            EventId: '3',
            TypeLocalized: [{ Locale: 'en-GB', Description: 'Penalty' }],
            EventDescription: [{ Locale: 'en-GB', Description: 'Penalty awarded' }],
          },
        ],
      },
      'm-x',
    );
    expect(lines).toHaveLength(2);
    expect(lines.some((l) => l.eventType === 'penalty')).toBe(true);
  });

  it('deriveShotsFromTimeline ignores teams outside home/away ids', () => {
    const counts = deriveShotsFromTimeline(
      {
        Event: [
          {
            IdTeam: 'other',
            TypeLocalized: [{ Locale: 'en-GB', Description: 'Attempt at Goal' }],
            EventDescription: [{ Locale: 'en-GB', Description: 'Shot on target' }],
            GoalGatePositionX: 1,
          },
        ],
      },
      'home-id',
      'away-id',
    );
    expect(counts.homeShots).toBe(0);
    expect(counts.awayShots).toBe(0);
  });
});
