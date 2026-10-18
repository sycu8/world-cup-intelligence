import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MockMatchDataProvider,
  FootballDataProvider,
  resolveMatchDataProvider,
} from '../src/ingestion/matchDataProvider';
import { refreshMatchData, handleCompletedMatches } from '../src/ingestion/matchDataRefresh';
import { createIngestionEnv } from './helpers/ingestionMockDb';
import { FIXTURE_MATCH } from './helpers/fixtures';

vi.mock('../src/ingestion/fifa/fifaLiveSync', () => ({
  syncFifaWc2026Matches: vi.fn(async () => ({
    updatedIds: ['m-live'],
    completedIds: ['m-done'],
    teamUpdatedIds: [],
    synced: 2,
    skipped: 0,
  })),
}));

vi.mock('../src/ingestion/fifa/fifaLineupSync', () => ({
  syncFifaLineupsForUpcomingMatches: vi.fn(async () => ({
    checked: 1,
    updated: 0,
    matchIds: [],
  })),
}));

vi.mock('../src/services/cacheWarm', () => ({
  warmPayloadCaches: vi.fn(async () => undefined),
}));

vi.mock('../src/services/tournamentProgression', () => ({
  processMatchCompletion: vi.fn(async () => undefined),
  replayKnockoutBracketFromCompleted: vi.fn(async () => []),
}));

vi.mock('../src/services/matchLifecycle', () => ({
  mockScoreAtMinute: vi.fn(() => ({ home: 1, away: 2 })),
}));

describe('ingestion matchDataProvider', () => {
  const scoreFn = (matchId: string, minute: number) => ({ home: minute > 30 ? 2 : 1, away: 0 });

  it('MockMatchDataProvider returns live tick inside window', () => {
    const provider = new MockMatchDataProvider(scoreFn);
    const kickoff = '2026-06-11T19:00:00Z';
    const kickMs = new Date(kickoff).getTime();
    expect(provider.getLiveTick('m-1', kickoff, kickMs - 3 * 3600_000)).toBeNull();
    const live = provider.getLiveTick('m-1', kickoff, kickMs + 45 * 60_000);
    expect(live).toEqual({ minute: 45, homeScore: 2, awayScore: 0, status: 'live' });
    const done = provider.getLiveTick('m-1', kickoff, kickMs + 95 * 60_000);
    expect(done?.status).toBe('completed');
    expect(done?.minute).toBe(90);
  });

  it('FootballDataProvider always returns null', () => {
    const provider = new FootballDataProvider();
    expect(provider.name).toBe('football-data');
    expect(provider.getLiveTick('m', '2026-01-01', Date.now())).toBeNull();
  });

  it('resolveMatchDataProvider picks mock or football-data', () => {
    expect(resolveMatchDataProvider(true, scoreFn)).toBeInstanceOf(MockMatchDataProvider);
    expect(resolveMatchDataProvider(false, scoreFn)).toBeInstanceOf(FootballDataProvider);
  });
});

