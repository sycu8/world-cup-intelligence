import { describe, it, expect, vi } from 'vitest';
import { adminRoutes } from '../../src/routes/admin';
import { probabilityRoutes } from '../../src/routes/probability';
import { newsRoutes } from '../../src/routes/news';
import { matchRoutes } from '../../src/routes/matches';
import { publicApiRoutes } from '../../src/routes/publicApi';
import { playerRoutes } from '../../src/routes/players';
import { teamRoutes } from '../../src/routes/teams';
import { matchIntelligenceRoutes } from '../../src/routes/matchIntelligence';
import { scenarioPredictionRoutes } from '../../src/routes/scenarioPredictions';
import { FIXTURE_MATCH, FIXTURE_NEWS, FIXTURE_SNAPSHOT, FIXTURE_TEAMS } from '../helpers/fixtures';
import { jsonRoute, requestRoute } from '../helpers/routeHarness';
import { createMockDb } from '../helpers/mockEnv';
import { createRouteTestEnv } from '../helpers/mockRouteDb';
import { adminEnv, adminHeaders } from '../helpers/routeTestUtils';

vi.mock('../../src/services/matchIntelligence', () => ({
  getTeamSystemPayload: vi.fn(async (_env, matchId) => ({ matchId, home: {}, away: {}, disclaimer: 'test' })),
  getScenariosPayload: vi.fn(async (_env, matchId) => ({ matchId, scenarios: [] })),
  getMarketSignalsPayload: vi.fn(async (_env, matchId) => ({ matchId, signals: [] })),
  buildModelVsMarket: vi.fn(async () => null),
  getProbabilityMovement: vi.fn(async (_env, matchId) => ({ matchId, points: [] })),
}));

vi.mock('../../src/services/matchScenarioService', () => ({
  getMatchScenarioSet: vi.fn(async (_env, matchId) => ({
    matchId,
    scenarios: [{ id: 'sc-1', scenarioName: 'Baseline', scenarioProbability: 0.4, homeWinProb: 0.5, drawProb: 0.25, awayWinProb: 0.25, mostLikelyScore: '2-1' }],
    comparison: { leader: 'sc-1' },
  })),
  generateMatchScenarios: vi.fn(async () => null),
}));

vi.mock('../../src/db/repositories/matchPredictionScenarioRepo', () => ({
  getScenarioById: vi.fn(async (_db, id) => ({
    id,
    matchId: FIXTURE_MATCH.id,
    scenarioName: 'Baseline',
  })),
  archiveScenario: vi.fn(async () => undefined),
}));

vi.mock('../../src/services/newsTranslation', () => ({
  ensureNewsArticleTranslated: vi.fn(async (_env, row) => row),
  backfillNewsTranslations: vi.fn(async () => undefined),
  countUntranslatedNews: vi.fn(async () => 0),
  resolvePublisherLabel: vi.fn((row) => row.source_name ?? 'Source'),
}));

vi.mock('../../src/services/newsThumbnailBackfill', () => ({
  backfillNewsThumbnails: vi.fn(async () => undefined),
  recompressNewsThumbnails: vi.fn(async () => undefined),
  resolveNewsThumbSourceUrl: vi.fn(async () => null),
}));

vi.mock('../../src/services/newsSourceBackfill', () => ({
  backfillNewsSources: vi.fn(async () => undefined),
}));

vi.mock('../../src/services/pipelineBootstrap', () => ({
  ensureNewsCrawlFresh: vi.fn(async () => undefined),
}));

vi.mock('../../src/services/matchHistory', () => ({
  getHeadToHead: vi.fn(async () => ({
    current: { home_name: 'Mexico', away_name: 'South Africa' },
    summary: { homeTeamWins: 1, awayTeamWins: 0, draws: 0, totalMatches: 1 },
  })),
}));

vi.mock('../../src/services/matchStats', () => ({
  getMatchStats: vi.fn(async () => ({ possession: { home: 50, away: 50 } })),
}));

vi.mock('../../src/services/matchRecap', () => ({
  getMatchRecap: vi.fn(async () => ({ summary: 'recap' })),
}));

