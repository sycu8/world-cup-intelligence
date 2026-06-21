import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncFifaMatchBlogAndStats,
  ensureFifaBlogAndStats,
  shouldSyncFifaBlogAndStats,
  backfillIncompleteFifaMatchStats,
} from '../src/ingestion/fifa/fifaLiveBlogSync';
import { createIngestionEnv } from './helpers/ingestionMockDb';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';
import type { FifaMatchInfo } from '../src/ingestion/fifa/fifaApiClient';

const matchInfo = (): FifaMatchInfo =>
  ({
    IdMatch: '400021443',
    Properties: { IdIFES: 'ifes-1' },
    HomeTeam: { IdTeam: '43822', Score: 1 },
    AwayTeam: { IdTeam: '43995', Score: 0 },
  }) as FifaMatchInfo;

vi.mock('../src/ingestion/fifa/fifaApiClient', () => ({
  fetchFifaTimeline: vi.fn(),
  fetchFifaMatchInfo: vi.fn(),
}));

vi.mock('../src/ingestion/fifa/fifaGamedayClient', () => ({
  fetchFifaGamedayTeamMatchStats: vi.fn(),
}));

vi.mock('../src/ingestion/espn/espnStatsClient', () => ({
  fetchEspnTeamMatchStats: vi.fn(),
}));

vi.mock('../src/services/publicApi/emitter', () => ({
  emitMatchCommentaryUpdated: vi.fn(async () => undefined),
  emitMatchStatsUpdated: vi.fn(async () => undefined),
}));

