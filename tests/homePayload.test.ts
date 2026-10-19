import { describe, expect, it, vi } from 'vitest';
import { buildHomePayloadData, homeLastGoodKey } from '../src/services/homePayload';
import { createMockEnv } from './helpers/mockEnv';

vi.mock('../src/services/schedulePayload', () => ({
  buildSchedulePayload: vi.fn(async () => ({
    data: { byDate: {}, matches: [], tournamentId: 't-2026', total: 0 },
    meta: { expectedMatches: 104, year: 2026, tournamentId: 't-2026', wc2026Only: true },
  })),
}));

vi.mock('../src/services/dashboardPayload', () => ({
  buildDashboardPayload: vi.fn(async () => ({ featuredMatch: null, matchCount: 0 })),
}));

vi.mock('../src/services/newsListPayload', () => ({
  fetchHotNewsArticles: vi.fn(async () => [{ id: 'n1', title: 'Hot' }]),
}));

vi.mock('../src/services/tournamentStandings', () => ({
  buildGroupStandingsPayload: vi.fn(async () => ({ tournamentId: 't-2026', groups: {}, thirdPlaceRanking: [] })),
}));

vi.mock('../src/services/tournamentMatchProbabilities', () => ({
  buildTournamentMatchProbabilitiesPayload: vi.fn(async () => ({
    data: { 'm-1': { homeWin: 0.4, draw: 0.3, awayWin: 0.3 } },
    meta: { total: 1, withProbability: 1, pending: 0, missingIds: [] },
  })),
}));

vi.mock('../src/services/tournamentTopScorers', () => ({
  buildTopScorersPayload: vi.fn(async () => ({
    tournamentId: 't-2026',
    updatedAt: '2026-06-22T00:00:00.000Z',
    scorers: [{ rank: 1, playerId: 'p1', playerName: 'Messi', teamId: 't1', teamName: 'Argentina', countryCode: 'AR', goals: 2 }],
  })),
}));

describe('buildHomePayloadData', () => {
  it('aggregates schedule, dashboard, news, standings, and probabilities', async () => {
    const env = createMockEnv();
    const payload = await buildHomePayloadData(env);

    expect(payload.schedule.matches).toEqual([]);
    expect(payload.scheduleMeta.year).toBe(2026);
    expect(payload.dashboard).toEqual({ featuredMatch: null, matchCount: 0 });
    expect(payload.hotNews).toHaveLength(1);
    expect(payload.standings.tournamentId).toBe('t-2026');
    expect(payload.matchProbabilities['m-1']).toBeDefined();
    expect(payload.topScorers.scorers).toHaveLength(1);
  });

  it('forwards custom tournament param to schedule builder', async () => {
    const { buildSchedulePayload } = await import('../src/services/schedulePayload');
    const env = createMockEnv();
    await buildHomePayloadData(env, 't-custom');
    expect(buildSchedulePayload).toHaveBeenCalledWith(env, 't-custom');
  });

  it('returns the other sections when schedule build fails', async () => {
    const { buildSchedulePayload } = await import('../src/services/schedulePayload');
    vi.mocked(buildSchedulePayload).mockRejectedValueOnce(new Error('D1_ERROR: too many SQL variables'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const payload = await buildHomePayloadData(createMockEnv());

    expect(payload.schedule).toEqual({ byDate: {}, matches: [], tournamentId: 't-2026', total: 0 });
    expect(payload.scheduleMeta.tournamentId).toBe('t-2026');
    expect(payload.hotNews).toHaveLength(1);
    expect(payload.dashboard).toEqual({ featuredMatch: null, matchCount: 0 });
    expect(payload.topScorers.scorers).toHaveLength(1);
    expect(payload.matchProbabilities['m-1']).toBeDefined();
    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('"section":"schedule"');
    expect(logged).toContain('too many SQL variables');
    warn.mockRestore();
  });

  it('stores a last-good snapshot only when the payload has matches', async () => {
    const { buildSchedulePayload } = await import('../src/services/schedulePayload');
    vi.mocked(buildSchedulePayload).mockResolvedValueOnce({
      data: {
        byDate: {},
        matches: [{ id: 'm-kept' }],
        tournamentId: 't-2026',
        total: 1,
      },
      meta: { expectedMatches: 104, year: 2026, tournamentId: 't-2026', wc2026Only: true },
    } as Awaited<ReturnType<typeof buildSchedulePayload>>);
    const env = createMockEnv();
    await buildHomePayloadData(env);
    expect(env.KV.put).toHaveBeenCalledWith(
      homeLastGoodKey('t-2026'),
      expect.stringContaining('m-kept'),
      { expirationTtl: 86400 },
    );

    vi.mocked(env.KV.put).mockClear();
    await buildHomePayloadData(env);
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('does not replace the last-good homepage when a section throws', async () => {
    const { buildSchedulePayload } = await import('../src/services/schedulePayload');
    const { fetchHotNewsArticles } = await import('../src/services/newsListPayload');
    vi.mocked(buildSchedulePayload).mockResolvedValueOnce({
      data: {
        byDate: {},
        matches: [{ id: 'm-kept' }],
        tournamentId: 't-2026',
        total: 1,
      },
      meta: { expectedMatches: 104, year: 2026, tournamentId: 't-2026', wc2026Only: true },
    } as Awaited<ReturnType<typeof buildSchedulePayload>>);
    vi.mocked(fetchHotNewsArticles).mockRejectedValueOnce(new Error('news down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const env = createMockEnv();

    const payload = await buildHomePayloadData(env);

    expect(payload.schedule.matches).toEqual([{ id: 'm-kept' }]);
    expect(payload.hotNews).toEqual([]);
    expect(env.KV.put).not.toHaveBeenCalledWith(homeLastGoodKey('t-2026'), expect.anything(), expect.anything());
    warn.mockRestore();
  });
});
