import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  countFifaStarters,
  isFifaLineupReady,
  shouldSyncFifaLineupForKickoff,
  isPreKickoffLineupWindow,
  syncFifaMatchLineupsFromInfo,
  syncFifaMatchLineupsByRef,
  syncFifaLineupsForUpcomingMatches,
} from '../src/ingestion/fifa/fifaLineupSync';
import { createIngestionEnv } from './helpers/ingestionMockDb';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';
import type { FifaMatchInfo } from '../src/ingestion/fifa/fifaApiClient';
import * as lineupsRepo from '../src/db/repositories/lineupsRepo';

const starter = (id: string, num: number) => ({
  IdPlayer: id,
  ShirtNumber: num,
  Status: 1,
  Position: 1,
  PlayerName: [{ Locale: 'en-GB', Description: `Player ${num}` }],
});

const bench = (id: string, num: number) => ({
  IdPlayer: id,
  ShirtNumber: num,
  Status: 2,
  Position: 2,
  PlayerName: [{ Locale: 'en-GB', Description: `Sub ${num}` }],
});

const lineupInfo = (): FifaMatchInfo =>
  ({
    IdMatch: '400021443',
    HomeTeam: {
      IdTeam: '43822',
      Tactics: '4-3-3',
      Players: Array.from({ length: 11 }, (_, i) => starter(`h${i}`, i + 1)).concat([
        bench('hb1', 20),
      ]),
    },
    AwayTeam: {
      IdTeam: '43995',
      Tactics: '',
      Players: Array.from({ length: 11 }, (_, i) => starter(`a${i}`, i + 1)),
    },
  }) as FifaMatchInfo;

vi.mock('../src/ingestion/fifa/fifaApiClient', () => ({
  fetchFifaMatchInfo: vi.fn(),
}));

vi.mock('../src/ingestion/fifa/fifaPlayerResolve', () => ({
  resolveOrCreateFifaPlayer: vi.fn(async (_db, _team, _nat, fp: { IdPlayer?: string }) =>
    fp.IdPlayer ? `p-fifa-${fp.IdPlayer}` : null,
  ),
  mapFifaPlayerPosition: vi.fn(() => 'CM'),
}));

vi.mock('../src/services/officialLineupSync', () => ({
  applyOfficialLineupToMatch: vi.fn(async () => ({ updated: true })),
}));

vi.mock('../src/ingestion/fifa/fifaLiveSync', () => ({
  syncFifaMatchByRef: vi.fn(async () => true),
}));

describe('ingestion fifaLineupSync helpers', () => {
  const kickoff = FIXTURE_MATCH.kickoff_utc!;

  it('countFifaStarters and isFifaLineupReady', () => {
    const info = lineupInfo();
    expect(countFifaStarters(info.HomeTeam)).toBe(11);
    expect(countFifaStarters(undefined)).toBe(0);
    expect(isFifaLineupReady(info)).toBe(true);
    expect(isFifaLineupReady({ HomeTeam: { Players: [] }, AwayTeam: { Players: [] } } as FifaMatchInfo)).toBe(
      false,
    );
  });

  it('shouldSyncFifaLineupForKickoff covers live, scheduled, completed, invalid kickoff', () => {
    const kickMs = new Date(kickoff).getTime();
    expect(shouldSyncFifaLineupForKickoff(null, 'live')).toBe(true);
    expect(shouldSyncFifaLineupForKickoff(null, 'scheduled')).toBe(false);
    expect(shouldSyncFifaLineupForKickoff('invalid-date', 'scheduled')).toBe(false);
    expect(shouldSyncFifaLineupForKickoff(kickoff, 'scheduled', kickMs - 30 * 60_000)).toBe(true);
    expect(shouldSyncFifaLineupForKickoff(kickoff, 'scheduled', kickMs - 120 * 60_000)).toBe(false);
    expect(shouldSyncFifaLineupForKickoff(kickoff, 'completed', kickMs - 60 * 60_000)).toBe(true);
    expect(shouldSyncFifaLineupForKickoff(kickoff, 'postponed', kickMs)).toBe(false);
  });

  it('isPreKickoffLineupWindow flags final minutes before kickoff', () => {
    const kickMs = new Date(kickoff).getTime();
    expect(isPreKickoffLineupWindow(null)).toBe(false);
    expect(isPreKickoffLineupWindow('bad-date')).toBe(false);
    expect(isPreKickoffLineupWindow(kickoff, kickMs - 8 * 60_000)).toBe(true);
    expect(isPreKickoffLineupWindow(kickoff, kickMs - 20 * 60_000)).toBe(false);
  });
});

