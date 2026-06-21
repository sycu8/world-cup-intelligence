import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  syncFifaWc2026Matches,
  syncFifaMatchByRef,
  shouldSyncFifaMatch,
  needsFullFifaMatchInfo,
} from '../src/ingestion/fifa/fifaLiveSync';
import { createIngestionEnv } from './helpers/ingestionMockDb';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './helpers/fixtures';
import { WC2026_COMPETITION_ID } from '../src/ingestion/fifa/constants';
import type { FifaCalendarMatch, FifaMatchInfo } from '../src/ingestion/fifa/fifaApiClient';

const kickoff = FIXTURE_MATCH.kickoff_utc!;

const calendarRow = (overrides: Partial<FifaCalendarMatch> = {}): FifaCalendarMatch =>
  ({
    IdMatch: '400021443',
    IdCompetition: WC2026_COMPETITION_ID,
    MatchNumber: 1,
    Date: kickoff,
    MatchTime: "55'",
    MatchStatus: 3,
    Period: 5,
    HomeTeamScore: 1,
    AwayTeamScore: 0,
    Home: { IdCountry: 'MEX', TeamName: [{ Locale: 'en-GB', Description: 'Mexico' }] },
    Away: { IdCountry: 'RSA', TeamName: [{ Locale: 'en-GB', Description: 'South Africa' }] },
    ...overrides,
  }) as FifaCalendarMatch;

const matchInfo = (overrides: Partial<FifaMatchInfo> = {}): FifaMatchInfo =>
  ({
    ...calendarRow(),
    HomeTeam: {
      IdTeam: '43822',
      Score: 2,
      Players: [
        { IdPlayer: 'p1', ShirtNumber: 10, Status: 1 },
        ...Array.from({ length: 10 }, (_, i) => ({
          IdPlayer: `hp${i}`,
          ShirtNumber: i + 2,
          Status: 1 as const,
        })),
      ],
      Goals: [{ IdPlayer: 'p1', Minute: "12'", Period: 3 }],
      Bookings: [
        { IdPlayer: 'p1', Minute: "30'", Period: 3, Card: 1 },
        { IdPlayer: 'hp2', Minute: "80'", Period: 5, Card: 2 },
      ],
      Substitutions: [{ IdPlayer: 'hp3', IdSubstitute: 'hp4', Minute: "70'", Period: 5 }],
    },
    AwayTeam: {
      IdTeam: '43995',
      Score: 1,
      Players: [{ IdPlayer: 'a1', ShirtNumber: 9, Status: 1 }],
      Goals: [{ IdPlayer: 'a1', Minute: "44'", Period: 3 }],
    },
    BallPossession: { OverallHome: 58, OverallAway: 42 },
    ...overrides,
  }) as FifaMatchInfo;

vi.mock('../src/ingestion/fifa/fifaApiClient', () => ({
  fetchFifaWc2026FixturesCalendar: vi.fn(),
  fetchFifaMatchInfo: vi.fn(),
  fetchFifaCalendarMatches: vi.fn(),
}));

vi.mock('../src/ingestion/fifa/fifaLiveBlogSync', () => ({
  shouldSyncFifaBlogAndStats: vi.fn(async () => true),
  syncFifaMatchBlogAndStats: vi.fn(async () => ({ commentary: 1, statsUpdated: true })),
  backfillIncompleteFifaMatchStats: vi.fn(async () => 0),
}));

vi.mock('../src/ingestion/fifa/fifaLineupSync', () => ({
  shouldSyncFifaLineupForKickoff: vi.fn(() => true),
  syncFifaMatchLineupsFromInfo: vi.fn(async () => ({ updated: true, home: true, away: false })),
}));

vi.mock('../src/services/publicApi/emitter', () => ({
  emitMatchCompleted: vi.fn(async () => undefined),
  emitMatchScoreUpdate: vi.fn(async () => undefined),
  emitMatchStatusChange: vi.fn(async () => undefined),
}));