vi.mock('../../src/services/matchStaff', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/matchStaff')>();
  return {
    ...actual,
    getMatchStaff: vi.fn(async () => ({
      matchId: FIXTURE_MATCH.id,
      slug: 'slug',
      homeCoach: null,
      awayCoach: null,
      officials: [],
      referee: null,
    })),
  };
});

vi.mock('../../src/ai/explainModelVsMarket', () => ({
  explainModelVsMarket: vi.fn(async () => ({ summary: 'ok' })),
}));

vi.mock('../../src/ai/explainScenarioLikelihood', () => ({
  explainScenarioLikelihood: vi.fn(async () => ({ summary: 'ok' })),
}));

vi.mock('../../src/ai/explainTeamSystemStrength', () => ({
  explainTeamSystemStrength: vi.fn(async () => ({ summary: 'ok' })),
}));

vi.mock('../../src/ai/explainScenarioComparison', () => ({
  explainScenarioComparison: vi.fn(async () => ({ summary: 'ok' })),
}));

vi.mock('../../src/ai/explainScenarioPrediction', () => ({
  explainScenarioPrediction: vi.fn(async () => ({ summary: 'ok' })),
}));

vi.mock('../../src/services/publicApi/feed', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/publicApi/feed')>();
  return {
    ...actual,
    queryFeed: vi.fn(async () => ({ events: [], nextCursor: 5 })),
  };
});

vi.mock('../../src/services/officialLineupSync', () => ({
  applyOfficialLineupToMatch: vi.fn(async () => ({ updated: false, lineupId: null })),
  syncOfficialLineupsToMatches: vi.fn(async () => ({ synced: 0 })),
}));

const lineupPlayers = Array.from({ length: 7 }, (_, i) => ({
  playerId: `p-${i}`,
  isStarter: true,
  positionSlot: 'FW',
  shirtNumber: i + 1,
}));