describe('ingestion fifaLineupSync sync paths', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T18:55:00Z'));
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(lineupInfo());
    const official = await import('../src/services/officialLineupSync');
    vi.mocked(official.applyOfficialLineupToMatch).mockResolvedValue({ updated: true });
    const playerResolve = await import('../src/ingestion/fifa/fifaPlayerResolve');
    vi.mocked(playerResolve.resolveOrCreateFifaPlayer).mockImplementation(async (_db, _team, _nat, fp) =>
      fp.IdPlayer ? `p-fifa-${fp.IdPlayer}` : null,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncFifaMatchLineupsFromInfo returns false when lineup not ready', async () => {
    const { env } = createIngestionEnv();
    const result = await syncFifaMatchLineupsFromInfo(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      { HomeTeam: { Players: [] }, AwayTeam: { Players: [] } } as FifaMatchInfo,
    );
    expect(result.updated).toBe(false);
  });

  it('syncFifaMatchLineupsFromInfo applies home and away lineups', async () => {
    const { env } = createIngestionEnv();
    const official = await import('../src/services/officialLineupSync');
    const result = await syncFifaMatchLineupsFromInfo(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      lineupInfo(),
    );
    expect(result.updated).toBe(true);
    expect(official.applyOfficialLineupToMatch).toHaveBeenCalledTimes(2);
  });

  it('syncFifaMatchLineupsFromInfo falls back for missing team country rows, shirt numbers, and tactics', async () => {
    const official = await import('../src/services/officialLineupSync');
    const info = lineupInfo();
    info.HomeTeam = {
      ...info.HomeTeam!,
      Tactics: null,
      Players: Array.from({ length: 11 }, (_, i) => ({
        ...starter(`h-null-${i}`, i + 1),
        ShirtNumber: i === 0 ? undefined : i + 1,
      })),
    };
    info.AwayTeam = {
      ...info.AwayTeam!,
      Tactics: null,
      Players: Array.from({ length: 11 }, (_, i) => ({
        ...starter(`a-null-${i}`, i + 1),
        ShirtNumber: i === 1 ? undefined : i + 1,
      })),
    };
    const { env } = createIngestionEnv({ teams: [] });
    const result = await syncFifaMatchLineupsFromInfo(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      info,
    );
    expect(result).toEqual({ updated: true, home: true, away: true });
    expect(official.applyOfficialLineupToMatch).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        formation: '4-4-2',
        players: expect.arrayContaining([expect.objectContaining({ shirtNumber: null })]),
      }),
    );
  });

  it('syncFifaMatchLineupsFromInfo handles errors', async () => {
    const official = await import('../src/services/officialLineupSync');
    vi.mocked(official.applyOfficialLineupToMatch).mockRejectedValueOnce(new Error('fail'));
    const { env } = createIngestionEnv();
    const result = await syncFifaMatchLineupsFromInfo(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      lineupInfo(),
    );
    expect(result.updated).toBe(false);
  });

  it('syncFifaMatchLineupsFromInfo returns false when official lineup apply reports no update', async () => {
    const official = await import('../src/services/officialLineupSync');
    vi.mocked(official.applyOfficialLineupToMatch).mockResolvedValue({ updated: false });
    const { env } = createIngestionEnv();
    const result = await syncFifaMatchLineupsFromInfo(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      lineupInfo(),
    );
    expect(result).toEqual({ updated: false, home: false, away: false });
    expect(official.applyOfficialLineupToMatch).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ formation: '4-4-2' }),
    );
  });

  it('syncFifaTeamLineup skips when fewer than 11 starters resolve', async () => {
    const playerResolve = await import('../src/ingestion/fifa/fifaPlayerResolve');
    vi.mocked(playerResolve.resolveOrCreateFifaPlayer).mockResolvedValue(null);
    const { env } = createIngestionEnv();
    const result = await syncFifaMatchLineupsFromInfo(
      env,
      FIXTURE_MATCH.id,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      lineupInfo(),
    );
    expect(result.home).toBe(false);
    expect(result.away).toBe(false);
  });

  it('syncFifaMatchLineupsByRef returns false when match missing', async () => {
    const { env } = createIngestionEnv({ matches: [] });
    expect(await syncFifaMatchLineupsByRef(env, 'missing')).toBe(false);
  });

  it('syncFifaMatchLineupsByRef skips when official lineups already confirmed', async () => {
    vi.setSystemTime(new Date('2026-06-10T12:00:00Z'));
    vi.spyOn(lineupsRepo, 'getMatchLineupRow').mockResolvedValue({
      source_type: 'match_official',
    } as never);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, status: 'scheduled', fifa_match_id: '400021443' }],
    });
    expect(await syncFifaMatchLineupsByRef(env, FIXTURE_MATCH.id)).toBe(false);
  });

  it('syncFifaMatchLineupsByRef syncs live match and updates KV', async () => {
    vi.spyOn(lineupsRepo, 'getMatchLineupRow').mockResolvedValue(null);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, status: 'live', fifa_match_id: '400021443', kickoff_utc: kickoff }],
    });
    const ok = await syncFifaMatchLineupsByRef(env, FIXTURE_MATCH.id);
    expect(ok).toBe(true);
    expect(env.KV.put).toHaveBeenCalledWith(
      `meta:fifa_lineup_sync:${FIXTURE_MATCH.id}`,
      expect.any(String),
      expect.any(Object),
    );
  });

  it('syncFifaMatchLineupsByRef returns false when fifa info missing', async () => {
    vi.spyOn(lineupsRepo, 'getMatchLineupRow').mockResolvedValue(null);
    const api = await import('../src/ingestion/fifa/fifaApiClient');
    vi.mocked(api.fetchFifaMatchInfo).mockResolvedValue(null);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, status: 'live', fifa_match_id: '400021443' }],
    });
    expect(await syncFifaMatchLineupsByRef(env, FIXTURE_MATCH.id)).toBe(false);
  });

  it('syncFifaMatchLineupsByRef resolves fifa id via live sync import', async () => {
    vi.spyOn(lineupsRepo, 'getMatchLineupRow').mockResolvedValue(null);
    const live = await import('../src/ingestion/fifa/fifaLiveSync');
    const { env, matches } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, status: 'live', fifa_match_id: null, kickoff_utc: kickoff }],
    });
    vi.mocked(live.syncFifaMatchByRef).mockImplementation(async (_env, matchId) => {
      const row = matches.find((m) => m.id === matchId);
      if (row) row.fifa_match_id = '400021443';
      return true;
    });
    expect(await syncFifaMatchLineupsByRef(env, FIXTURE_MATCH.id)).toBe(true);
  });

  it('syncFifaMatchLineupsByRef returns false when live sync cannot populate a FIFA id', async () => {
    vi.spyOn(lineupsRepo, 'getMatchLineupRow').mockResolvedValue(null);
    const live = await import('../src/ingestion/fifa/fifaLiveSync');
    vi.mocked(live.syncFifaMatchByRef).mockResolvedValue(false);
    const { env } = createIngestionEnv({
      matches: [{ ...FIXTURE_MATCH, status: 'live', fifa_match_id: null, kickoff_utc: kickoff }],
    });
    await expect(syncFifaMatchLineupsByRef(env, FIXTURE_MATCH.id)).resolves.toBe(false);
  });

  it('syncFifaLineupsForUpcomingMatches skips throttled scheduled sync', async () => {
    vi.setSystemTime(new Date('2026-06-11T18:30:00Z'));
    vi.spyOn(lineupsRepo, 'getMatchLineupRow').mockResolvedValue(null);
    const recent = new Date(Date.now() - 30_000).toISOString();
    const { env } = createIngestionEnv(
      {
        matches: [
          {
            id: FIXTURE_MATCH.id,
            kickoff_utc: FIXTURE_MATCH.kickoff_utc,
            status: 'scheduled',
            tournament_id: 't-2026',
            home_team_id: FIXTURE_MATCH.home_team_id,
            away_team_id: FIXTURE_MATCH.away_team_id,
            fifa_match_id: '400021443',
          },
        ],
      },
      { [`meta:fifa_lineup_sync:${FIXTURE_MATCH.id}`]: recent },
    );
    const result = await syncFifaLineupsForUpcomingMatches(env);
    expect(result.updated).toBe(0);
  });

  it('syncFifaLineupsForUpcomingMatches batches upcoming fixtures', async () => {
    vi.spyOn(lineupsRepo, 'getMatchLineupRow').mockResolvedValue(null);
    const { env } = createIngestionEnv({
      matches: [
        {
          id: FIXTURE_MATCH.id,
          kickoff_utc: FIXTURE_MATCH.kickoff_utc,
          status: 'scheduled',
          tournament_id: 't-2026',
          home_team_id: FIXTURE_MATCH.home_team_id,
          away_team_id: FIXTURE_MATCH.away_team_id,
          fifa_match_id: '400021443',
        },
      ],
    });
    const result = await syncFifaLineupsForUpcomingMatches(env);
    expect(result.checked).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.matchIds).toContain(FIXTURE_MATCH.id);
  });

  it('syncFifaLineupsForUpcomingMatches processes live rows and tolerates undefined result arrays', async () => {
    vi.spyOn(lineupsRepo, 'getMatchLineupRow').mockResolvedValue(null);
    const liveEnv = createIngestionEnv({
      matches: [
        {
          id: FIXTURE_MATCH.id,
          kickoff_utc: FIXTURE_MATCH.kickoff_utc,
          status: 'live',
          tournament_id: 't-2026',
          home_team_id: FIXTURE_MATCH.home_team_id,
          away_team_id: FIXTURE_MATCH.away_team_id,
          fifa_match_id: '400021443',
        },
      ],
    });
    const liveResult = await syncFifaLineupsForUpcomingMatches(liveEnv.env);
    expect(liveResult.updated).toBe(1);
    expect(liveResult.matchIds).toContain(FIXTURE_MATCH.id);

    const emptyEnv = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes('SELECT id, kickoff_utc, status FROM matches')) return {} as never;
          return { results: [] };
        },
      }),
    });
    const emptyResult = await syncFifaLineupsForUpcomingMatches(emptyEnv as never);
    expect(emptyResult).toEqual({ checked: 0, updated: 0, matchIds: [] });
  });

  it('syncFifaLineupsForUpcomingMatches skips recent KV sync outside pre-kickoff window', async () => {
    vi.spyOn(lineupsRepo, 'getMatchLineupRow').mockResolvedValue(null);
    vi.setSystemTime(new Date('2026-06-11T17:00:00Z'));
    const recent = new Date(Date.now() - 30_000).toISOString();
    const { env } = createIngestionEnv(
      {
        matches: [
          {
            id: FIXTURE_MATCH.id,
            kickoff_utc: FIXTURE_MATCH.kickoff_utc,
            status: 'scheduled',
            tournament_id: 't-2026',
          },
        ],
      },
      { [`meta:fifa_lineup_sync:${FIXTURE_MATCH.id}`]: recent },
    );
    const result = await syncFifaLineupsForUpcomingMatches(env);
    expect(result.updated).toBe(0);
  });

  it('syncFifaLineupsForUpcomingMatches ignores fixtures outside the kickoff sync window', async () => {
    vi.spyOn(lineupsRepo, 'getMatchLineupRow').mockResolvedValue(null);
    vi.setSystemTime(new Date('2026-06-10T12:00:00Z'));
    const { env } = createIngestionEnv({
      matches: [
        {
          id: FIXTURE_MATCH.id,
          kickoff_utc: FIXTURE_MATCH.kickoff_utc,
          status: 'scheduled',
          tournament_id: 't-2026',
          home_team_id: FIXTURE_MATCH.home_team_id,
          away_team_id: FIXTURE_MATCH.away_team_id,
          fifa_match_id: '400021443',
        },
      ],
    });
    const result = await syncFifaLineupsForUpcomingMatches(env);
    expect(result.checked).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.matchIds).toEqual([]);
  });
});

const kickoff = FIXTURE_MATCH.kickoff_utc!;