describe('ingestion fifaLiveSync', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T20:00:00Z'));
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaWc2026FixturesCalendar).mockResolvedValue([calendarRow()]);
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(matchInfo());
    vi.mocked(api.fetchFifaCalendarMatches).mockResolvedValue([calendarRow()]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('needsFullFifaMatchInfo respects live and kickoff window', () => {
    const row = calendarRow({ Date: kickoff });
    const now = new Date('2026-06-11T21:00:00Z').getTime();
    expect(needsFullFifaMatchInfo(row, 'live', now)).toBe(true);
    expect(needsFullFifaMatchInfo(row, 'scheduled', now)).toBe(true);
    expect(needsFullFifaMatchInfo(row, 'scheduled', new Date('2026-06-01T00:00:00Z').getTime())).toBe(false);
  });

  it('syncFifaWc2026Matches applies full payload and stores R2 snapshot', async () => {
    const { env, db } = createIngestionEnv({
      matches: [
        {
          ...FIXTURE_MATCH,
          status: 'scheduled',
          minute: 0,
          home_score: 0,
          away_score: 0,
          fifa_match_id: null,
        },
      ],
    });

    const result = await syncFifaWc2026Matches(env);
    expect(result.synced).toBe(1);
    expect(result.updatedIds.length + result.completedIds.length).toBeGreaterThan(0);
    expect(env.R2_RAW.put).toHaveBeenCalled();
    expect(db.batch).toHaveBeenCalled();
    expect(env.KV.put).toHaveBeenCalledWith('meta:last_fifa_sync', expect.any(String), expect.any(Object));
  });

  it('syncFifaWc2026Matches skips rows without teams or internal match', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaWc2026FixturesCalendar).mockResolvedValue([
      calendarRow({ Home: null, Away: null }),
      calendarRow({ IdMatch: '999', Home: { IdCountry: 'BRA' }, Away: { IdCountry: 'ARG' } }),
    ]);
    const { env } = createIngestionEnv({ matches: [] });
    const result = await syncFifaWc2026Matches(env);
    expect(result.skipped).toBe(2);
    expect(result.synced).toBe(0);
  });

  it('syncFifaWc2026Matches uses calendar row path outside full-info window', async () => {
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaWc2026FixturesCalendar).mockResolvedValue([
      calendarRow({
        MatchStatus: 1,
        Period: 0,
        MatchTime: "0'",
        HomeTeamScore: 0,
        AwayTeamScore: 0,
      }),
    ]);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'scheduled' }],
    });
    const result = await syncFifaWc2026Matches(env);
    expect(result.synced).toBe(1);
    expect(api.fetchFifaMatchInfo).not.toHaveBeenCalled();
  });

  it('syncFifaWc2026Matches handles match sync errors and backfill failures', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockRejectedValue(new Error('api down'));
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.mocked(blog.backfillIncompleteFifaMatchStats).mockRejectedValue(new Error('backfill fail'));
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443' }],
    });
    const result = await syncFifaWc2026Matches(env);
    expect(result.synced).toBe(0);
  });

  it('applyFifaPayload emits completion and handles lineup/blog errors', async () => {
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.mocked(lineup.syncFifaMatchLineupsFromInfo).mockRejectedValue(new Error('lineup fail'));
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.mocked(blog.syncFifaMatchBlogAndStats).mockRejectedValue(new Error('blog fail'));
    const emitter = await import('../src/services/publicApi/emitter');

    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live', minute: 50 }],
      teamMatchStats: [],
    });
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(
      matchInfo({
        MatchStatus: 0,
        Period: 10,
        MatchTime: "90'",
        HomeTeamScore: 2,
        AwayTeamScore: 1,
        HomeTeam: { ...matchInfo().HomeTeam!, Score: 2 },
        AwayTeam: { ...matchInfo().AwayTeam!, Score: 1 },
      }),
    );

    const result = await syncFifaWc2026Matches(env);
    expect(result.completedIds).toContain(FIXTURE_MATCH.id);
    expect(emitter.emitMatchCompleted).toHaveBeenCalled();
  });

  it('syncFifaMatchByRef resolves fifa id from calendar and syncs', async () => {
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: null, status: 'live' }],
    });
    const ok = await syncFifaMatchByRef(env, FIXTURE_MATCH.id);
    expect(ok).toBe(true);
    expect(env.KV.put).toHaveBeenCalledWith(
      `meta:fifa_sync:${FIXTURE_MATCH.id}`,
      expect.any(String),
      expect.any(Object),
    );
  });

  it('syncFifaMatchByRef returns false when match missing or calendar miss', async () => {
    const { env } = createIngestionEnv({ matches: [] });
    expect(await syncFifaMatchByRef(env, 'missing')).toBe(false);

    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaCalendarMatches).mockResolvedValue([]);
    const { env: env2 } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: null }],
    });
    expect(await syncFifaMatchByRef(env2, FIXTURE_MATCH.id)).toBe(false);
  });

  it('syncFifaMatchByRef returns false when calendar rows cannot resolve team ids', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaCalendarMatches).mockResolvedValue([
      calendarRow({ Home: null, Away: { IdCountry: 'RSA', TeamName: [{ Locale: 'en-GB', Description: 'South Africa' }] } }),
    ]);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: null }],
    });
    expect(await syncFifaMatchByRef(env, FIXTURE_MATCH.id)).toBe(false);
  });

  it('syncFifaMatchByRef returns false when match info missing', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(null);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443' }],
    });
    expect(await syncFifaMatchByRef(env, FIXTURE_MATCH.id)).toBe(false);
  });

  it('syncFifaMatchByRef handles blog sync failure for live match', async () => {
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.mocked(blog.syncFifaMatchBlogAndStats).mockRejectedValue(new Error('blog'));
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live' }],
    });
    expect(await syncFifaMatchByRef(env, FIXTURE_MATCH.id)).toBe(true);
  });

  it('shouldSyncFifaMatch throttles live polls', async () => {
    const { env } = createIngestionEnv({}, {});
    expect(await shouldSyncFifaMatch(env, 'm-1', 'scheduled')).toBe(false);
    expect(await shouldSyncFifaMatch(env, 'm-1', 'live')).toBe(true);

    const recent = new Date(Date.now() - 5_000).toISOString();
    const { env: env2 } = createIngestionEnv({}, { 'meta:fifa_sync:m-1': recent });
    expect(await shouldSyncFifaMatch(env2, 'm-1', 'live')).toBe(false);

    const stale = new Date(Date.now() - 60_000).toISOString();
    const { env: env3 } = createIngestionEnv({}, { 'meta:fifa_sync:m-1': stale });
    expect(await shouldSyncFifaMatch(env3, 'm-1', 'live')).toBe(true);
  });

  it('syncMatchEvents skips when teams missing', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(
      matchInfo({
        HomeTeam: undefined,
        AwayTeam: undefined,
        BallPossession: null,
      }),
    );
    const { env, db } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443' }],
    });
    await syncFifaWc2026Matches(env);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('syncTeamStats updates existing rows and skips empty possession', async () => {
    const { env, db, teamMatchStats } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live' }],
      teamMatchStats: [
        {
          id: 'tms-existing',
          match_id: FIXTURE_MATCH.id,
          team_id: FIXTURE_TEAMS[0]!.id,
          possession: 50,
        },
      ],
    });
    teamMatchStats.push({
      id: 'tms-away',
      match_id: FIXTURE_MATCH.id,
      team_id: FIXTURE_TEAMS[1]!.id,
      possession: 50,
    });
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(
      matchInfo({ BallPossession: { OverallHome: 60, OverallAway: 40 } }),
    );
    await syncFifaWc2026Matches(env);
    expect(env.DB.prepare).toHaveBeenCalled();
  });

  it('applyFifaPayload detects score changes when internal scores are undefined', async () => {
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.mocked(blog.shouldSyncFifaBlogAndStats).mockResolvedValue(false);
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.mocked(lineup.shouldSyncFifaLineupForKickoff).mockReturnValue(false);
    const { env } = createIngestionEnv({
      matches: [
        {
          id: FIXTURE_MATCH.id,
          tournament_id: FIXTURE_MATCH.tournament_id,
          home_team_id: FIXTURE_MATCH.home_team_id,
          away_team_id: FIXTURE_MATCH.away_team_id,
          kickoff_utc: FIXTURE_MATCH.kickoff_utc,
          status: 'live',
          minute: 55,
          home_score: 2,
          fifa_match_id: '400021443',
        },
      ],
    });
    const result = await syncFifaWc2026Matches(env);
    expect(result.updatedIds).toContain(FIXTURE_MATCH.id);
  });

  it('syncFifaWc2026Matches tolerates undefined team and match query result arrays', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaWc2026FixturesCalendar).mockResolvedValue([calendarRow()]);
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("SELECT id, name FROM teams WHERE id LIKE")) return {} as never;
          if (sql.includes('FROM matches WHERE tournament_id = ?')) return {} as never;
          return { results: [] };
        },
      }),
      R2_RAW: { put: vi.fn(async () => undefined) } as never,
    });
    const result = await syncFifaWc2026Matches(env as never);
    expect(result.synced).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('syncFifaWc2026Matches skips unresolved team-day lookups when internal kickoff is missing', async () => {
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: null, kickoff_utc: null }],
    });
    const result = await syncFifaWc2026Matches(env);
    expect(result.synced).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('applyFifaCalendarRow updates when calendar scores change', async () => {
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaWc2026FixturesCalendar).mockResolvedValue([
      calendarRow({
        MatchStatus: 1,
        Period: 0,
        MatchTime: "0'",
        HomeTeamScore: 2,
        AwayTeamScore: 1,
      }),
    ]);
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.mocked(blog.shouldSyncFifaBlogAndStats).mockResolvedValue(false);
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.mocked(lineup.shouldSyncFifaLineupForKickoff).mockReturnValue(false);
    const { env } = createIngestionEnv({
      matches: [
        {
          ...FIXTURE_MATCH,
          fifa_match_id: '400021443',
          status: 'scheduled',
          minute: 0,
          home_score: 0,
          away_score: 0,
        },
      ],
    });
    const result = await syncFifaWc2026Matches(env);
    expect(result.updatedIds).toContain(FIXTURE_MATCH.id);
  });

  it('applyFifaCalendarRow returns unchanged when scores match', async () => {
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaWc2026FixturesCalendar).mockResolvedValue([
      calendarRow({
        MatchStatus: 1,
        Period: 0,
        MatchTime: "0'",
        HomeTeamScore: 0,
        AwayTeamScore: 0,
      }),
    ]);
    const { env } = createIngestionEnv({
      matches: [
        {
          ...FIXTURE_MATCH,
          fifa_match_id: '400021443',
          status: 'scheduled',
          minute: 0,
          home_score: 0,
          away_score: 0,
        },
      ],
    });
    const result = await syncFifaWc2026Matches(env);
    expect(result.updatedIds).toHaveLength(0);
  });

  it('applyFifaPayload emits score update when minute changes', async () => {
    const emitter = await import('../src/services/publicApi/emitter');
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.mocked(blog.shouldSyncFifaBlogAndStats).mockResolvedValue(false);
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.mocked(lineup.shouldSyncFifaLineupForKickoff).mockReturnValue(false);

    const { env } = createIngestionEnv({
      matches: [
        {
          ...FIXTURE_MATCH,
          fifa_match_id: '400021443',
          status: 'live',
          minute: 40,
          home_score: 0,
          away_score: 0,
        },
      ],
    });
    await syncFifaWc2026Matches(env);
    expect(emitter.emitMatchScoreUpdate).toHaveBeenCalled();
  });

  it('applyFifaPayload emits status change when transitioning to live', async () => {
    const emitter = await import('../src/services/publicApi/emitter');
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.mocked(blog.shouldSyncFifaBlogAndStats).mockResolvedValue(false);
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.mocked(lineup.shouldSyncFifaLineupForKickoff).mockReturnValue(false);

    const { env } = createIngestionEnv({
      matches: [
        {
          ...FIXTURE_MATCH,
          fifa_match_id: '400021443',
          status: 'scheduled',
          minute: 0,
          home_score: 0,
          away_score: 0,
        },
      ],
    });
    await syncFifaWc2026Matches(env);
    expect(emitter.emitMatchStatusChange).toHaveBeenCalled();
  });

  it('syncMatchEvents skips players without shirt numbers and ingests red cards', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.mocked(blog.shouldSyncFifaBlogAndStats).mockResolvedValue(false);
    vi.mocked(lineup.shouldSyncFifaLineupForKickoff).mockReturnValue(false);
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(
      matchInfo({
        HomeTeam: {
          ...matchInfo().HomeTeam!,
          Players: [{ IdPlayer: 'p-red', ShirtNumber: 5, Status: 1 }],
          Goals: [{ IdPlayer: 'p-missing', Minute: "12'", Period: 3 }],
          Bookings: [{ IdPlayer: 'p-red', Minute: "70'", Period: 5, Card: 2 }],
        },
        BallPossession: { OverallHome: 60, OverallAway: null },
      }),
    );
    const { env, db } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live' }],
      teamMatchStats: [],
    });
    await syncFifaWc2026Matches(env);
    expect(db.batch).toHaveBeenCalled();
  });

  it('applyFifaPayload skips completion emit when already completed', async () => {
    const emitter = await import('../src/services/publicApi/emitter');
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.mocked(blog.shouldSyncFifaBlogAndStats).mockResolvedValue(false);
    vi.mocked(lineup.shouldSyncFifaLineupForKickoff).mockReturnValue(false);
    vi.mocked(emitter.emitMatchCompleted).mockClear();

    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(
      matchInfo({
        MatchStatus: 0,
        Period: 10,
        MatchTime: "90'",
        HomeTeamScore: 2,
        AwayTeamScore: 1,
      }),
    );

    const { env } = createIngestionEnv({
      matches: [
        {
          ...FIXTURE_MATCH,
          fifa_match_id: '400021443',
          status: 'completed',
          minute: 90,
          home_score: 2,
          away_score: 1,
        },
      ],
    });
    await syncFifaWc2026Matches(env);
    expect(emitter.emitMatchCompleted).not.toHaveBeenCalled();
  });

  it('syncFifaWc2026Matches falls back to the calendar row when full match info is unavailable', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(null);
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.mocked(blog.shouldSyncFifaBlogAndStats).mockResolvedValue(false);
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.mocked(lineup.shouldSyncFifaLineupForKickoff).mockReturnValue(false);

    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live', minute: 50 }],
    });
    const result = await syncFifaWc2026Matches(env);
    expect(result.synced).toBe(1);
    expect(env.R2_RAW.put).toHaveBeenCalled();
  });

  it('applyFifaPayload tolerates missing player lists and partial possession updates', async () => {
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.mocked(blog.shouldSyncFifaBlogAndStats).mockResolvedValue(false);
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    vi.mocked(lineup.shouldSyncFifaLineupForKickoff).mockReturnValue(false);
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(
      matchInfo({
        HomeTeam: {
          ...matchInfo().HomeTeam!,
          Players: undefined,
          Goals: undefined,
          Bookings: [{ IdPlayer: undefined, Minute: "55'", Period: 5, Card: 1 }],
          Substitutions: [{ IdPlayer: undefined, IdSubstitute: undefined, Minute: "60'", Period: 5 }],
        },
        AwayTeam: {
          ...matchInfo().AwayTeam!,
          Players: undefined,
          Goals: undefined,
          Bookings: undefined,
          Substitutions: undefined,
        },
        BallPossession: { OverallHome: null, OverallAway: 41 },
      }),
    );

    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live' }],
      teamMatchStats: [],
    });
    const result = await syncFifaWc2026Matches(env);
    expect(result.updatedIds).toContain(FIXTURE_MATCH.id);
  });

  it('syncFifaMatchByRef resolves by current day when kickoff is missing', async () => {
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: null, kickoff_utc: null, status: 'live' }],
    });
    const ok = await syncFifaMatchByRef(env, FIXTURE_MATCH.id);
    expect(ok).toBe(true);
  });

  it('syncFifaMatchByRef skips blog sync for scheduled matches', async () => {
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.mocked(blog.syncFifaMatchBlogAndStats).mockClear();
    vi.mocked(blog.shouldSyncFifaBlogAndStats).mockResolvedValue(false);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'scheduled' }],
    });
    expect(await syncFifaMatchByRef(env, FIXTURE_MATCH.id)).toBe(true);
    expect(blog.syncFifaMatchBlogAndStats).not.toHaveBeenCalled();
  });

  it('syncFifaMatchByRef uses calendar score fallbacks and leaves unchanged live state without emits', async () => {
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    const lineup = await import('../src/ingestion/fifa/fifaLineupSync');
    const emitter = await import('../src/services/publicApi/emitter');
    vi.mocked(blog.shouldSyncFifaBlogAndStats).mockResolvedValue(false);
    vi.mocked(lineup.shouldSyncFifaLineupForKickoff).mockReturnValue(false);
    vi.mocked(emitter.emitMatchScoreUpdate).mockClear();
    vi.mocked(emitter.emitMatchStatusChange).mockClear();
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(
      matchInfo({
        MatchStatus: 3,
        Period: 5,
        MatchTime: "55'",
        HomeTeamScore: 1,
        AwayTeamScore: 0,
        HomeTeam: { ...matchInfo().HomeTeam!, Score: null },
        AwayTeam: { ...matchInfo().AwayTeam!, Score: null },
      }),
    );
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live', minute: 55, home_score: 1, away_score: 0 }],
    });
    expect(await syncFifaMatchByRef(env, FIXTURE_MATCH.id)).toBe(true);
    expect(emitter.emitMatchScoreUpdate).not.toHaveBeenCalled();
    expect(emitter.emitMatchStatusChange).not.toHaveBeenCalled();
  });

  it('syncFifaMatchByRef passes payload IdMatch to blog sync when local fifa id is still null', async () => {
    const blog = await import('../src/ingestion/fifa/fifaLiveBlogSync');
    vi.mocked(blog.shouldSyncFifaBlogAndStats).mockResolvedValue(true);
    vi.mocked(blog.syncFifaMatchBlogAndStats).mockClear();
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: null, status: 'live' }],
    });
    expect(await syncFifaMatchByRef(env, FIXTURE_MATCH.id)).toBe(true);
    expect(blog.syncFifaMatchBlogAndStats).toHaveBeenCalledWith(
      expect.anything(),
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      expect.anything(),
      '400021443',
    );
  });
});
