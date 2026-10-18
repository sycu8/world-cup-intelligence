import { describe, it, expect, vi } from 'vitest';
import { scenarioPredictionRoutes } from '../../src/routes/scenarioPredictions';
import { FIXTURE_MATCH } from '../helpers/fixtures';
import { jsonRoute } from '../helpers/routeHarness';

vi.mock('../../src/services/matchScenarioService', () => ({
  getMatchScenarioSet: vi.fn(async (env, matchId) => ({
    matchId,
    scenarios: [
      {
        id: 'sc-1',
        scenarioName: 'Baseline',
        scenarioProbability: 0.4,
        homeWinProb: 0.5,
        drawProb: 0.25,
        awayWinProb: 0.25,
        mostLikelyScore: '2-1',
      },
    ],
    comparison: { leader: 'sc-1' },
  })),
  generateMatchScenarios: vi.fn(async (env, matchId) => ({
    matchId,
    scenarios: [{ id: 'sc-new', scenarioName: 'Regenerated' }],
  })),
}));

vi.mock('../../src/db/repositories/matchPredictionScenarioRepo', () => ({
  getScenarioById: vi.fn(async (_db, id) => ({
    id,
    matchId: FIXTURE_MATCH.id,
    scenarioName: 'Baseline',
  })),
}));

vi.mock('../../src/ai/explainScenarioComparison', () => ({
  explainScenarioComparison: vi.fn(async () => ({ summary: 'Comparison AI' })),
}));

vi.mock('../../src/ai/explainScenarioPrediction', () => ({
  explainScenarioPrediction: vi.fn(async () => ({ summary: 'Scenario AI' })),
}));

const matchPath = `/${FIXTURE_MATCH.id}`;

describe('scenario prediction routes', () => {
  it('GET /:matchId/scenario-predictions returns scenario set', async () => {
    const { res, json } = await jsonRoute<{ data: { matchId: string } }>(
      scenarioPredictionRoutes,
      `${matchPath}/scenario-predictions`,
    );
    expect(res.status).toBe(200);
    expect(json.data.matchId).toBe(FIXTURE_MATCH.id);
  });

  it('GET /:matchId/scenario-predictions returns 404 when set missing', async () => {
    const { getMatchScenarioSet } = await import('../../src/services/matchScenarioService');
    vi.mocked(getMatchScenarioSet).mockResolvedValueOnce(null);
    const { res } = await jsonRoute(scenarioPredictionRoutes, `${matchPath}/scenario-predictions`);
    expect(res.status).toBe(404);
  });

  it('GET /:matchId/scenario-predictions/:scenarioId returns scenario with AI', async () => {
    const { res, json } = await jsonRoute<{ data: { id: string }; ai: unknown }>(
      scenarioPredictionRoutes,
      `${matchPath}/scenario-predictions/sc-1`,
    );
    expect(res.status).toBe(200);
    expect(json.data.id).toBe('sc-1');
    expect(json.ai).toBeTruthy();
  });

  it('GET /:matchId/scenario-predictions/:scenarioId returns 404 for wrong match', async () => {
    const { getScenarioById } = await import('../../src/db/repositories/matchPredictionScenarioRepo');
    vi.mocked(getScenarioById).mockResolvedValueOnce({
      id: 'sc-1',
      matchId: 'other-match',
    } as never);
    const { res } = await jsonRoute(scenarioPredictionRoutes, `${matchPath}/scenario-predictions/sc-1`);
    expect(res.status).toBe(404);
  });

  it('GET /:matchId/scenario-comparison returns comparison with AI', async () => {
    const { res, json } = await jsonRoute<{ data: { scenarios: unknown[] }; ai: unknown }>(
      scenarioPredictionRoutes,
      `${matchPath}/scenario-comparison`,
    );
    expect(res.status).toBe(200);
    expect(json.data.scenarios.length).toBe(1);
    expect(json.ai).toBeTruthy();
  });

  it('POST /:matchId/scenario-predictions/regenerate returns new set', async () => {
    const { res, json } = await jsonRoute<{ data: { scenarios: { id: string }[] } }>(
      scenarioPredictionRoutes,
      `${matchPath}/scenario-predictions/regenerate`,
      { method: 'POST' },
    );
    expect(res.status).toBe(200);
    expect(json.data.scenarios[0]?.id).toBe('sc-new');
  });

  it('POST regenerate returns 404 when generation fails', async () => {
    const { generateMatchScenarios } = await import('../../src/services/matchScenarioService');
    vi.mocked(generateMatchScenarios).mockResolvedValueOnce(null);
    const { res } = await jsonRoute(scenarioPredictionRoutes, `${matchPath}/scenario-predictions/regenerate`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown match', async () => {
    const { res } = await jsonRoute(scenarioPredictionRoutes, '/m-unknown/scenario-predictions');
    expect(res.status).toBe(404);
  });
});
