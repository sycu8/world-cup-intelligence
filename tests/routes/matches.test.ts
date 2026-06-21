import { describe, it, expect, vi } from 'vitest';
import { matchRoutes } from '../../src/routes/matches';
import { FIXTURE_MATCH } from '../helpers/fixtures';
import { jsonRoute, requestRoute } from '../helpers/routeHarness';
import { createRouteTestEnv } from '../helpers/mockRouteDb';

vi.mock('../../src/services/matchHistory', () => ({
  getHeadToHead: vi.fn(async () => ({
    current: { home_name: 'Mexico', away_name: 'South Africa' },
    summary: { homeTeamWins: 1, awayTeamWins: 0, draws: 0, totalMatches: 1 },
  })),
}));

vi.mock('../../src/services/pitchMap', () => ({
  getPitchMapPayload: vi.fn(async () => ({ zones: [] })),
}));

vi.mock('../../src/services/matchPreviewAnalysis', () => ({
  getMatchPreviewAnalysis: vi.fn(async () => ({ headline: 'Preview' })),
}));

vi.mock('../../src/services/matchStats', () => ({
  getMatchStats: vi.fn(async () => ({ possession: { home: 55, away: 45 } })),
}));

vi.mock('../../src/services/matchRecap', () => ({
  getMatchRecap: vi.fn(async () => ({ summary: 'Recap text' })),
}));

vi.mock('../../src/services/matchStaff', () => ({
  getMatchStaff: vi.fn(async () => ({
    matchId: FIXTURE_MATCH.id,
    slug: 'group-a-mexico-vs-south-africa',
    homeCoach: null,
    awayCoach: null,
    officials: [],
    referee: null,
  })),
}));

vi.mock('../../src/services/lineupDisplay', () => ({
  ensureMatchLineups: vi.fn(async () => undefined),
  getLineupDisplayForMatch: vi.fn(async () => ({
    formation: '4-3-3',
    displayLines: [],
    players: [],
    starters: Array.from({ length: 7 }, (_, i) => ({ id: `p-${i}` })),
    substitutes: [],
    grouped: {},
    hasAccurateLineup: true,
    source: 'projected',
    sourceType: 'projected',
    confidence: 0.7,
  })),
}));

vi.mock('../../src/services/matchThumbnail', () => ({
  getMatchThumbnailPng: vi.fn(async () => ({
    png: new Uint8Array([137, 80, 78, 71]).buffer,
    match: { id: FIXTURE_MATCH.id },
  })),
  getMatchThumbnailSvg: vi.fn(async () => ({
    svg: '<svg></svg>',
    match: { id: FIXTURE_MATCH.id },
  })),
}));

vi.mock('../../src/ingestion/fifa/fifaLiveSync', () => ({
  shouldSyncFifaMatch: vi.fn(async () => true),
  syncFifaMatchByRef: vi.fn(async () => undefined),
}));

const matchPath = `/${FIXTURE_MATCH.id}`;