describe('ingestion fifaLiveBlogSync', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaTimeline).mockResolvedValue({
      IdMatch: '400021443',
      Event: [
        {
          EventId: '1',
          IdTeam: '43822',
          MatchMinute: "12'",
          Period: 3,
          TypeLocalized: [{ Locale: 'en-GB', Description: 'Attempt at Goal' }],
          EventDescription: [{ Locale: 'en-GB', Description: 'Shot on target' }],
          GoalGatePositionX: 55,
        },
        {
          EventId: '2',
          MatchMinute: "0'",
          Period: 3,
          TypeLocalized: [{ Locale: 'en-GB', Description: 'Start Time' }],
          EventDescription: [{ Locale: 'en-GB', Description: 'Kick-off' }],
        },
      ],
    });
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(matchInfo());
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.mocked(gameday.fetchFifaGamedayTeamMatchStats).mockResolvedValue([
      {
        idTeam: '43822',
        stats: [
          ['Possession', 55, false],
          ['AttemptAtGoal', 10, false],
          ['AttemptAtGoalOnTarget', 4, false],
          ['Passes', 400, false],
          ['PassesCompleted', 360, false],
        ],
      },
      {
        idTeam: '43995',
        stats: [
          ['Possession', 45, false],
          ['AttemptAtGoal', 8, false],
          ['AttemptAtGoalOnTarget', 3, false],
          ['Passes', 350, false],
          ['PassesCompleted', 300, false],
        ],
      },
    ]);
  });

  it('syncFifaMatchBlogAndStats writes commentary and gameday stats', async () => {
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live' }],
    });
    const result = await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      matchInfo(),
    );
    expect(result.commentary).toBeGreaterThan(0);
    expect(result.statsUpdated).toBe(true);
    expect(env.KV.put).toHaveBeenCalledWith(
      `meta:fifa_blog_sync:${FIXTURE_MATCH.id}`,
      expect.any(String),
      expect.any(Object),
    );
    const emitter = await import('../src/services/publicApi/emitter');
    expect(emitter.emitMatchCommentaryUpdated).toHaveBeenCalled();
    expect(emitter.emitMatchStatsUpdated).toHaveBeenCalled();
  });

  it('syncFifaMatchBlogAndStats skips when no fifa match id', async () => {
    const { env } = createIngestionEnv();
    const result = await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      { ...matchInfo(), IdMatch: '' },
      null,
    );
    expect(result).toEqual({ commentary: 0, statsUpdated: false });
  });

  it('syncFifaMatchBlogAndStats handles commentary sync failure', async () => {
    const { env, db } = createIngestionEnv();
    db.batch.mockRejectedValueOnce(new Error('batch fail'));
    const result = await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      matchInfo(),
    );
    expect(result.commentary).toBe(0);
  });

  it('syncFifaMatchBlogAndStats applies ESPN fallback when stats incomplete', async () => {
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.mocked(espn.fetchEspnTeamMatchStats).mockResolvedValue({
      eventId: 'espn-1',
      home: { possession: 52, shots: 11, shotsOnTarget: 4, passes: 410, passAccuracy: 88 },
      away: { possession: 48, shots: 9, shotsOnTarget: 3, passes: 390, passAccuracy: 85 },
    });
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.mocked(gameday.fetchFifaGamedayTeamMatchStats).mockResolvedValue(null);
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaTimeline).mockResolvedValue({ Event: [] });

    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, kickoff_utc: FIXTURE_MATCH.kickoff_utc }],
      teamMatchStats: [],
    });
    const result = await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      matchInfo(),
    );
    expect(result.statsUpdated).toBe(true);
  });

  it('syncFifaMatchBlogAndStats leaves KV untouched when commentary and stats both stay empty', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaTimeline).mockResolvedValue({ IdMatch: '400021443', Event: [] });
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.mocked(gameday.fetchFifaGamedayTeamMatchStats).mockResolvedValue(null);
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.mocked(espn.fetchEspnTeamMatchStats).mockResolvedValue(null);

    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, kickoff_utc: FIXTURE_MATCH.kickoff_utc }],
      teamMatchStats: [
        { id: 'tms-home', match_id: FIXTURE_MATCH.id, team_id: FIXTURE_MATCH.home_team_id, possession: 55, passes: 400 },
        { id: 'tms-away', match_id: FIXTURE_MATCH.id, team_id: FIXTURE_MATCH.away_team_id, possession: 45, passes: 350 },
      ],
    });

    const result = await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      matchInfo(),
    );
    expect(result).toEqual({ commentary: 0, statsUpdated: false });
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('syncFifaMatchBlogAndStats tolerates missing FIFA team ids and IFES id', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaTimeline).mockResolvedValue({
      IdMatch: '400021443',
      Event: [
        {
          EventId: '1',
          MatchMinute: "12'",
          Period: 3,
          TypeLocalized: [{ Locale: 'en-GB', Description: 'Attempt at Goal' }],
          EventDescription: [{ Locale: 'en-GB', Description: 'Shot on target' }],
          GoalGatePositionX: 55,
        },
      ],
    });
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.mocked(gameday.fetchFifaGamedayTeamMatchStats).mockResolvedValue([
      { idTeam: '43822', stats: [['Possession', 50, false]] },
    ]);
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.mocked(espn.fetchEspnTeamMatchStats).mockResolvedValue(null);

    const { env, db } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, kickoff_utc: FIXTURE_MATCH.kickoff_utc }],
      teamMatchStats: [
        { id: 'tms-home', match_id: FIXTURE_MATCH.id, team_id: FIXTURE_MATCH.home_team_id, possession: 55, passes: 400 },
        { id: 'tms-away', match_id: FIXTURE_MATCH.id, team_id: FIXTURE_MATCH.away_team_id, possession: 45, passes: 350 },
      ],
    });
    const result = await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      {
        ...matchInfo(),
        Properties: undefined,
        HomeTeam: undefined,
        AwayTeam: undefined,
      } as FifaMatchInfo,
    );
    expect(result.commentary).toBeGreaterThanOrEqual(0);
    expect(result.statsUpdated).toBe(false);
    expect(db.runCalls.some((c) => c.sql.includes('INSERT INTO team_match_stats'))).toBe(false);
  });

  it('syncFifaMatchBlogAndStats skips derived-shot and gameday updates when ids do not match', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaTimeline).mockResolvedValue({
      IdMatch: '400021443',
      Event: [
        {
          EventId: 'comment-only',
          MatchMinute: "18'",
          Period: 3,
          TypeLocalized: [{ Locale: 'en-GB', Description: 'Injury Time' }],
          EventDescription: [{ Locale: 'en-GB', Description: 'Pause in play' }],
        },
      ],
    });
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.mocked(gameday.fetchFifaGamedayTeamMatchStats).mockResolvedValue([
      { idTeam: 'other-home', stats: [['Possession', 51, false]] },
      { idTeam: 'other-away', stats: [['Possession', 49, false]] },
    ]);
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.mocked(espn.fetchEspnTeamMatchStats).mockResolvedValue(null);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, kickoff_utc: FIXTURE_MATCH.kickoff_utc }],
      teamMatchStats: [
        { id: 'tms-home', match_id: FIXTURE_MATCH.id, team_id: FIXTURE_MATCH.home_team_id, possession: 60, passes: 500 },
        { id: 'tms-away', match_id: FIXTURE_MATCH.id, team_id: FIXTURE_MATCH.away_team_id, possession: 40, passes: 350 },
      ],
    });
    const result = await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      matchInfo(),
    );
    expect(result.commentary).toBeGreaterThanOrEqual(0);
    expect(result.statsUpdated).toBe(false);
  });

  it('tryEspnStatsFallback returns false without kickoff or team names', async () => {
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.mocked(espn.fetchEspnTeamMatchStats).mockResolvedValue(null);
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.mocked(gameday.fetchFifaGamedayTeamMatchStats).mockResolvedValue(null);
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaTimeline).mockResolvedValue({ Event: [] });

    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, kickoff_utc: null }],
    });
    const result = await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      matchInfo(),
    );
    expect(result.statsUpdated).toBe(false);
  });

  it('tryEspnStatsFallback returns false when one team name is missing from D1', async () => {
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.mocked(espn.fetchEspnTeamMatchStats).mockResolvedValue(null);
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.mocked(gameday.fetchFifaGamedayTeamMatchStats).mockResolvedValue(null);
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaTimeline).mockResolvedValue({ Event: [] });

    const { env } = createIngestionEnv({
      teams: [{ id: FIXTURE_MATCH.home_team_id, name: 'Mexico' }],
      matches: [{ ...FIXTURE_MATCH, kickoff_utc: FIXTURE_MATCH.kickoff_utc }],
      teamMatchStats: [],
    });
    const result = await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      matchInfo(),
    );
    expect(result.statsUpdated).toBe(false);
  });

  it('upsertTeamMatchStats updates existing rows via ESPN fallback', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaTimeline).mockResolvedValue({ Event: [] });
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.mocked(gameday.fetchFifaGamedayTeamMatchStats).mockResolvedValue(null);
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.mocked(espn.fetchEspnTeamMatchStats).mockResolvedValue({
      eventId: 'espn-2',
      home: { possession: 52, shots: 11, shotsOnTarget: 4, passes: 410, passAccuracy: 88 },
      away: { possession: 48, shots: 9, shotsOnTarget: 3, passes: 390, passAccuracy: 85 },
    });
    const { env, db } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, kickoff_utc: FIXTURE_MATCH.kickoff_utc }],
      teamMatchStats: [
        {
          id: 'tms-home',
          match_id: FIXTURE_MATCH.id,
          team_id: FIXTURE_MATCH.home_team_id,
          possession: 0,
          passes: 0,
        },
        {
          id: 'tms-away',
          match_id: FIXTURE_MATCH.id,
          team_id: FIXTURE_MATCH.away_team_id,
          possession: 0,
          passes: 0,
        },
      ],
    });
    await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      matchInfo(),
    );
    expect(db.runCalls.some((c) => c.sql.includes('UPDATE team_match_stats SET'))).toBe(true);
  });

  it('syncFifaMatchBlogAndStats handles null timeline and null stat patches', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaTimeline).mockResolvedValue(null);
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.mocked(gameday.fetchFifaGamedayTeamMatchStats).mockResolvedValue([
      {
        idTeam: '43822',
        stats: [['Possession', 55, false]],
      },
      {
        idTeam: '43995',
        stats: [['Possession', 45, false]],
      },
    ]);
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.mocked(espn.fetchEspnTeamMatchStats).mockResolvedValue(null);
    const { env } = createIngestionEnv({ teamMatchStats: [] });
    const result = await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      matchInfo(),
    );
    expect(result.commentary).toBe(0);
  });

  it('shouldSyncFifaBlogAndStats returns true when KV cursor missing', async () => {
    const { env } = createIngestionEnv({ teamMatchStats: [] });
    expect(await shouldSyncFifaBlogAndStats(env, FIXTURE_MATCH.id, 'live')).toBe(true);
  });

  it('upsertTeamMatchStats inserts new rows when none exist', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaTimeline).mockResolvedValue({ Event: [] });
    const gameday = await import('../src/ingestion/fifa/fifaGamedayClient');
    vi.mocked(gameday.fetchFifaGamedayTeamMatchStats).mockResolvedValue([
      {
        idTeam: '43822',
        stats: [['Possession', 50, false], ['Passes', 300, false], ['PassesCompleted', 270, false]],
      },
    ]);
    const espn = await import('../src/ingestion/espn/espnStatsClient');
    vi.mocked(espn.fetchEspnTeamMatchStats).mockResolvedValue(null);
    const { env } = createIngestionEnv({ teamMatchStats: [] });
    const result = await syncFifaMatchBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      matchInfo(),
    );
    expect(result.statsUpdated).toBe(true);
  });

  it('shouldSyncFifaBlogAndStats respects status and KV throttle', async () => {
    const { env } = createIngestionEnv({ teamMatchStats: [] });
    expect(await shouldSyncFifaBlogAndStats(env, FIXTURE_MATCH.id, 'scheduled')).toBe(false);
    expect(await shouldSyncFifaBlogAndStats(env, FIXTURE_MATCH.id, 'live')).toBe(true);

    const recent = new Date(Date.now() - 5_000).toISOString();
    const { env: env2 } = createIngestionEnv(
      {
        teamMatchStats: [
          {
            match_id: FIXTURE_MATCH.id,
            team_id: FIXTURE_MATCH.home_team_id,
            possession: 50,
            passes: 300,
          },
          {
            match_id: FIXTURE_MATCH.id,
            team_id: FIXTURE_MATCH.away_team_id,
            possession: 50,
            passes: 280,
          },
        ],
      },
      { [`meta:fifa_blog_sync:${FIXTURE_MATCH.id}`]: recent },
    );
    expect(await shouldSyncFifaBlogAndStats(env2, FIXTURE_MATCH.id, 'live')).toBe(false);
  });

  it('shouldSyncFifaBlogAndStats loads team ids from DB when omitted', async () => {
    const { env } = createIngestionEnv({ teamMatchStats: [] });
    expect(
      await shouldSyncFifaBlogAndStats(env, FIXTURE_MATCH.id, 'completed', undefined, undefined),
    ).toBe(true);
  });

  it('shouldSyncFifaBlogAndStats applies the longer completed-match throttle window', async () => {
    const recent = new Date(Date.now() - 30_000).toISOString();
    const stale = new Date(Date.now() - 180_000).toISOString();
    const state = {
      teamMatchStats: [
        {
          match_id: FIXTURE_MATCH.id,
          team_id: FIXTURE_MATCH.home_team_id,
          possession: 50,
          passes: 300,
        },
        {
          match_id: FIXTURE_MATCH.id,
          team_id: FIXTURE_MATCH.away_team_id,
          possession: 50,
          passes: 280,
        },
      ],
    };
    const { env: recentEnv } = createIngestionEnv(state, {
      [`meta:fifa_blog_sync:${FIXTURE_MATCH.id}`]: recent,
    });
    const { env: staleEnv } = createIngestionEnv(state, {
      [`meta:fifa_blog_sync:${FIXTURE_MATCH.id}`]: stale,
    });

    await expect(shouldSyncFifaBlogAndStats(recentEnv, FIXTURE_MATCH.id, 'completed')).resolves.toBe(false);
    await expect(shouldSyncFifaBlogAndStats(staleEnv, FIXTURE_MATCH.id, 'completed')).resolves.toBe(true);
  });

  it('shouldSyncFifaBlogAndStats returns false when match row missing', async () => {
    const { env } = createIngestionEnv({ matches: [] });
    expect(await shouldSyncFifaBlogAndStats(env, 'missing', 'live')).toBe(false);
  });

  it('ensureFifaBlogAndStats skips when complete or wrong status', async () => {
    const { env } = createIngestionEnv({
      matchCommentary: [{ match_id: FIXTURE_MATCH.id }],
      teamMatchStats: [
        {
          match_id: FIXTURE_MATCH.id,
          team_id: FIXTURE_MATCH.home_team_id,
          possession: 50,
          passes: 300,
        },
        {
          match_id: FIXTURE_MATCH.id,
          team_id: FIXTURE_MATCH.away_team_id,
          possession: 50,
          passes: 280,
        },
      ],
    });
    await ensureFifaBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      '400021443',
      'completed',
    );
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    expect(api.fetchFifaMatchInfo).not.toHaveBeenCalled();
  });

  it('ensureFifaBlogAndStats pulls when commentary missing', async () => {
    const { env } = createIngestionEnv({ teamMatchStats: [] });
    await ensureFifaBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      '400021443',
      'live',
    );
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    expect(api.fetchFifaMatchInfo).toHaveBeenCalled();
  });

  it('ensureFifaBlogAndStats returns early without fifa id', async () => {
    const { env } = createIngestionEnv();
    await ensureFifaBlogAndStats(env, FIXTURE_MATCH.id, 'h', 'a', null, 'live');
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    expect(api.fetchFifaMatchInfo).not.toHaveBeenCalled();
  });

  it('ensureFifaBlogAndStats exits when FIFA match info cannot be fetched', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValueOnce(null);
    const { env } = createIngestionEnv({ teamMatchStats: [] });
    await ensureFifaBlogAndStats(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      '400021443',
      'live',
    );
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('backfillIncompleteFifaMatchStats syncs candidates', async () => {
    const { env } = createIngestionEnv({
      matches: [
        {
          ...FIXTURE_MATCH,
          fifa_match_id: '400021443',
          status: 'completed',
        },
      ],
      teamMatchStats: [],
    });
    const synced = await backfillIncompleteFifaMatchStats(env, 4);
    expect(synced).toBe(1);
  });

  it('backfillIncompleteFifaMatchStats skips rows when FIFA info is unavailable', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValueOnce(null);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'completed' }],
      teamMatchStats: [],
    });
    await expect(backfillIncompleteFifaMatchStats(env, 1)).resolves.toBe(0);
  });

  it('backfillIncompleteFifaMatchStats handles sync errors', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(null);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live' }],
    });
    expect(await backfillIncompleteFifaMatchStats(env)).toBe(0);
  });

  it('backfillIncompleteFifaMatchStats catches per-row failures', async () => {
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaTimeline).mockRejectedValueOnce(new Error('timeline fail'));
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, fifa_match_id: '400021443', status: 'live' }],
    });
    expect(await backfillIncompleteFifaMatchStats(env)).toBe(0);
  });

  it('backfillIncompleteFifaMatchStats handles undefined result arrays', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('FROM matches m')) return {} as never;
          return { results: [] };
        },
      }),
    });
    expect(await backfillIncompleteFifaMatchStats(env as never)).toBe(0);
  });
});
