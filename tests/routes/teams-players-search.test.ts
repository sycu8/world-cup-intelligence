import { describe, it, expect } from 'vitest';
import { searchRoutes } from '../../src/routes/search';
import { teamRoutes } from '../../src/routes/teams';
import { playerRoutes } from '../../src/routes/players';
import { jsonRoute } from '../helpers/routeHarness';
import { createRouteTestEnv } from '../helpers/mockRouteDb';

describe('search route branches', () => {
  it('GET /?q= returns empty arrays when DB results undefined', async () => {
    const env = createRouteTestEnv({}, { emptySearchResults: true });
    const { res, json } = await jsonRoute<{
      data: { teams: unknown[]; players: unknown[]; matches: unknown[] };
    }>(searchRoutes, '/?q=Mex', { env });
    expect(res.status).toBe(200);
    expect(json.data.teams).toEqual([]);
    expect(json.data.players).toEqual([]);
    expect(json.data.matches).toEqual([]);
  });
});

describe('team routes extended', () => {
  it('GET /:teamId includes coach profile when available', async () => {
    const { res, json } = await jsonRoute<{ data: { coach: { name: string } | null } }>(
      teamRoutes,
      '/team-w26-a1',
    );
    expect(res.status).toBe(200);
    expect(json.data.coach?.name).toBe('Test Coach');
  });

  it('GET /:teamId returns 404 for unknown team', async () => {
    const { res } = await jsonRoute(teamRoutes, '/team-unknown');
    expect(res.status).toBe(404);
  });

  it('GET /:teamId/wc-h2h returns meetings', async () => {
    const { res, json } = await jsonRoute<{ data: { teamId: string; totalMeetings: number } }>(
      teamRoutes,
      '/team-w26-a1/wc-h2h',
    );
    expect(res.status).toBe(200);
    expect(json.data.teamId).toBe('team-w26-a1');
  });

  it('GET /:teamId/wc-h2h returns 404 for unknown team', async () => {
    const { res } = await jsonRoute(teamRoutes, '/team-unknown/wc-h2h');
    expect(res.status).toBe(404);
  });

  it('GET /:teamId/form returns 404 for unknown team', async () => {
    const { res } = await jsonRoute(teamRoutes, '/team-unknown/form');
    expect(res.status).toBe(404);
  });

  it('GET /:teamId without coach returns null coach', async () => {
    const env = createRouteTestEnv({}, { coach: null });
    const { res, json } = await jsonRoute<{ data: { coach: null } }>(teamRoutes, '/team-w26-a1', { env });
    expect(res.status).toBe(200);
    expect(json.data.coach).toBeNull();
  });
});

describe('player routes extended', () => {
  it('GET /:playerId returns 404 for unknown player', async () => {
    const { res } = await jsonRoute(playerRoutes, '/p-unknown');
    expect(res.status).toBe(404);
  });

  it('GET /:playerId/form returns 404 for unknown player', async () => {
    const { res } = await jsonRoute(playerRoutes, '/p-unknown/form');
    expect(res.status).toBe(404);
  });

  it('GET /:playerId/events returns player events', async () => {
    const { res, json } = await jsonRoute<{ data: { event_type: string }[] }>(playerRoutes, '/p-test-1/events');
    expect(res.status).toBe(200);
    expect(json.data[0]?.event_type).toBe('goal');
  });
});
