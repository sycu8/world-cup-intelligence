import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminRoutes } from '../../src/routes/admin';
import { FIXTURE_MATCH } from '../helpers/fixtures';
import { jsonRoute } from '../helpers/routeHarness';
import { createRouteTestEnv } from '../helpers/mockRouteDb';
import { adminEnv, adminHeaders } from '../helpers/routeTestUtils';

vi.mock('../../src/models/backtesting/backtestRunner', () => ({
  runBacktest: vi.fn(async () => ({ accuracy: 0.8 })),
}));

vi.mock('../../src/models/scenarios/backtesting/scenarioBacktestRunner', () => ({
  runScenarioBacktest: vi.fn(async (_env, year: number) => ({ year, scenarios: [] })),
}));

vi.mock('../../src/market/services/marketIngestionService', () => ({
  ingestManualMarketInput: vi.fn(async () => 1),
  ingestMatchMarkets: vi.fn(async () => 2),
}));

vi.mock('../../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => ({ ok: true })),
  recomputeAllWc2026Matches: vi.fn(async () => ({ total: 3, recomputed: 3, failed: [] })),
  recomputeKnockoutMatches: vi.fn(async () => ({ total: 32, recomputed: 32, failed: [] })),
}));

vi.mock('../../src/ingestion/newsCrawler', () => ({
  crawlWorldCupNews: vi.fn(async () => 5),
}));

vi.mock('../../src/services/officialLineupSync', () => ({
  applyOfficialLineupToMatch: vi.fn(async () => ({ updated: true, lineupId: 'lu-1' })),
  syncOfficialLineupsToMatches: vi.fn(async () => ({ synced: 2 })),
}));

vi.mock('../../src/services/matchScenarioService', () => ({
  generateMatchScenarios: vi.fn(async () => ({ matchId: FIXTURE_MATCH.id, scenarios: [] })),
  updateScenariosFromRealtimeEvent: vi.fn(async () => undefined),
}));

vi.mock('../../src/db/repositories/matchPredictionScenarioRepo', () => ({
  archiveScenario: vi.fn(async () => undefined),
}));

vi.mock('../../src/services/publicApi/clients', () => ({
  createApiClient: vi.fn(async (env, name: string) => ({
    client: { id: 'client-new', name, enabled: true, createdAt: '2026-01-01T00:00:00Z' },
    apiKey: 'pi_live_new_key',
  })),
  listApiClients: vi.fn(async () => [{ id: 'client-1', name: 'Listed', enabled: true, createdAt: '2026-01-01T00:00:00Z' }]),
  revokeApiClient: vi.fn(async (_env, id: string) => id === 'client-1'),
}));

const lineupPlayers = Array.from({ length: 7 }, (_, i) => ({
  playerId: `p-${i}`,
  isStarter: true,
  positionSlot: 'FW',
  shirtNumber: i + 1,
}));

