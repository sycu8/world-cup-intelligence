/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { matchRoutes } from '../../src/routes/matches';
import { FIXTURE_MATCH } from '../helpers/fixtures';
import { createRouteTestEnv } from '../helpers/mockRouteDb';
import { jsonRoute, requestRoute } from '../helpers/routeHarness';

describe('match live websocket route', () => {
  it('GET /:matchId/live upgrades to match room', async () => {
    const env = createRouteTestEnv({
      MATCH_ROOM: {
        idFromName: (name: string) => ({ toString: () => `room-${name}` }),
        get: () => ({
          fetch: async () => new Response('upgraded', { status: 200 }),
        }),
      } as never,
    });
    const res = await requestRoute(matchRoutes, `/${FIXTURE_MATCH.id}/live`, {
      env,
      headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('upgraded');
  });

  it('GET /:matchId/live returns 404 for unknown match', async () => {
    const env = createRouteTestEnv();
    const { res } = await jsonRoute(matchRoutes, '/m-unknown/live', {
      env,
      headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
    });
    expect(res.status).toBe(404);
  });
});
