import { describe, it, expect } from 'vitest';
import { healthRoutes } from '../src/routes/health';
import { homeRoutes } from '../src/routes/home';
import { scheduleRoutes } from '../src/routes/schedule';
import { dashboardRoutes } from '../src/routes/dashboard';
import { discoveryRoutes } from '../src/routes/discovery';
import { tournamentRoutes } from '../src/routes/tournaments';
import { matchRoutes } from '../src/routes/matches';
import { probabilityRoutes } from '../src/routes/probability';
import { searchRoutes } from '../src/routes/search';
import { teamRoutes } from '../src/routes/teams';
import { playerRoutes } from '../src/routes/players';
import { newsRoutes } from '../src/routes/news';
import { analysisRoutes } from '../src/routes/analysis';
import { adminRoutes } from '../src/routes/admin';
import { publicApiRoutes } from '../src/routes/publicApi';
import { FIXTURE_MATCH } from './helpers/fixtures';
import { jsonRoute, requestRoute } from './helpers/routeHarness';
import { createRouteTestEnv } from './helpers/mockRouteDb';

describe('health route', () => {
  it('GET / returns healthy payload', async () => {
    const { res, json } = await jsonRoute<{ status: string }>(healthRoutes, '/');
    expect(res.status).toBe(200);
    expect(json.status).toBe('healthy');
    expect(res.headers.get('Cache-Control')).toContain('max-age=10');
  });
});

describe('home route', () => {
  it('GET / returns combined homepage payload', async () => {
    const { res, json } = await jsonRoute<{ data: { schedule: unknown; dashboard: unknown } }>(
      homeRoutes,
      '/',
    );
    expect(res.status).toBe(200);
    expect(json.data.schedule).toBeDefined();
    expect(json.data.dashboard).toBeDefined();
  });
});

describe('schedule route', () => {
  it('GET / returns schedule grouped by date', async () => {
    const { res, json } = await jsonRoute<{
      data: { matches: unknown[]; byDate: Record<string, unknown[]> };
      meta: { year: number };
    }>(scheduleRoutes, '/');
    expect(res.status).toBe(200);
    expect(json.data.matches.length).toBeGreaterThan(0);
    expect(json.meta.year).toBe(2026);
  });
});

describe('dashboard route', () => {
  it('GET / returns dashboard metrics', async () => {
    const { res, json } = await jsonRoute<{ data: { matchCount: number; featuredMatch: unknown } }>(
      dashboardRoutes,
      '/',
    );
    expect(res.status).toBe(200);
    expect(json.data.matchCount).toBeGreaterThan(0);
    expect(json.data.featuredMatch).toBeTruthy();
  });
});