describe('admin routes auth', () => {
  it('POST without token returns 401 in production', async () => {
    const { res, json } = await jsonRoute<{ error: string }>(adminRoutes, '/ingest', {
      method: 'POST',
      env: adminEnv(),
    });
    expect(res.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('GET /api-clients requires admin token when configured', async () => {
    const { res } = await jsonRoute(adminRoutes, '/api-clients', { env: adminEnv() });
    expect(res.status).toBe(401);
  });

  it('allows GET sources in development without token', async () => {
    const env = createRouteTestEnv({ ENVIRONMENT: 'development' });
    const { res } = await jsonRoute(adminRoutes, '/sources', { env });
    expect(res.status).toBe(200);
  });
});

describe('admin routes mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /ingest queues bulk ingest', async () => {
    const send = vi.fn(async () => undefined);
    const env = adminEnv({ INGEST_QUEUE: { send } as never });
    const { res, json } = await jsonRoute<{ status: string }>(adminRoutes, '/ingest', {
      method: 'POST',
      env,
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.status).toBe('queued');
    expect(send).toHaveBeenCalled();
  });

  it('POST /ingest/source/:sourceId queues source ingest', async () => {
    const send = vi.fn(async () => undefined);
    const env = adminEnv({ INGEST_QUEUE: { send } as never });
    const { res, json } = await jsonRoute<{ status: string; sourceId: string }>(
      adminRoutes,
      '/ingest/source/src-1',
      { method: 'POST', env, headers: adminHeaders() },
    );
    expect(res.status).toBe(200);
    expect(json.sourceId).toBe('src-1');
  });

  it('POST /recompute/:matchId queues model job', async () => {
    const send = vi.fn(async () => undefined);
    const env = adminEnv({ MODEL_QUEUE: { send } as never });
    const { res, json } = await jsonRoute<{ status: string; matchId: string }>(
      adminRoutes,
      `/recompute/${FIXTURE_MATCH.id}`,
      { method: 'POST', env, headers: adminHeaders() },
    );
    expect(res.status).toBe(200);
    expect(json.matchId).toBe(FIXTURE_MATCH.id);
  });

  it('POST /recompute-all returns summary', async () => {
    const { res, json } = await jsonRoute<{ data: { recomputed: number } }>(adminRoutes, '/recompute-all', {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.data.recomputed).toBe(3);
  });

  it('POST /recompute-knockout returns knockout summary', async () => {
    const { res, json } = await jsonRoute<{ data: { recomputed: number; total: number } }>(
      adminRoutes,
      '/recompute-knockout',
      {
        method: 'POST',
        env: adminEnv(),
        headers: adminHeaders(),
      },
    );
    expect(res.status).toBe(200);
    expect(json.data.total).toBe(32);
    expect(json.data.recomputed).toBe(32);
  });

  it('POST /backtest returns summary', async () => {
    const { res, json } = await jsonRoute<{ data: { accuracy: number } }>(adminRoutes, '/backtest', {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.data.accuracy).toBeCloseTo(0.8);
  });

  it('POST /scenario-backtest defaults year query to 2018', async () => {
    const { res, json } = await jsonRoute<{ data: { year: number } }>(adminRoutes, '/scenario-backtest', {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.data.year).toBe(2018);
  });

  it('POST /scenario-backtest accepts explicit year query', async () => {
    const { res, json } = await jsonRoute<{ data: { year: number } }>(adminRoutes, '/scenario-backtest?year=2022', {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.data.year).toBe(2022);
  });

  it('POST /sources creates registry row', async () => {
    const { res } = await jsonRoute(adminRoutes, '/sources', {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
      body: { id: 'src-new', source_name: 'New', source_type: 'rss' },
    });
    expect(res.status).toBe(201);
  });

  it('POST /market-sources uses default reliability when omitted', async () => {
    const { res } = await jsonRoute(adminRoutes, '/market-sources', {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
      body: { id: 'ms-default', name: 'Default', source_type: 'manual_analyst_input' },
    });
    expect(res.status).toBe(201);
  });

  it('POST /market-sources creates market source', async () => {
    const { res } = await jsonRoute(adminRoutes, '/market-sources', {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
      body: {
        id: 'ms-1',
        name: 'Odds API',
        source_type: 'licensed_odds_api',
        base_url: 'https://odds.example.com',
        reliability_score: 0.9,
      },
    });
    expect(res.status).toBe(201);
  });

  it('PATCH /market-sources/:sourceId updates reliability', async () => {
    const { res, json } = await jsonRoute<{ status: string }>(adminRoutes, '/market-sources/ms-1', {
      method: 'PATCH',
      env: adminEnv(),
      headers: adminHeaders(),
      body: { reliability_score: 0.95 },
    });
    expect(res.status).toBe(200);
    expect(json.status).toBe('updated');
  });

  it('PATCH /market-sources/:sourceId with empty body still succeeds', async () => {
    const { res } = await jsonRoute(adminRoutes, '/market-sources/ms-1', {
      method: 'PATCH',
      env: adminEnv(),
      headers: adminHeaders(),
      body: {},
    });
    expect(res.status).toBe(200);
  });

  it('POST /market-ingest/:matchId stores markets', async () => {
    const { res, json } = await jsonRoute<{ stored: number }>(adminRoutes, `/market-ingest/${FIXTURE_MATCH.id}`, {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.stored).toBe(2);
  });

  it('POST /manual-market-input/:matchId stores odds and recomputes', async () => {
    const { res, json } = await jsonRoute<{ stored: number }>(
      adminRoutes,
      `/manual-market-input/${FIXTURE_MATCH.id}`,
      {
        method: 'POST',
        env: adminEnv(),
        headers: adminHeaders(),
        body: { home: 2.1, draw: 3.2, away: 3.5 },
      },
    );
    expect(res.status).toBe(200);
    expect(json.stored).toBe(1);
  });

  it('POST /recompute-scenarios/:matchId uses MODEL_QUEUE when present', async () => {
    const send = vi.fn(async () => undefined);
    const env = adminEnv({ MODEL_QUEUE: { send } as never });
    const { res } = await jsonRoute(adminRoutes, `/recompute-scenarios/${FIXTURE_MATCH.id}`, {
      method: 'POST',
      env,
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalled();
  });

  it('POST /recompute-scenarios/:matchId falls back without queue', async () => {
    const { res } = await jsonRoute(adminRoutes, `/recompute-scenarios/${FIXTURE_MATCH.id}`, {
      method: 'POST',
      env: adminEnv({ MODEL_QUEUE: undefined }),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
  });

  it('POST /matches/:matchId/generate-scenarios returns data', async () => {
    const { res, json } = await jsonRoute<{ data: { matchId: string } }>(
      adminRoutes,
      `/matches/${FIXTURE_MATCH.id}/generate-scenarios`,
      { method: 'POST', env: adminEnv(), headers: adminHeaders() },
    );
    expect(res.status).toBe(200);
    expect(json.data.matchId).toBe(FIXTURE_MATCH.id);
  });

  it('POST /matches/:matchId/recompute-scenarios returns data', async () => {
    const { res } = await jsonRoute(adminRoutes, `/matches/${FIXTURE_MATCH.id}/recompute-scenarios`, {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
  });

  it('POST /matches/:matchId/scenarios/:scenarioId/archive archives scenario', async () => {
    const { res, json } = await jsonRoute<{ status: string }>(
      adminRoutes,
      `/matches/${FIXTURE_MATCH.id}/scenarios/sc-1/archive`,
      { method: 'POST', env: adminEnv(), headers: adminHeaders() },
    );
    expect(res.status).toBe(200);
    expect(json.status).toBe('archived');
  });

  it('POST /recompute-team-system/:matchId succeeds', async () => {
    const { res } = await jsonRoute(adminRoutes, `/recompute-team-system/${FIXTURE_MATCH.id}`, {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
  });

  it('POST /matches/:matchId/lineup applies lineup and recomputes', async () => {
    const { res, json } = await jsonRoute<{ updated: boolean }>(
      adminRoutes,
      `/matches/${FIXTURE_MATCH.id}/lineup`,
      {
        method: 'POST',
        env: adminEnv(),
        headers: adminHeaders(),
        body: { teamId: 'team-w26-a1', formation: '4-3-3', players: lineupPlayers },
      },
    );
    expect(res.status).toBe(200);
    expect(json.updated).toBe(true);
  });

  it('POST /lineups/sync-squads with all=true', async () => {
    const { res, json } = await jsonRoute<{ data: { synced: number } }>(adminRoutes, '/lineups/sync-squads?all=true', {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.data.synced).toBe(2);
  });

  it('PATCH /sources/:sourceId updates health', async () => {
    const { res } = await jsonRoute(adminRoutes, '/sources/src-1', {
      method: 'PATCH',
      env: adminEnv(),
      headers: adminHeaders(),
      body: { health_status: 'healthy' },
    });
    expect(res.status).toBe(200);
  });

  it('PATCH /sources/:sourceId without health_status still succeeds', async () => {
    const { res } = await jsonRoute(adminRoutes, '/sources/src-1', {
      method: 'PATCH',
      env: adminEnv(),
      headers: adminHeaders(),
      body: {},
    });
    expect(res.status).toBe(200);
  });

  it('POST /crawl-news returns inserted count', async () => {
    const { res, json } = await jsonRoute<{ inserted: number }>(adminRoutes, '/crawl-news', {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.inserted).toBe(5);
  });

  it('POST /api-clients creates client with one-time key', async () => {
    const { res, json } = await jsonRoute<{ apiKey: string }>(adminRoutes, '/api-clients', {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
      body: { name: 'Partner App' },
    });
    expect(res.status).toBe(200);
    expect(json.apiKey).toContain('pi_live_');
  });

  it('GET /api-clients lists clients with token', async () => {
    const { res, json } = await jsonRoute<{ data: { id: string }[] }>(adminRoutes, '/api-clients', {
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.data[0]?.id).toBe('client-1');
  });

  it('DELETE /api-clients/:id revokes client', async () => {
    const { res, json } = await jsonRoute<{ ok: boolean }>(adminRoutes, '/api-clients/client-1', {
      method: 'DELETE',
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it('DELETE /api-clients/:id returns 404 when missing', async () => {
    const { res } = await jsonRoute(adminRoutes, '/api-clients/missing', {
      method: 'DELETE',
      env: adminEnv(),
      headers: adminHeaders(),
    });
    expect(res.status).toBe(404);
  });
});
