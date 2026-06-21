import { describe, expect, it, vi } from 'vitest';
import { buildHomePayloadData } from '../src/services/homePayload';
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
  });

  it('forwards custom tournament param to schedule builder', async () => {
    const { buildSchedulePayload } = await import('../src/services/schedulePayload');
    const env = createMockEnv();
    await buildHomePayloadData(env, 't-custom');
    expect(buildSchedulePayload).toHaveBeenCalledWith(env, 't-custom');
  });
});