describe('discovery routes', () => {
  it('GET /robots.txt returns plain text', async () => {
    const res = await requestRoute(discoveryRoutes, '/robots.txt', {
      headers: { Host: 'wc.example.com' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    const text = await res.text();
    expect(text).toContain('Sitemap:');
    expect(text).toContain('Disallow: /api/admin/');
  });

  it('GET /.well-known/openapi.json returns API spec', async () => {
    const { res, json } = await jsonRoute<{ openapi: string }>(discoveryRoutes, '/.well-known/openapi.json', {
      headers: { Host: 'wc.example.com' },
    });
    expect(res.status).toBe(200);
    expect(json.openapi).toBeDefined();
  });

  it('GET /docs/api.md returns markdown docs', async () => {
    const res = await requestRoute(discoveryRoutes, '/docs/api.md');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('| GET | /health |');
  });

  it('GET /.well-known/jwks.json returns JWKS document', async () => {
    const { res, json } = await jsonRoute<{ keys: unknown[] }>(discoveryRoutes, '/.well-known/jwks.json');
    expect(res.status).toBe(200);
    expect(Array.isArray(json.keys)).toBe(true);
  });

  it('GET /oauth/authorize returns 501 with guidance', async () => {
    const { res, json } = await jsonRoute<{ error: string }>(discoveryRoutes, '/oauth/authorize');
    expect(res.status).toBe(501);
    expect(json.error).toBe('unsupported_grant');
  });
});

describe('tournament routes', () => {
  it('GET / lists WC2026 tournament', async () => {
    const { res, json } = await jsonRoute<{ data: { id: string }[] }>(tournamentRoutes, '/');
    expect(res.status).toBe(200);
    expect(json.data[0]?.id).toBe('t-2026');
  });

  it('GET /2026 returns tournament by year', async () => {
    const { res, json } = await jsonRoute<{ data: { year: number } }>(tournamentRoutes, '/2026');
    expect(res.status).toBe(200);
    expect(json.data.year).toBe(2026);
  });

  it('GET /2026/standings returns group standings payload', async () => {
    const { res, json } = await jsonRoute<{
      data: { tournamentId: string; groups: Record<string, unknown> };
    }>(tournamentRoutes, '/2026/standings');
    expect(res.status).toBe(200);
    expect(json.data.tournamentId).toBe('t-2026');
    expect(json.data.groups.A).toBeDefined();
  });

  it('GET /2026/match-probabilities returns probability board', async () => {
    const { res, json } = await jsonRoute<{
      data: Record<string, { homeWin: number }>;
      meta: { total: number };
    }>(tournamentRoutes, '/2026/match-probabilities');
    expect(res.status).toBe(200);
    expect(json.meta.total).toBeGreaterThan(0);
    expect(json.data[FIXTURE_MATCH.id]).toBeDefined();
  });

  it('GET /2018 returns 404', async () => {
    const { res } = await jsonRoute(tournamentRoutes, '/2018');
    expect(res.status).toBe(404);
  });
});

describe('match routes', () => {
  it('GET / lists matches with slugs', async () => {
    const { res, json } = await jsonRoute<{ data: { id: string; slug: string }[] }>(matchRoutes, '/');
    expect(res.status).toBe(200);
    expect(json.data[0]?.id).toBe(FIXTURE_MATCH.id);
    expect(json.data[0]?.slug).toBeTruthy();
  });

  it('GET /:matchId resolves match by legacy id', async () => {
    const { res, json } = await jsonRoute<{ data: { id: string; home_name: string } }>(
      matchRoutes,
      `/${FIXTURE_MATCH.id}`,
    );
    expect(res.status).toBe(200);
    expect(json.data.id).toBe(FIXTURE_MATCH.id);
    expect(json.data.home_name).toBe('Mexico');
  });

  it('GET /:matchId returns 404 for unknown match', async () => {
    const { res } = await jsonRoute(matchRoutes, '/m-unknown');
    expect(res.status).toBe(404);
  });
});

describe('probability routes', () => {
  it('GET /:matchId/probability serves cached snapshot path', async () => {
    const { res, json } = await jsonRoute<{
      data: {
        matchId: string;
        homeWinProb: number;
        topScorelines: { score: string; prob: number }[];
        drivers: string[];
      };
    }>(probabilityRoutes, `/${FIXTURE_MATCH.id}/probability`);
    expect(res.status).toBe(200);
    expect(json.data.matchId).toBe(FIXTURE_MATCH.id);
    expect(json.data.homeWinProb).toBeCloseTo(0.55);
    expect(json.data.topScorelines.length).toBeGreaterThan(0);
    expect(json.data.modelVersion).toBe('v1-test');
  });

  it('GET /:matchId/scoreline returns distribution', async () => {
    const { res, json } = await jsonRoute<{ data: Record<string, number> }>(
      probabilityRoutes,
      `/${FIXTURE_MATCH.id}/scoreline`,
    );
    expect(res.status).toBe(200);
    expect(json.data['2-1']).toBeCloseTo(0.12);
  });

  it('GET /:matchId/intervals returns interval distribution', async () => {
    const { res, json } = await jsonRoute<{ data: Record<string, number> }>(
      probabilityRoutes,
      `/${FIXTURE_MATCH.id}/intervals`,
    );
    expect(res.status).toBe(200);
    expect(json.data.firstHalf).toBeCloseTo(0.45);
  });
});

describe('search route', () => {
  it('GET /?q= returns teams, players, and matches', async () => {
    const { res, json } = await jsonRoute<{
      data: { teams: unknown[]; players: unknown[]; matches: unknown[] };
    }>(searchRoutes, '/?q=Mex');
    expect(res.status).toBe(200);
    expect(json.data.teams.length).toBeGreaterThan(0);
    expect(json.data.players.length).toBeGreaterThan(0);
    expect(json.data.matches.length).toBeGreaterThan(0);
  });
});

describe('team routes', () => {
  it('GET / lists tournament teams', async () => {
    const { res, json } = await jsonRoute<{ data: { id: string }[] }>(teamRoutes, '/');
    expect(res.status).toBe(200);
    expect(json.data.some((t) => t.id === 'team-w26-a1')).toBe(true);
  });

  it('GET /:teamId returns team profile', async () => {
    const { res, json } = await jsonRoute<{ data: { id: string; name: string; coach: unknown } }>(
      teamRoutes,
      '/team-w26-a1',
    );
    expect(res.status).toBe(200);
    expect(json.data.name).toBe('Mexico');
  });

  it('GET /:teamId/squad returns squad players', async () => {
    const { res, json } = await jsonRoute<{ data: { name: string }[] }>(teamRoutes, '/team-w26-a1/squad');
    expect(res.status).toBe(200);
    expect(json.data[0]?.name).toBe('Test Player');
  });

  it('GET /:teamId/form returns form metrics', async () => {
    const { res, json } = await jsonRoute<{ data: { teamId: string; eloRating: number } }>(
      teamRoutes,
      '/team-w26-a1/form',
    );
    expect(res.status).toBe(200);
    expect(json.data.teamId).toBe('team-w26-a1');
    expect(json.data.eloRating).toBeGreaterThan(0);
  });
});

describe('player routes', () => {
  it('GET / lists players', async () => {
    const { res, json } = await jsonRoute<{ data: { id: string }[] }>(playerRoutes, '/');
    expect(res.status).toBe(200);
    expect(json.data[0]?.id).toBe('p-test-1');
  });

  it('GET /:playerId returns player', async () => {
    const { res, json } = await jsonRoute<{ data: { name: string } }>(playerRoutes, '/p-test-1');
    expect(res.status).toBe(200);
    expect(json.data.name).toBe('Test Player');
  });

  it('GET /:playerId/form returns form stub', async () => {
    const { res, json } = await jsonRoute<{ data: { formScore: number } }>(playerRoutes, '/p-test-1/form');
    expect(res.status).toBe(200);
    expect(json.data.formScore).toBeCloseTo(0.72);
  });
});

describe('news routes', () => {
  it('GET / returns paginated news feed', async () => {
    const { res, json } = await jsonRoute<{
      data: { hot: unknown[]; articles: unknown[] };
      meta: { page: number; cdnAssets: boolean };
    }>(newsRoutes, '/');
    expect(res.status).toBe(200);
    expect(json.data.hot.length).toBeGreaterThan(0);
    expect(json.meta.cdnAssets).toBe(true);
  });

  it('GET /:docId returns article detail', async () => {
    const { res, json } = await jsonRoute<{ data: { id: string; title: string } }>(newsRoutes, '/news-1');
    expect(res.status).toBe(200);
    expect(json.data.id).toBe('news-1');
    expect(json.data.title).toBeTruthy();
  });
});

describe('analysis routes', () => {
  it('GET /config returns gateway config', async () => {
    const { res, json } = await jsonRoute<{ data: { viewOnly: boolean; routing: unknown[] } }>(
      analysisRoutes,
      '/config',
    );
    expect(res.status).toBe(200);
    expect(json.data.viewOnly).toBe(true);
    expect(json.data.routing.length).toBeGreaterThan(0);
  });

  it('GET /:matchId returns pending when analysis unavailable', async () => {
    const { res, json } = await jsonRoute<{ data: null; meta: { status: string } }>(
      analysisRoutes,
      `/${FIXTURE_MATCH.id}`,
    );
    expect(res.status).toBe(200);
    expect(json.data).toBeNull();
    expect(json.meta.status).toBe('pending_or_unconfigured');
  });
});

describe('admin routes', () => {
  it('GET /sources lists registry in development', async () => {
    const env = createRouteTestEnv({ ENVIRONMENT: 'development' });
    const { res, json } = await jsonRoute<{ data: { id: string }[] }>(adminRoutes, '/sources', { env });
    expect(res.status).toBe(200);
    expect(json.data[0]?.id).toBe('src-1');
  });

  it('POST /ingest queues ingest job', async () => {
    const env = createRouteTestEnv({ ENVIRONMENT: 'development' });
    const { res, json } = await jsonRoute<{ status: string }>(adminRoutes, '/ingest', {
      method: 'POST',
      env,
    });
    expect(res.status).toBe(200);
    expect(json.status).toBe('queued');
  });
});

describe('public API routes', () => {
  it('GET / returns API catalog', async () => {
    const { res, json } = await jsonRoute<{ version: string; events: string[] }>(publicApiRoutes, '/');
    expect(res.status).toBe(200);
    expect(json.version).toBe('v1');
    expect(json.events).toContain('match.score_updated');
  });

  it('GET /feed returns feed events', async () => {
    const { res, json } = await jsonRoute<{
      data: { id: number; type: string }[];
      meta: { count: number };
    }>(publicApiRoutes, '/feed?cursor=0');
    expect(res.status).toBe(200);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.meta.count).toBeGreaterThan(0);
  });

  it('GET /matches returns match list', async () => {
    const { res, json } = await jsonRoute<{ data: { matchId: string; slug: string }[] }>(
      publicApiRoutes,
      '/matches',
    );
    expect(res.status).toBe(200);
    expect(json.data[0]?.matchId).toBe(FIXTURE_MATCH.id);
  });

  it('GET /matches/:ref/snapshot returns match snapshot', async () => {
    const { res, json } = await jsonRoute<{
      data: { matchId: string; homeName: string; awayName: string };
    }>(publicApiRoutes, `/matches/${FIXTURE_MATCH.id}/snapshot`);
    expect(res.status).toBe(200);
    expect(json.data.matchId).toBe(FIXTURE_MATCH.id);
    expect(json.data.homeName).toBe('Mexico');
    expect(json.data.awayName).toBe('South Africa');
  });
});
