import { describe, it, expect } from 'vitest';
import { tournamentRoutes } from '../../src/routes/tournaments';
import { FIXTURE_MATCH } from '../helpers/fixtures';
import { jsonRoute } from '../helpers/routeHarness';
import { createRouteTestEnv } from '../helpers/mockRouteDb';

describe('tournament routes extended', () => {
  it('GET /:year/matches returns tournament matches', async () => {
    const { res, json } = await jsonRoute<{ data: { id: string }[] }>(tournamentRoutes, '/2026/matches');
    expect(res.status).toBe(200);
    expect(json.data[0]?.id).toBe(FIXTURE_MATCH.id);
  });

  it('GET /:year/teams returns tournament teams', async () => {
    const { res, json } = await jsonRoute<{ data: { id: string }[] }>(tournamentRoutes, '/2026/teams');
    expect(res.status).toBe(200);
    expect(json.data.length).toBeGreaterThan(0);
  });

  it('GET /:year/matches returns 404 for unknown year', async () => {
    const { res } = await jsonRoute(tournamentRoutes, '/2018/matches');
    expect(res.status).toBe(404);
  });

  it('GET /:year/standings returns 404 for non-2026 year', async () => {
    const { res } = await jsonRoute(tournamentRoutes, '/2022/standings');
    expect(res.status).toBe(404);
  });

  it('GET /:year/match-probabilities returns 404 for non-2026 year', async () => {
    const { res } = await jsonRoute(tournamentRoutes, '/2022/match-probabilities');
    expect(res.status).toBe(404);
  });

  it('GET /:year/bracket returns bracket payload for 2026', async () => {
    const { res, json } = await jsonRoute<{ data: unknown }>(tournamentRoutes, '/2026/bracket');
    expect(res.status).toBe(200);
    expect(json.data).toBeDefined();
  });

  it('GET /:year/bracket returns 404 for non-2026 year', async () => {
    const { res } = await jsonRoute(tournamentRoutes, '/2022/bracket');
    expect(res.status).toBe(404);
  });

  it('GET /:year/match-probabilities schedules background fill for missing snapshots', async () => {
    const env = createRouteTestEnv({}, { includeProbabilitySnapshots: false });
    const { res, json } = await jsonRoute<{
      meta: { pending: number };
      data: Record<string, unknown>;
    }>(tournamentRoutes, '/2026/match-probabilities', { env });
    expect(res.status).toBe(200);
    expect(json.meta.pending).toBeGreaterThan(0);
  });
});
