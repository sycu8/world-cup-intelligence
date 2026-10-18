import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMatchRecap = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/matchRecap', () => ({
  getMatchRecap,
}));

import { matchRoutes } from '../../src/routes/matches';
import { jsonRoute } from '../helpers/routeHarness';

beforeEach(() => {
  getMatchRecap.mockReset();
});

describe('GET /api/matches/:id/recap', () => {
  it('returns the stored recap and does not wait on the FIFA sync', async () => {
    getMatchRecap.mockImplementation(async (_env: unknown, _ref: string, opts?: { waitUntil?: (p: Promise<unknown>) => void }) => {
      opts?.waitUntil?.(new Promise(() => undefined));
      return {
        matchId: 'm-1',
        slug: 'm-1',
        summaryVi: 'Sẵn',
        summaryEn: 'Ready',
        sourceId: null,
        updatedAt: null,
        commentary: [],
        playerStats: [],
      };
    });

    const { res, json } = await jsonRoute<{ data: { summaryVi: string } }>(matchRoutes, '/m-1/recap');

    expect(res.status).toBe(200);
    expect(json.data.summaryVi).toBe('Sẵn');
    expect(getMatchRecap).toHaveBeenCalledWith(
      expect.anything(),
      'm-1',
      expect.objectContaining({ waitUntil: expect.any(Function) }),
    );
  });
});
