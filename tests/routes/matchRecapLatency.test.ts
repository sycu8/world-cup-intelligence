import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMatchRecap = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/matchRecap', () => ({
  getMatchRecap,
}));

import { matchRoutes } from '../../src/routes/matches';
import { createRouteTestEnv } from '../helpers/mockRouteDb';
import { jsonRoute } from '../helpers/routeHarness';

beforeEach(() => {
  getMatchRecap.mockReset();
});

describe('GET /api/matches/:id/recap', () => {
  it('returns the stored recap without waiting on the FIFA sync', async () => {
    getMatchRecap.mockResolvedValue({
      matchId: 'm-1',
      slug: 'm-1',
      summaryVi: 'Sẵn',
      summaryEn: 'Ready',
      sourceId: null,
      updatedAt: null,
      commentary: [],
      playerStats: [],
    });

    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({ INGEST_QUEUE: { send } as never });
    const { res, json } = await jsonRoute<{ data: { summaryVi: string } }>(matchRoutes, '/m-1/recap', { env });

    expect(res.status).toBe(200);
    expect(json.data.summaryVi).toBe('Sẵn');
    expect(send).not.toHaveBeenCalled();
    expect(getMatchRecap).toHaveBeenCalledWith(env, 'm-1', { syncFifa: false });
  });

  it('enqueues the FIFA recap sync when live sources are on', async () => {
    getMatchRecap.mockResolvedValue({
      matchId: 'm-1',
      slug: 'm-1',
      summaryVi: 'Sẵn',
      summaryEn: 'Ready',
      sourceId: null,
      updatedAt: null,
      commentary: [],
      playerStats: [],
    });

    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({
      MOCK_SOURCES: 'false',
      INGEST_QUEUE: { send } as never,
    });
    const { res } = await jsonRoute(matchRoutes, '/m-1/recap', { env });

    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledWith({
      type: 'sync_match_recap',
      matchRef: 'm-1',
      idempotencyKey: 'sync_match_recap:m-1',
    });
    expect(getMatchRecap).toHaveBeenCalledWith(env, 'm-1', { syncFifa: false });
  });
});