describe('ingestion matchDataRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T20:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses FIFA sync when live enabled', async () => {
    const { env } = createIngestionEnv();
    const { syncFifaWc2026Matches } = await import('../src/ingestion/fifa/fifaLiveSync');
    const result = await refreshMatchData(env);
    expect(syncFifaWc2026Matches).toHaveBeenCalled();
    expect(result.updatedIds).toEqual(['m-live']);
    expect(result.completedIds).toEqual(['m-done']);
    expect(env.KV.put).toHaveBeenCalledWith('meta:last_data_refresh', expect.any(String), expect.any(Object));
  });

  it('runs mock tick path when FIFA live disabled', async () => {
    const kickoff = FIXTURE_MATCH.kickoff_utc!;
    const { env } = createIngestionEnv({
      matches: [
        {
          ...FIXTURE_MATCH,
          status: 'scheduled',
          minute: 0,
          home_score: 0,
          away_score: 0,
          kickoff_utc: kickoff,
        },
      ],
    });
    env.MOCK_SOURCES = 'true';
    env.FIFA_LIVE_ENABLED = 'false';

    const result = await refreshMatchData(env);
    expect(result.updatedIds).toContain(FIXTURE_MATCH.id);
    expect(env.KV.put).toHaveBeenCalledWith('meta:last_data_refresh', expect.any(String), expect.any(Object));
  });

  it('updates live matches when only away score differs', async () => {
    const kickoff = FIXTURE_MATCH.kickoff_utc!;
    const kickMs = new Date(kickoff).getTime();
    const nowMs = kickMs + 25 * 60_000;
    const provider = resolveMatchDataProvider(true, () => ({ home: 1, away: 2 }));
    const tick = provider.getLiveTick(FIXTURE_MATCH.id, kickoff, nowMs)!;
    const { env } = createIngestionEnv({
      matches: [
        {
          id: FIXTURE_MATCH.id,
          tournament_id: 't-2026',
          status: 'live',
          minute: 25,
          home_score: 1,
          away_score: 0,
          kickoff_utc: kickoff,
          home_team_id: FIXTURE_MATCH.home_team_id,
          away_team_id: FIXTURE_MATCH.away_team_id,
        },
      ],
    });
    env.MOCK_SOURCES = 'true';
    env.FIFA_LIVE_ENABLED = 'false';
    vi.setSystemTime(new Date(nowMs));

    const result = await refreshMatchData(env);
    expect(result.updatedIds).toContain(FIXTURE_MATCH.id);
  });

  it('updates live matches when minute is unchanged but score differs', async () => {
    const kickoff = FIXTURE_MATCH.kickoff_utc!;
    const kickMs = new Date(kickoff).getTime();
    const nowMs = kickMs + 20 * 60_000;
    const provider = resolveMatchDataProvider(true, (matchId, minute) => ({ home: minute > 0 ? 1 : 0, away: 0 }));
    const tick = provider.getLiveTick(FIXTURE_MATCH.id, kickoff, nowMs)!;
    const { env } = createIngestionEnv({
      matches: [
        {
          id: FIXTURE_MATCH.id,
          tournament_id: 't-2026',
          status: 'live',
          minute: tick.minute,
          home_score: 0,
          away_score: 0,
          kickoff_utc: kickoff,
          home_team_id: FIXTURE_MATCH.home_team_id,
          away_team_id: FIXTURE_MATCH.away_team_id,
        },
      ],
    });
    env.MOCK_SOURCES = 'true';
    env.FIFA_LIVE_ENABLED = 'false';
    vi.setSystemTime(new Date(nowMs));

    const result = await refreshMatchData(env);
    expect(result.updatedIds).toContain(FIXTURE_MATCH.id);
  });

  it('updates live matches when only the score changes', async () => {
    const kickoff = FIXTURE_MATCH.kickoff_utc!;
    const { env } = createIngestionEnv({
      matches: [
        {
          id: FIXTURE_MATCH.id,
          tournament_id: 't-2026',
          status: 'live',
          minute: 10,
          home_score: 0,
          away_score: 0,
          kickoff_utc: kickoff,
          home_team_id: FIXTURE_MATCH.home_team_id,
          away_team_id: FIXTURE_MATCH.away_team_id,
        },
      ],
    });
    env.MOCK_SOURCES = 'true';
    env.FIFA_LIVE_ENABLED = 'false';
    vi.setSystemTime(new Date(new Date(kickoff).getTime() + 20 * 60_000));

    const result = await refreshMatchData(env);
    expect(result.updatedIds).toContain(FIXTURE_MATCH.id);
  });

  it('finalizes mock matches at minute 90', async () => {
    const kickoff = '2026-06-11T18:15:00Z';
    const { env } = createIngestionEnv({
      matches: [
        {
          id: 'm-finish',
          tournament_id: 't-2026',
          status: 'live',
          minute: 89,
          home_score: 1,
          away_score: 0,
          kickoff_utc: kickoff,
          home_team_id: 'team-w26-a1',
          away_team_id: 'team-w26-a2',
        },
      ],
    });
    env.MOCK_SOURCES = 'true';
    env.FIFA_LIVE_ENABLED = 'false';
    vi.setSystemTime(new Date('2026-06-11T19:59:00Z'));

    const result = await refreshMatchData(env);
    expect(result.completedIds).toContain('m-finish');
  });

  it('handleCompletedMatches delegates to progression', async () => {
    const { env } = createIngestionEnv();
    const { processMatchCompletion } = await import('../src/services/tournamentProgression');
    await handleCompletedMatches(env, ['m-1', 'm-2']);
    expect(processMatchCompletion).toHaveBeenCalledTimes(2);
  });
});
