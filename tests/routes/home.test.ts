import { describe, it, expect } from 'vitest';
import { homeRoutes } from '../../src/routes/home';
import { jsonRoute } from '../helpers/routeHarness';
import { createRouteTestEnv } from '../helpers/mockRouteDb';

describe('home route branches', () => {
  it('GET / schedules background probability gap fill when snapshots missing', async () => {
    const env = createRouteTestEnv({}, { includeProbabilitySnapshots: false });
    const { res, json } = await jsonRoute<{ data: { schedule: unknown; dashboard: unknown } }>(homeRoutes, '/', {
      env,
    });
    expect(res.status).toBe(200);
    expect(json.data.schedule).toBeDefined();
    expect(json.data.dashboard).toBeDefined();
  });

  it('GET /?tournament= respects tournament query param', async () => {
    const { res } = await jsonRoute(homeRoutes, '/?tournament=t-2026');
    expect(res.status).toBe(200);
  });
});
