import { describe, it, expect } from 'vitest';
import { probabilityRoutes } from '../../src/routes/probability';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT } from '../helpers/fixtures';
import { jsonRoute } from '../helpers/routeHarness';
import { createRouteTestEnv } from '../helpers/mockRouteDb';

const matchPath = `/${FIXTURE_MATCH.id}`;

describe('probability routes extended', () => {
  it('GET /:matchId/probability?recompute=1 recomputes live', async () => {
    const { res, json } = await jsonRoute<{ data: { matchId: string; modelVersion: string } }>(
      probabilityRoutes,
      `${matchPath}/probability?recompute=1`,
    );
    expect(res.status).toBe(200);
    expect(json.data.matchId).toBe(FIXTURE_MATCH.id);
    expect(json.data.modelVersion).toBeTruthy();
  });

  it('GET /:matchId/probability returns 404 for unknown match', async () => {
    const { res } = await jsonRoute(probabilityRoutes, '/m-unknown/probability');
    expect(res.status).toBe(404);
  });

  it('GET /:matchId/scoreline?recompute=1 returns distribution', async () => {
    const { res, json } = await jsonRoute<{ data: Record<string, number> }>(
      probabilityRoutes,
      `${matchPath}/scoreline?recompute=1`,
    );
    expect(res.status).toBe(200);
    expect(Object.keys(json.data).length).toBeGreaterThan(0);
  });

  it('GET /:matchId/intervals?recompute=1 returns intervals', async () => {
    const { res, json } = await jsonRoute<{ data: Record<string, number> }>(
      probabilityRoutes,
      `${matchPath}/intervals?recompute=1`,
    );
    expect(res.status).toBe(200);
    expect(json.data.firstHalf ?? json.data).toBeTruthy();
  });

  it('GET /:matchId/tactical-briefing returns briefing', async () => {
    const { res, json } = await jsonRoute<{ data: { summary?: string; bullets?: string[] } }>(
      probabilityRoutes,
      `${matchPath}/tactical-briefing?recompute=1`,
    );
    expect(res.status).toBe(200);
    expect(json.data).toBeTruthy();
  });

  it('uses incomplete snapshot fallback via recompute when scoreline empty', async () => {
    const incompleteSnapshot = {
      ...FIXTURE_SNAPSHOT,
      scoreline_json: '{}',
      interval_json: '{}',
      explanation_json: JSON.stringify({ summary: 'Summary driver' }),
    };
    const env = createRouteTestEnv({}, { snapshot: incompleteSnapshot });
    const { res, json } = await jsonRoute<{ data: { drivers: string[] } }>(
      probabilityRoutes,
      `${matchPath}/probability?recompute=1`,
      { env },
    );
    expect(res.status).toBe(200);
    expect(json.data.drivers.length).toBeGreaterThan(0);
  });

  it('cached path enriches probability payload from snapshot', async () => {
    const env = createRouteTestEnv(
      {},
      {
        snapshot: {
          ...FIXTURE_SNAPSHOT,
          explanation_json: JSON.stringify({ factors: [{ label: 'Home form' }] }),
        },
      },
    );
    const { res, json } = await jsonRoute<{ data: { homeWinProb: number } }>(
      probabilityRoutes,
      `${matchPath}/probability`,
      { env },
    );
    expect(res.status).toBe(200);
    expect(json.data.homeWinProb).toBeCloseTo(0.55);
  });

  it('treats invalid or empty snapshot JSON as incomplete and falls back to recompute payload defaults', async () => {
    const env = createRouteTestEnv(
      {},
      {
        snapshot: {
          ...FIXTURE_SNAPSHOT,
          scoreline_json: '{bad',
          interval_json: '{}',
          explanation_json: '{bad',
        },
      },
    );
    const { res, json } = await jsonRoute<{
      data: { topScorelines: Array<{ score: string; prob: number }>; drivers: string[]; updatedAt: string | null };
    }>(probabilityRoutes, `${matchPath}/probability`, { env });
    expect(res.status).toBe(200);
    expect(json.data.topScorelines.length).toBeGreaterThan(0);
    expect(json.data.drivers.length).toBeGreaterThan(0);
    expect(json.data.updatedAt).toBeTruthy();
  });

  it('accepts explanation-summary snapshots and exposes raw scoreline/interval data when recompute path is used', async () => {
    const match = {
      ...FIXTURE_MATCH,
      id: 'm-prob-summary',
    };
    const env = createRouteTestEnv(
      {},
      {
        match: {
          ...FIXTURE_MATCH,
          ...match,
          home_name: 'Mexico',
          away_name: 'South Africa',
          home_short: 'MEX',
          away_short: 'RSA',
          home_country_code: 'MEX',
          away_country_code: 'RSA',
        },
        snapshot: {
          ...FIXTURE_SNAPSHOT,
          match_id: match.id,
          explanation_json: JSON.stringify({ summary: 'Summary fallback driver' }),
        },
      },
    );

    const probability = await jsonRoute<{ data: { drivers: string[] } }>(
      probabilityRoutes,
      `/${match.id}/probability`,
      { env },
    );
    expect(Array.isArray(probability.json.data.drivers)).toBe(true);

    const scoreline = await jsonRoute<{ data: Record<string, number> }>(
      probabilityRoutes,
      `/${match.id}/scoreline?recompute=1`,
      { env },
    );
    expect(Object.keys(scoreline.json.data).length).toBeGreaterThan(0);

    const intervals = await jsonRoute<{ data: Record<string, unknown> }>(
      probabilityRoutes,
      `/${match.id}/intervals?recompute=1`,
      { env },
    );
    expect(Object.keys(intervals.json.data).length).toBeGreaterThan(0);
  });
});
