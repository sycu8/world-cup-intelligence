import { beforeEach, describe, expect, it, vi } from 'vitest';
import { homeRoutes } from '../../src/routes/home';
import { emptyHomeSections, homeLastGoodKey, type HomePayloadData } from '../../src/services/homePayload';
import { jsonRoute } from '../helpers/routeHarness';
import { createRouteTestEnv } from '../helpers/mockRouteDb';

vi.mock('../../src/services/homePayload', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/homePayload')>(
    '../../src/services/homePayload',
  );
  return {
    ...actual,
    buildHomePayloadData: vi.fn(async (_env: unknown, tournament = 't-2026') =>
      actual.emptyHomeSections(tournament),
    ),
  };
});

function withMatch(tournament: string): HomePayloadData {
  const snapshot = emptyHomeSections(tournament);
  snapshot.schedule.matches = [{ id: 'm-last-good' } as (typeof snapshot.schedule.matches)[number]];
  snapshot.dashboard.matchCount = 1;
  return snapshot;
}

describe('home last-good snapshot', () => {
  beforeEach(async () => {
    const payload = await import('../../src/services/homePayload');
    vi.mocked(payload.buildHomePayloadData).mockImplementation(async (_env, tournament = 't-2026') =>
      emptyHomeSections(tournament),
    );
  });

  it('serves the last good snapshot when the fresh build is empty', async () => {
    const env = createRouteTestEnv();
    const snapshot = withMatch('t-d1-down');
    await env.KV.put(homeLastGoodKey('t-d1-down'), JSON.stringify(snapshot));

    const { res, json } = await jsonRoute<{ data: { schedule: { matches: { id: string }[] } } }>(
      homeRoutes,
      '/?tournament=t-d1-down',
      { env },
    );

    expect(res.status).toBe(200);
    expect(json.data.schedule.matches.map((match) => match.id)).toEqual(['m-last-good']);
  });

  it('serves the last good snapshot when the build throws', async () => {
    const payload = await import('../../src/services/homePayload');
    vi.mocked(payload.buildHomePayloadData).mockRejectedValueOnce(new Error('D1_ERROR: database unavailable'));
    const env = createRouteTestEnv();
    const snapshot = withMatch('t-d1-throw');
    await env.KV.put(homeLastGoodKey('t-d1-throw'), JSON.stringify(snapshot));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { res, json } = await jsonRoute<{ data: { schedule: { matches: { id: string }[] } } }>(
      homeRoutes,
      '/?tournament=t-d1-throw',
      { env },
    );

    expect(res.status).toBe(200);
    expect(json.data.schedule.matches.map((match) => match.id)).toEqual(['m-last-good']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays empty when the build is empty and no last-good snapshot exists', async () => {
    const env = createRouteTestEnv();
    const { res, json } = await jsonRoute<{ data: { schedule: { matches: unknown[] } } }>(
      homeRoutes,
      '/?tournament=t-d1-empty',
      { env },
    );

    expect(res.status).toBe(200);
    expect(json.data.schedule.matches).toEqual([]);
  });
});