describe('route coverage gaps', () => {
  it('admin GET routes bypass auth in production except api-clients', async () => {
    const { res } = await jsonRoute(adminRoutes, '/sources', { env: adminEnv() });
    expect(res.status).toBe(200);
  });

  it('admin lineup skips recompute when lineup not updated', async () => {
    const { res, json } = await jsonRoute<{ updated: boolean }>(
      adminRoutes,
      `/matches/${FIXTURE_MATCH.id}/lineup`,
      {
        method: 'POST',
        env: adminEnv(),
        headers: adminHeaders(),
        body: { teamId: 'team-w26-a1', formation: '4-3-3', players: lineupPlayers },
      },
    );
    expect(res.status).toBe(200);
    expect(json.updated).toBe(false);
  });

  it('probability invalid JSON branches execute during snapshot validation', async () => {
    const env = createRouteTestEnv(
      {},
      {
        snapshot: {
          ...FIXTURE_SNAPSHOT,
          scoreline_json: 'not-json',
          interval_json: JSON.stringify({ firstHalf: 0.45, secondHalf: 0.55 }),
          explanation_json: 'bad-explanation',
        },
      },
    );
    const res = await requestRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability`, { env });
    expect(res.status).toBe(200);
  });

  it('probability explanation summary branch is used from snapshot cache', async () => {
    const env = createRouteTestEnv(
      {},
      {
        snapshot: {
          ...FIXTURE_SNAPSHOT,
          id: 'ps-summary-only',
          explanation_json: JSON.stringify({ summary: 'Summary driver only' }),
        },
      },
    );
    const res = await requestRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability`, { env });
    expect(res.status).toBe(200);
  });

  it('probability parseExplanationDrivers handles empty and invalid explanation', async () => {
    const emptyExpl = createRouteTestEnv(
      {},
      { snapshot: { ...FIXTURE_SNAPSHOT, id: 'ps-empty-expl', explanation_json: '{}' } },
    );
    expect((await requestRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability`, { env: emptyExpl })).status).toBe(200);

    const badExpl = createRouteTestEnv(
      {},
      { snapshot: { ...FIXTURE_SNAPSHOT, id: 'ps-bad-expl', explanation_json: 'not-json' } },
    );
    expect((await requestRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability`, { env: badExpl })).status).toBe(200);

    const noopExpl = createRouteTestEnv(
      {},
      { snapshot: { ...FIXTURE_SNAPSHOT, id: 'ps-noop-expl', explanation_json: '{"foo":"bar"}' } },
    );
    expect((await requestRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability`, { env: noopExpl })).status).toBe(200);
  });

  it('public API matches maps null minute and stream closed pull', async () => {
    const customEnv = createRouteTestEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
            return { ...FIXTURE_MATCH, minute: null, home_name: 'Mexico', away_name: 'South Africa', home_short: 'MEX', away_short: 'RSA', home_country_code: 'MEX', away_country_code: 'RSA' };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM matches m') && sql.includes('JOIN teams ht')) {
            return {
              results: [
                {
                  ...FIXTURE_MATCH,
                  minute: null,
                  home_name: 'Mexico',
                  away_name: 'South Africa',
                  home_short: 'MEX',
                  away_short: 'RSA',
                  home_country_code: 'MEX',
                  away_country_code: 'RSA',
                  slug: 'group-a-mexico-vs-south-africa',
                },
              ],
            };
          }
          return { results: [] };
        },
      }),
    });
    const { res, json } = await jsonRoute<{ data: { minute: null }[] }>(publicApiRoutes, '/matches', { env: customEnv });
    expect(res.status).toBe(200);
    expect(json.data[0]?.minute).toBeNull();

    vi.useFakeTimers();
    const { queryFeed } = await import('../../src/services/publicApi/feed');
    vi.mocked(queryFeed).mockResolvedValue({ events: [], nextCursor: 1 });
    const streamRes = await requestRoute(publicApiRoutes, '/stream?cursor=abc&matchId=');
    const reader = streamRes.body!.getReader();
    await reader.cancel();
    await vi.advanceTimersByTimeAsync(5000);
    await reader.read();
    vi.useRealTimers();
  });

  it('news skips translation for already-localized articles', async () => {
    const env = createRouteTestEnv(
      {},
      {
        news: [
          {
            ...FIXTURE_NEWS,
            id: 'news-vi',
            title_vi: 'Đội tuyển Mexico chuẩn bị cho trận đấu quan trọng',
            summary_vi: 'Các cầu thủ đang tập luyện trong tuần này tại Mexico',
          },
        ],
      },
    );
    const { res, json } = await jsonRoute<{ data: { hot: { title: string }[] } }>(newsRoutes, '/', { env });
    expect(res.status).toBe(200);
    expect(json.data.hot[0]?.title).toContain('Mexico');
  });

  it('public API webhook list and delete require auth', async () => {
    expect((await jsonRoute(publicApiRoutes, '/webhooks')).res.status).toBe(401);
    expect((await jsonRoute(publicApiRoutes, '/webhooks/wh-1', { method: 'DELETE' })).res.status).toBe(401);
    expect((await jsonRoute(publicApiRoutes, '/webhooks/wh-1/test', { method: 'POST' })).res.status).toBe(401);
  });

  it('match intelligence routes return 404 for unknown matches', async () => {
    expect((await jsonRoute(matchIntelligenceRoutes, '/m-unknown/scenarios')).res.status).toBe(404);
    expect((await jsonRoute(matchIntelligenceRoutes, '/m-unknown/market-signals')).res.status).toBe(404);
    expect((await jsonRoute(matchIntelligenceRoutes, '/m-unknown/model-vs-market')).res.status).toBe(404);
    expect((await jsonRoute(matchIntelligenceRoutes, '/m-unknown/probability-movement')).res.status).toBe(404);
  });

  it('scenario comparison returns 404 when scenario set missing', async () => {
    const { getMatchScenarioSet } = await import('../../src/services/matchScenarioService');
    vi.mocked(getMatchScenarioSet).mockResolvedValueOnce(null);
    const { res } = await jsonRoute(scenarioPredictionRoutes, `/${FIXTURE_MATCH.id}/scenario-comparison`);
    expect(res.status).toBe(404);
  });

  it('probability interval JSON parse catch runs during snapshot validation', async () => {
    const env = createRouteTestEnv(
      {},
      {
        snapshot: {
          ...FIXTURE_SNAPSHOT,
          interval_json: 'bad-interval-json',
        },
      },
    );
    const res = await requestRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/intervals`, { env });
    expect(res.status).toBe(200);
  });

  it('match nested routes return 404 when match ref is unknown', async () => {
    expect((await jsonRoute(matchRoutes, '/m-unknown/lineups')).res.status).toBe(404);
    expect((await jsonRoute(matchRoutes, '/m-unknown/history')).res.status).toBe(404);
    expect((await jsonRoute(matchRoutes, '/m-unknown/pitch-map')).res.status).toBe(404);
    expect((await jsonRoute(matchRoutes, '/m-unknown/preview')).res.status).toBe(404);
  });

  it('news detail route ignores assets slug param', async () => {
    const res = await requestRoute(newsRoutes, '/assets');
    expect(res.status).toBe(404);
  });

  it('public API webhook test returns 500 when feed append fails', async () => {
    const feed = await import('../../src/services/publicApi/feed');
    vi.spyOn(feed, 'appendFeedEvent').mockResolvedValueOnce(null);
    const { publicApiAuthEnv, apiKeyHeaders } = await import('../helpers/routeTestUtils');
    const env = await publicApiAuthEnv();
    await jsonRoute(publicApiRoutes, '/webhooks', {
      method: 'POST',
      env,
      headers: apiKeyHeaders(),
      body: { url: 'https://hook.example.com/events' },
    });
    const { res } = await jsonRoute(publicApiRoutes, '/webhooks/wh-test-1/test', {
      method: 'POST',
      env,
      headers: apiKeyHeaders(),
    });
    expect(res.status).toBe(500);
  });

  it('probability summary-only explanation is parsed from complete snapshot', async () => {
    const env = createRouteTestEnv(
      {},
      {
        snapshot: {
          ...FIXTURE_SNAPSHOT,
          explanation_json: JSON.stringify({ summary: 'Only summary path' }),
        },
      },
    );
    const { res } = await jsonRoute(probabilityRoutes, `/${FIXTURE_MATCH.id}/scoreline`, { env });
    expect(res.status).toBe(200);
  });

  it('news mapArticle covers thumbnail and translation branches', async () => {
    const env = createRouteTestEnv(
      {},
      {
        news: [
          {
            ...FIXTURE_NEWS,
            id: 'news-r2',
            title_vi: 'Tiêu đề',
            summary_vi: 'Tóm tắt',
            thumbnail_r2_key: 'news-thumbs/news-r2.webp',
          },
          {
            ...FIXTURE_NEWS,
            id: 'news-http',
            title_vi: null,
            summary_vi: null,
            thumbnail_url: 'https://images.example.com/a.jpg',
          },
          {
            ...FIXTURE_NEWS,
            id: 'news-api-path',
            thumbnail_url: '/api/news/assets/news-api-path',
          },
        ],
      },
    );
    const { res, json } = await jsonRoute<{
      data: { hot: { thumbnail_url: string | null }[]; articles: unknown[] };
    }>(newsRoutes, '/?page=2&hot=1', { env });
    expect(res.status).toBe(200);
    expect(json.data.hot[0]?.thumbnail_url).toContain('/api/news/assets/');
  });

  it('news list handles empty hot id set for count SQL branch', async () => {
    const env = createRouteTestEnv({}, { news: [] });
    const { res, json } = await jsonRoute<{ meta: { total: number } }>(newsRoutes, '/', { env });
    expect(res.status).toBe(200);
    expect(json.meta.total).toBe(0);
  });

  it('news asset returns 404 when head missing and no http thumbnail', async () => {
    const env = createRouteTestEnv({
      R2_ARTIFACTS: { head: async () => null, get: async () => null } as never,
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('SELECT thumbnail_url FROM source_documents')) {
            return { thumbnail_url: null };
          }
          return null;
        },
      }),
    });
    const { res } = await jsonRoute(newsRoutes, '/assets/missing', { env });
    expect(res.status).toBe(404);
  });

  it('match hints returns null probability without snapshot', async () => {
    const env = createRouteTestEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM probability_snapshots')) return null;
          if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
            return {
              ...FIXTURE_MATCH,
              home_name: 'Mexico',
              away_name: 'South Africa',
              home_short: 'MEX',
              away_short: 'RSA',
              home_country_code: 'MEX',
              away_country_code: 'RSA',
            };
          }
          if (sql.includes('FROM teams WHERE id')) {
            return FIXTURE_TEAMS.find((t) => t.id === binds[0]) ?? null;
          }
          return null;
        },
        all: () => ({ results: [] }),
      }),
    });
    const { res, json } = await jsonRoute<{ data: { probability: null } }>(
      matchRoutes,
      `/${FIXTURE_MATCH.id}/hints`,
      { env },
    );
    expect(res.status).toBe(200);
    expect(json.data.probability).toBeNull();
  });

  it('tournament teams route returns 404 for unknown year', async () => {
    const { tournamentRoutes } = await import('../../src/routes/tournaments');
    const { res } = await jsonRoute(tournamentRoutes, '/2018/teams');
    expect(res.status).toBe(404);
  });

  it('public API stream catch branch emits error event', async () => {
    vi.useFakeTimers();
    const { queryFeed } = await import('../../src/services/publicApi/feed');
    vi.mocked(queryFeed).mockRejectedValueOnce(new Error('feed failed'));
    const res = await requestRoute(publicApiRoutes, '/stream?cursor=0');
    const reader = res.body!.getReader();
    const readPromise = reader.read();
    await vi.advanceTimersByTimeAsync(5000);
    const { value } = await readPromise;
    reader.cancel();
    vi.useRealTimers();
    expect(new TextDecoder().decode(value)).toContain('event: error');
  });

  it('public API stream advances cursor when feed returns no events', async () => {
    vi.useFakeTimers();
    const { queryFeed } = await import('../../src/services/publicApi/feed');
    vi.mocked(queryFeed).mockResolvedValue({ events: [], nextCursor: 5 });
    const res = await requestRoute(publicApiRoutes, '/stream?cursor=0');
    const reader = res.body!.getReader();
    await vi.advanceTimersByTimeAsync(5000);
    await reader.cancel();
    vi.useRealTimers();
    expect(vi.mocked(queryFeed)).toHaveBeenCalled();
  });

  it('player events coalesces undefined results', async () => {
    const env = createRouteTestEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM players WHERE id')) {
            return binds[0] === 'p-test-1' ? { id: 'p-test-1', name: 'Test Player' } : null;
          }
          return null;
        },
        all: () => ({ results: undefined as unknown as [] }),
      }),
    });
    const { res, json } = await jsonRoute<{ data: unknown[] }>(playerRoutes, '/p-test-1/events', { env });
    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
  });

  it('team squad and form cover nullish coalescing branches', async () => {
    const env = createRouteTestEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM teams WHERE id') && binds[0] === 'team-w26-a1') {
            return { ...FIXTURE_TEAMS[0], collective_strength_rating: null };
          }
          if (sql.includes('FROM team_coaches tc')) {
            return {
              id: 'coach-1',
              name: 'Coach',
              nationality: 'MEX',
              wc_appearances: 1,
              tenure_years: 2,
              tactical_rating: 0.7,
              discipline_index: 0.4,
            };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM squad_players sp')) return { results: undefined as unknown as [] };
          return { results: [] };
        },
      }),
    });
    const squad = await jsonRoute(teamRoutes, '/team-w26-a1/squad', { env });
    expect(squad.res.status).toBe(200);
    expect(squad.json.data).toEqual([]);

    const form = await jsonRoute<{ data: { recentForm: number } }>(teamRoutes, '/team-w26-a1/form', { env });
    expect(form.res.status).toBe(200);
    expect(form.json.data.recentForm).toBeCloseTo(0.75);
  });

  it('match intelligence AI explainers tolerate failures', async () => {
    const { explainTeamSystemStrength } = await import('../../src/ai/explainTeamSystemStrength');
    vi.mocked(explainTeamSystemStrength).mockRejectedValueOnce(new Error('ai down'));
    const { res, json } = await jsonRoute<{ ai: null }>(
      matchIntelligenceRoutes,
      `/${FIXTURE_MATCH.id}/team-system`,
    );
    expect(res.status).toBe(200);
    expect(json.ai).toBeNull();
  });

  it('scenario predictions AI explainers tolerate failures', async () => {
    const { explainScenarioComparison } = await import('../../src/ai/explainScenarioComparison');
    vi.mocked(explainScenarioComparison).mockRejectedValueOnce(new Error('ai down'));
    const { res, json } = await jsonRoute<{ ai: null }>(
      scenarioPredictionRoutes,
      `/${FIXTURE_MATCH.id}/scenario-comparison`,
    );
    expect(res.status).toBe(200);
    expect(json.ai).toBeNull();
  });

  it('scenario prediction detail handles missing scenario id', async () => {
    const { getScenarioById } = await import('../../src/db/repositories/matchPredictionScenarioRepo');
    vi.mocked(getScenarioById).mockResolvedValueOnce(null);
    const { res } = await jsonRoute(
      scenarioPredictionRoutes,
      `/${FIXTURE_MATCH.id}/scenario-predictions/sc-missing`,
    );
    expect(res.status).toBe(404);
  });

  it('admin market source optional fields use defaults', async () => {
    const { res } = await jsonRoute(adminRoutes, '/market-sources', {
      method: 'POST',
      env: adminEnv(),
      headers: adminHeaders(),
      body: { id: 'ms-min', name: 'Minimal', source_type: 'manual_analyst_input' },
    });
    expect(res.status).toBe(201);
  });

  it('scenario routes return 404 for unknown match refs', async () => {
    const detail = await jsonRoute(scenarioPredictionRoutes, '/m-unknown/scenario-predictions/sc-1');
    expect(detail.res.status).toBe(404);
    const compare = await jsonRoute(scenarioPredictionRoutes, '/m-unknown/scenario-comparison');
    expect(compare.res.status).toBe(404);
    const regen = await jsonRoute(scenarioPredictionRoutes, '/m-unknown/scenario-predictions/regenerate', {
      method: 'POST',
    });
    expect(regen.res.status).toBe(404);
  });

  it('match sub-routes return 404 when service payloads are missing', async () => {
    const { getMatchStats } = await import('../../src/services/matchStats');
    const { getMatchRecap } = await import('../../src/services/matchRecap');
    const { getMatchStaff } = await import('../../src/services/matchStaff');
    vi.mocked(getMatchStats).mockResolvedValueOnce(null);
    vi.mocked(getMatchRecap).mockResolvedValueOnce(null);
    vi.mocked(getMatchStaff).mockResolvedValueOnce(null);
    expect((await jsonRoute(matchRoutes, `/${FIXTURE_MATCH.id}/stats`)).res.status).toBe(404);
    expect((await jsonRoute(matchRoutes, `/${FIXTURE_MATCH.id}/recap`)).res.status).toBe(404);
    expect((await jsonRoute(matchRoutes, `/${FIXTURE_MATCH.id}/staff`)).res.status).toBe(404);
  });

  it('match intelligence scenario AI failure is tolerated', async () => {
    const { explainScenarioLikelihood } = await import('../../src/ai/explainScenarioLikelihood');
    vi.mocked(explainScenarioLikelihood).mockRejectedValueOnce(new Error('ai down'));
    const { res, json } = await jsonRoute<{ ai: null }>(matchIntelligenceRoutes, `/${FIXTURE_MATCH.id}/scenarios`);
    expect(res.status).toBe(200);
    expect(json.ai).toBeNull();
  });

  it('match intelligence model-vs-market AI failure is tolerated', async () => {
    const { buildModelVsMarket } = await import('../../src/services/matchIntelligence');
    const { explainModelVsMarket } = await import('../../src/ai/explainModelVsMarket');
    vi.mocked(buildModelVsMarket).mockResolvedValueOnce({
      matchId: FIXTURE_MATCH.id,
      model: { home: 0.5, draw: 0.25, away: 0.25 },
      market: { home: 0.48, draw: 0.27, away: 0.25 },
      delta: { home: 0.02, draw: -0.02, away: 0 },
    } as never);
    vi.mocked(explainModelVsMarket).mockRejectedValueOnce(new Error('ai down'));
    const { res, json } = await jsonRoute<{ ai: null }>(
      matchIntelligenceRoutes,
      `/${FIXTURE_MATCH.id}/model-vs-market`,
    );
    expect(res.status).toBe(200);
    expect(json.ai).toBeNull();
  });
});
