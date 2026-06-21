import { describe, it, expect, vi } from 'vitest';
import { matchIntelligenceRoutes } from '../../src/routes/matchIntelligence';
import { FIXTURE_MATCH } from '../helpers/fixtures';
import { jsonRoute } from '../helpers/routeHarness';

vi.mock('../../src/services/matchIntelligence', () => ({
  getTeamSystemPayload: vi.fn(async (env, matchId) => ({ matchId, home: {}, away: {}, disclaimer: 'test' })),
  getScenariosPayload: vi.fn(async (env, matchId) => ({ matchId, scenarios: [] })),
  getMarketSignalsPayload: vi.fn(async (env, matchId) => ({ matchId, signals: [] })),
  buildModelVsMarket: vi.fn(async () => null),
  getProbabilityMovement: vi.fn(async (env, matchId) => ({ matchId, points: [] })),
}));

vi.mock('../../src/ai/explainTeamSystemStrength', () => ({
  explainTeamSystemStrength: vi.fn(async () => ({ summary: 'AI team system' })),
}));

vi.mock('../../src/ai/explainScenarioLikelihood', () => ({
  explainScenarioLikelihood: vi.fn(async () => ({ summary: 'AI scenarios' })),
}));

vi.mock('../../src/ai/explainModelVsMarket', () => ({
  explainModelVsMarket: vi.fn(async () => ({ summary: 'AI model vs market' })),
}));

const matchPath = `/${FIXTURE_MATCH.id}`;

describe('match intelligence routes', () => {
  it('GET /:matchId/team-system returns payload with AI', async () => {
    const { res, json } = await jsonRoute<{ data: { matchId: string }; ai: unknown }>(
      matchIntelligenceRoutes,
      `${matchPath}/team-system`,
    );
    expect(res.status).toBe(200);
    expect(json.data.matchId).toBe(FIXTURE_MATCH.id);
    expect(json.ai).toBeTruthy();
  });

  it('GET /:matchId/scenarios returns payload with AI', async () => {
    const { res, json } = await jsonRoute<{ data: { matchId: string }; ai: unknown }>(
      matchIntelligenceRoutes,
      `${matchPath}/scenarios`,
    );
    expect(res.status).toBe(200);
    expect(json.ai).toBeTruthy();
  });

  it('GET /:matchId/market-signals returns payload', async () => {
    const { res, json } = await jsonRoute<{ data: { matchId: string } }>(
      matchIntelligenceRoutes,
      `${matchPath}/market-signals`,
    );
    expect(res.status).toBe(200);
    expect(json.data.matchId).toBe(FIXTURE_MATCH.id);
  });

  it('GET /:matchId/model-vs-market returns null data when no market', async () => {
    const { res, json } = await jsonRoute<{ data: null; meta: { message: string } }>(
      matchIntelligenceRoutes,
      `${matchPath}/model-vs-market`,
    );
    expect(res.status).toBe(200);
    expect(json.data).toBeNull();
    expect(json.meta.message).toContain('market');
  });

  it('GET /:matchId/model-vs-market returns comparison when available', async () => {
    const { buildModelVsMarket } = await import('../../src/services/matchIntelligence');
    vi.mocked(buildModelVsMarket).mockResolvedValueOnce({
      matchId: FIXTURE_MATCH.id,
      model: { home: 0.5, draw: 0.25, away: 0.25 },
      market: { home: 0.48, draw: 0.27, away: 0.25 },
      delta: { home: 0.02, draw: -0.02, away: 0 },
    } as never);
    const { res, json } = await jsonRoute<{ data: unknown; ai: unknown }>(
      matchIntelligenceRoutes,
      `${matchPath}/model-vs-market`,
    );
    expect(res.status).toBe(200);
    expect(json.data).toBeTruthy();
    expect(json.ai).toBeTruthy();
  });

  it('GET /:matchId/probability-movement returns timeline', async () => {
    const { res, json } = await jsonRoute<{ data: { matchId: string } }>(
      matchIntelligenceRoutes,
      `${matchPath}/probability-movement`,
    );
    expect(res.status).toBe(200);
    expect(json.data.matchId).toBe(FIXTURE_MATCH.id);
  });

  it('returns 404 for unknown match', async () => {
    const { res } = await jsonRoute(matchIntelligenceRoutes, '/m-unknown/team-system');
    expect(res.status).toBe(404);
  });
});
