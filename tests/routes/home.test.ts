import { describe, it, expect, vi } from 'vitest';
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

  it('GET / returns 200 with empty sections when KV is unavailable', async () => {
    const env = createRouteTestEnv();
    vi.spyOn(env.KV, 'get').mockRejectedValue(new Error('KV binding missing'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { res, json } = await jsonRoute<{
      data: { hotNews: unknown[]; championOdds: unknown; schedule: { matches: unknown[] } };
    }>(homeRoutes, '/', { env });

    expect(res.status).toBe(200);
    expect(json.data.schedule.matches).toEqual([]);
    expect(json.data.hotNews).toEqual([]);
    expect(json.data.championOdds).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
