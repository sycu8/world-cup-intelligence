import { describe, it, expect, vi } from 'vitest';
import { analysisRoutes } from '../../src/routes/analysis';
import { FIXTURE_MATCH } from '../helpers/fixtures';
import { jsonRoute } from '../helpers/routeHarness';
import { createRouteTestEnv } from '../helpers/mockRouteDb';

vi.mock('../../src/ai/multiVariableAnalysis', () => ({
  getCachedAnalysis: vi.fn(async () => null),
  runMultiVariableAnalysis: vi.fn(async () => ({
    matchId: FIXTURE_MATCH.id,
    generatedAt: '2026-01-01T00:00:00Z',
    executiveSummary: 'Summary',
    variableInsights: [],
    tacticalRecommendations: [],
    riskFactors: [],
    confidence: 0.8,
  })),
}));

vi.mock('../../src/ai/gatewayClient', () => ({
  isGatewayConfigured: vi.fn((env) => env.AI_GATEWAY_ENABLED === 'true'),
}));

describe('analysis routes extended', () => {
  it('GET /:matchId returns 404 for unknown match', async () => {
    const { res } = await jsonRoute(analysisRoutes, '/m-unknown');
    expect(res.status).toBe(404);
  });

  it('GET /:matchId runs analysis when gateway configured', async () => {
    const env = createRouteTestEnv({ AI_GATEWAY_ENABLED: 'true' });
    const { res, json } = await jsonRoute<{ data: { executiveSummary: string } }>(
      analysisRoutes,
      `/${FIXTURE_MATCH.id}`,
      { env },
    );
    expect(res.status).toBe(200);
    expect(json.data.executiveSummary).toBe('Summary');
  });

  it('GET /:matchId returns cached analysis when present', async () => {
    const { getCachedAnalysis } = await import('../../src/ai/multiVariableAnalysis');
    vi.mocked(getCachedAnalysis).mockResolvedValueOnce({
      matchId: FIXTURE_MATCH.id,
      generatedAt: '2026-01-01T00:00:00Z',
      executiveSummary: 'Cached',
      variableInsights: [],
      tacticalRecommendations: [],
      riskFactors: [],
      confidence: 0.9,
    });
    const env = createRouteTestEnv({ AI_GATEWAY_ENABLED: 'true' });
    const { res, json } = await jsonRoute<{ data: { executiveSummary: string } }>(
      analysisRoutes,
      `/${FIXTURE_MATCH.id}`,
      { env },
    );
    expect(res.status).toBe(200);
    expect(json.data.executiveSummary).toBe('Cached');
  });
});
