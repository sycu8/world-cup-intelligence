import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMatchRecap = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/matchRecap', () => ({
  getMatchRecap,
}));

import { FIXTURE_MATCH, matchWithNames } from '../helpers/fixtures';
import { createRouteTestDb, createRouteTestEnv } from '../helpers/mockRouteDb';
import { jsonRoute } from '../helpers/routeHarness';
import { matchRoutes } from '../../src/routes/matches';

const MATCH_ID = FIXTURE_MATCH.id;
const RECAP = {
  matchId: MATCH_ID,
  slug: MATCH_ID,
  summaryVi: 'Sẵn',
  summaryEn: 'Ready',
  sourceId: null,
  updatedAt: null,
  commentary: [],
  playerStats: [],
};

function recapDb(options: {
  status?: string;
  complete?: boolean;
  lastSyncAt?: number | null;
  claim?: 'take' | 'held' | 'toggle';
}) {
  const base = createRouteTestDb({
    match: { ...matchWithNames(), status: options.status ?? 'completed' },
  });
  let held = options.claim === 'held';
  return {
    prepare(sql: string) {
      const stmt = base.prepare(sql);
      return {
        bind(...args: unknown[]) {
          const bound = stmt.bind(...args);
          return {
            first: async () => {
              if (sql.includes('ON CONFLICT(match_id) DO UPDATE SET expires_at')) {
                if (options.claim === 'toggle') {
                  if (held) return null;
                  held = true;
                  return { match_id: MATCH_ID };
                }
                if (held) return null;
                return { match_id: MATCH_ID };
              }
              if (sql.includes('SELECT last_sync_at FROM recap_sync_claims')) {
                if (options.lastSyncAt == null) return null;
                return { last_sync_at: options.lastSyncAt };
              }
              return bound.first();
            },
            all: async () => {
              if (sql.includes('FROM team_match_stats')) {
                if (!options.complete) return { results: [] };
                return {
                  results: [
                    { team_id: FIXTURE_MATCH.home_team_id, possession: 55, passes: 410 },
                    { team_id: FIXTURE_MATCH.away_team_id, possession: 45, passes: 380 },
                  ],
                };
              }
              return bound.all();
            },
            run: () => bound.run(),
          };
        },
        run: () => stmt.run(),
        first: () => stmt.first(),
        all: () => stmt.all(),
      };
    },
  };
}

beforeEach(() => {
  getMatchRecap.mockReset();
  getMatchRecap.mockResolvedValue(RECAP);
});

describe('GET /api/matches/:id/recap', () => {
  it('returns the stored recap without waiting on the FIFA sync', async () => {
    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({
      RECAP_QUEUE: { send } as never,
      DB: recapDb({ complete: false }) as never,
    });
    const { res, json } = await jsonRoute<{ data: { summaryVi: string } }>(matchRoutes, `/${MATCH_ID}/recap`, { env });

    expect(res.status).toBe(200);
    expect(json.data.summaryVi).toBe('Sẵn');
    expect(send).not.toHaveBeenCalled();
    expect(getMatchRecap).toHaveBeenCalledWith(env, MATCH_ID, { syncFifa: false });
  });

  it('does not queue when the match ref 404s', async () => {
    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({
      MOCK_SOURCES: 'false',
      RECAP_QUEUE: { send } as never,
    });
    const { res } = await jsonRoute(matchRoutes, '/m-missing/recap', { env });

    expect(res.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
    expect(getMatchRecap).not.toHaveBeenCalled();
  });

  it('does not queue when the stored recap 404s', async () => {
    getMatchRecap.mockResolvedValueOnce(null);
    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({
      MOCK_SOURCES: 'false',
      RECAP_QUEUE: { send } as never,
      DB: recapDb({}) as never,
    });
    const { res } = await jsonRoute(matchRoutes, `/${MATCH_ID}/recap`, { env });

    expect(res.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not queue when team stats are already complete', async () => {
    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({
      MOCK_SOURCES: 'false',
      RECAP_QUEUE: { send } as never,
      DB: recapDb({ complete: true, claim: 'take' }) as never,
    });
    const { res } = await jsonRoute(matchRoutes, `/${MATCH_ID}/recap`, { env });

    expect(res.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not queue when the last sync is inside 10 minutes', async () => {
    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({
      MOCK_SOURCES: 'false',
      RECAP_QUEUE: { send } as never,
      DB: recapDb({ complete: false, lastSyncAt: Date.now(), claim: 'take' }) as never,
    });
    const { res } = await jsonRoute(matchRoutes, `/${MATCH_ID}/recap`, { env });

    expect(res.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it('queues one recap sync, then refuses while the claim is held', async () => {
    const send = vi.fn(async () => undefined);
    const env = createRouteTestEnv({
      MOCK_SOURCES: 'false',
      RECAP_QUEUE: { send } as never,
      DB: recapDb({ complete: false, claim: 'toggle' }) as never,
    });

    const first = await jsonRoute(matchRoutes, `/${MATCH_ID}/recap`, { env });
    const second = await jsonRoute(matchRoutes, `/${MATCH_ID}/recap`, { env });

    expect(first.res.status).toBe(200);
    expect(second.res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      type: 'sync_match_recap',
      matchRef: MATCH_ID,
      idempotencyKey: `sync_match_recap:${MATCH_ID}`,
    });
  });
});