describe('match routes extended', () => {
  it('GET /:matchId/thumbnail.png returns PNG', async () => {
    const res = await requestRoute(matchRoutes, `${matchPath}/thumbnail.png?refresh=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/png');
  });

  it('GET /:matchId/thumbnail.png returns 404 when missing', async () => {
    const { getMatchThumbnailPng } = await import('../../src/services/matchThumbnail');
    vi.mocked(getMatchThumbnailPng).mockResolvedValueOnce(null);
    const { res } = await jsonRoute(matchRoutes, `${matchPath}/thumbnail.png`);
    expect(res.status).toBe(404);
  });

  it('GET /:matchId/thumbnail returns SVG', async () => {
    const res = await requestRoute(matchRoutes, `${matchPath}/thumbnail?refresh=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/svg');
  });

  it('GET /:matchId/thumbnail returns 404 when missing', async () => {
    const { getMatchThumbnailSvg } = await import('../../src/services/matchThumbnail');
    vi.mocked(getMatchThumbnailSvg).mockResolvedValueOnce(null);
    const { res } = await jsonRoute(matchRoutes, `${matchPath}/thumbnail`);
    expect(res.status).toBe(404);
  });

  it('GET /:matchId triggers FIFA sync waitUntil when enabled', async () => {
    const env = createRouteTestEnv({ MOCK_SOURCES: 'false', FIFA_LIVE_ENABLED: 'true' });
    const { res } = await jsonRoute(matchRoutes, matchPath, { env });
    expect(res.status).toBe(200);
  });

  it('GET /:matchId/events returns events', async () => {
    const { res, json } = await jsonRoute<{ data: unknown[] }>(matchRoutes, `${matchPath}/events`);
    expect(res.status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('GET /:matchId/lineups returns both sides', async () => {
    const { res, json } = await jsonRoute<{ data: { home: unknown; away: unknown } }>(
      matchRoutes,
      `${matchPath}/lineups`,
    );
    expect(res.status).toBe(200);
    expect(json.data.home).toBeDefined();
    expect(json.data.away).toBeDefined();
  });

  it('GET /:matchId/lineups returns 404 when team missing', async () => {
    const env = createRouteTestEnv({}, { teams: [] });
    const { res } = await jsonRoute(matchRoutes, `${matchPath}/lineups`, { env });
    expect(res.status).toBe(404);
  });

  it('GET /:matchId/history returns head-to-head', async () => {
    const { res, json } = await jsonRoute<{ data: unknown }>(matchRoutes, `${matchPath}/history`);
    expect(res.status).toBe(200);
    expect(json.data).toBeTruthy();
  });

  it('GET /:matchId/history returns 404 when data missing', async () => {
    const { getHeadToHead } = await import('../../src/services/matchHistory');
    vi.mocked(getHeadToHead).mockResolvedValueOnce(null);
    const { res } = await jsonRoute(matchRoutes, `${matchPath}/history`);
    expect(res.status).toBe(404);
  });

  it('GET /:matchId/pitch-map returns payload', async () => {
    const { res } = await jsonRoute(matchRoutes, `${matchPath}/pitch-map`);
    expect(res.status).toBe(200);
  });

  it('GET /:matchId/pitch-map returns 404 when missing', async () => {
    const { getPitchMapPayload } = await import('../../src/services/pitchMap');
    vi.mocked(getPitchMapPayload).mockResolvedValueOnce(null);
    const { res } = await jsonRoute(matchRoutes, `${matchPath}/pitch-map`);
    expect(res.status).toBe(404);
  });

  it('GET /:matchId/preview returns analysis', async () => {
    const { res, json } = await jsonRoute<{ data: { slug: string } }>(matchRoutes, `${matchPath}/preview`);
    expect(res.status).toBe(200);
    expect(json.data.slug).toBeTruthy();
  });

  it('GET /:matchId/preview returns 404 when missing', async () => {
    const { getMatchPreviewAnalysis } = await import('../../src/services/matchPreviewAnalysis');
    vi.mocked(getMatchPreviewAnalysis).mockResolvedValueOnce(null);
    const { res } = await jsonRoute(matchRoutes, `${matchPath}/preview`);
    expect(res.status).toBe(404);
  });

  it('GET /:matchId/hints returns probability hints', async () => {
    const { res, json } = await jsonRoute<{ data: { hints: unknown[] } }>(matchRoutes, `${matchPath}/hints`);
    expect(res.status).toBe(200);
    expect(json.data.hints.length).toBeGreaterThan(0);
  });

  it('GET /:matchId/hints returns 404 without h2h current', async () => {
    const { getHeadToHead } = await import('../../src/services/matchHistory');
    vi.mocked(getHeadToHead).mockResolvedValueOnce({ current: null, summary: {} } as never);
    const { res } = await jsonRoute(matchRoutes, `${matchPath}/hints`);
    expect(res.status).toBe(404);
  });

  it('GET /:matchId/stats returns stats', async () => {
    const { res } = await jsonRoute(matchRoutes, `${matchPath}/stats`);
    expect(res.status).toBe(200);
  });

  it('GET /:matchId/recap returns recap', async () => {
    const { res } = await jsonRoute(matchRoutes, `${matchPath}/recap`);
    expect(res.status).toBe(200);
  });

  it('GET /:matchId/staff returns staff payload', async () => {
    const { res } = await jsonRoute(matchRoutes, `${matchPath}/staff`);
    expect(res.status).toBe(200);
  });

  it('GET /:matchId/live without websocket returns 426', async () => {
    const { res, json } = await jsonRoute<{ error: string }>(matchRoutes, `${matchPath}/live`);
    expect(res.status).toBe(426);
    expect(json.error).toContain('WebSocket');
  });
});
