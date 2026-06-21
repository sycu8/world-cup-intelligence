import { describe, it, expect, vi } from 'vitest';
import { publicApiRoutes } from '../../src/routes/publicApi';
import { FIXTURE_MATCH } from '../helpers/fixtures';
import { jsonRoute, requestRoute } from '../helpers/routeHarness';
import { createRouteTestEnv } from '../helpers/mockRouteDb';
import { apiKeyHeaders, publicApiAuthEnv, TEST_API_KEY } from '../helpers/routeTestUtils';
import { createMockKv } from '../helpers/mockEnv';

vi.mock('../../src/services/publicApi/webhooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/publicApi/webhooks')>();
  return {
    ...actual,
    deliverWebhook: vi.fn(async () => ({ ok: true, status: 200 })),
  };
});

describe('public API routes extended', () => {
  it('returns 401 when API key required and missing', async () => {
    const env = createRouteTestEnv({ PUBLIC_API_REQUIRE_KEY: 'true' });
    const { res, json } = await jsonRoute<{ error: string }>(publicApiRoutes, '/feed', { env });
    expect(res.status).toBe(401);
    expect(json.error).toBe('API key required');
  });

  it('accepts Bearer token for API key', async () => {
    const env = await publicApiAuthEnv({ PUBLIC_API_REQUIRE_KEY: 'true' });
    const { res } = await jsonRoute(publicApiRoutes, '/feed', {
      env,
      headers: { Authorization: `Bearer ${TEST_API_KEY}` },
    });
    expect(res.status).toBe(200);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const bucket = Math.floor(Date.now() / 60_000);
    const kv = createMockKv({ [`ratelimit:api:anon:${bucket}`]: '9999' });
    const env = createRouteTestEnv({ KV: kv });
    const { res, json } = await jsonRoute<{ error: string }>(publicApiRoutes, '/feed', { env });
    expect(res.status).toBe(429);
    expect(json.error).toBe('Rate limit exceeded');
  });

  it('GET /feed supports matchId and types filters', async () => {
    const { res, json } = await jsonRoute<{ data: unknown[] }>(
      publicApiRoutes,
      `/feed?cursor=0&limit=10&matchId=${FIXTURE_MATCH.id}&types=match.score_updated`,
    );
    expect(res.status).toBe(200);
    expect(json.data.length).toBeGreaterThan(0);
  });

  it('GET /matches filters by status and since', async () => {
    const { res, json } = await jsonRoute<{ data: { status: string }[]; meta: { count: number } }>(
      publicApiRoutes,
      `/matches?status=scheduled&since=2025-01-01T00:00:00Z`,
    );
    expect(res.status).toBe(200);
    expect(json.meta.count).toBeGreaterThan(0);
    expect(json.data[0]?.status).toBe('scheduled');
  });

  it('GET /matches/:ref/snapshot returns 404 for unknown ref', async () => {
    const { res } = await jsonRoute(publicApiRoutes, '/matches/m-unknown/snapshot');
    expect(res.status).toBe(404);
  });

  it('GET /stream returns event-stream with events', async () => {
    const res = await requestRoute(publicApiRoutes, '/stream?cursor=0');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    reader.cancel();
    expect(new TextDecoder().decode(value)).toContain('event:');
  });

  it('POST /webhooks requires API key', async () => {
    const { res } = await jsonRoute(publicApiRoutes, '/webhooks', {
      method: 'POST',
      body: { url: 'https://hook.example.com' },
    });
    expect(res.status).toBe(401);
  });

  it('POST /webhooks returns 400 for invalid payload', async () => {
    const env = await publicApiAuthEnv();
    const { res } = await jsonRoute(publicApiRoutes, '/webhooks', {
      method: 'POST',
      env,
      headers: apiKeyHeaders(),
      body: { url: 'not-a-url' },
    });
    expect(res.status).toBe(400);
  });

  it('POST /webhooks creates subscription', async () => {
    const env = await publicApiAuthEnv();
    const { res, json } = await jsonRoute<{ secret: string }>(publicApiRoutes, '/webhooks', {
      method: 'POST',
      env,
      headers: apiKeyHeaders(),
      body: { url: 'https://hook.example.com/events', events: ['match.score_updated'] },
    });
    expect(res.status).toBe(200);
    expect(json.secret).toBeTruthy();
  });

  it('GET /webhooks lists subscriptions', async () => {
    const env = await publicApiAuthEnv();
    await jsonRoute(publicApiRoutes, '/webhooks', {
      method: 'POST',
      env,
      headers: apiKeyHeaders(),
      body: { url: 'https://hook.example.com/events' },
    });
    const { res, json } = await jsonRoute<{ data: unknown[] }>(publicApiRoutes, '/webhooks', {
      env,
      headers: apiKeyHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.data.length).toBeGreaterThan(0);
  });

  it('DELETE /webhooks/:id removes subscription', async () => {
    const env = await publicApiAuthEnv();
    await jsonRoute(publicApiRoutes, '/webhooks', {
      method: 'POST',
      env,
      headers: apiKeyHeaders(),
      body: { url: 'https://hook.example.com/events' },
    });
    const { res, json } = await jsonRoute<{ ok: boolean }>(publicApiRoutes, '/webhooks/wh-test-1', {
      method: 'DELETE',
      env,
      headers: apiKeyHeaders(),
    });
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it('DELETE /webhooks/:id returns 404 when missing', async () => {
    const env = await publicApiAuthEnv();
    const { res } = await jsonRoute(publicApiRoutes, '/webhooks/missing', {
      method: 'DELETE',
      env,
      headers: apiKeyHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it('POST /webhooks/:id/test delivers test event', async () => {
    const env = await publicApiAuthEnv();
    await jsonRoute(publicApiRoutes, '/webhooks', {
      method: 'POST',
      env,
      headers: apiKeyHeaders(),
      body: { url: 'https://hook.example.com/events' },
    });
    const { res, json } = await jsonRoute<{ ok: boolean; eventId: number }>(
      publicApiRoutes,
      '/webhooks/wh-test-1/test',
      { method: 'POST', env, headers: apiKeyHeaders() },
    );
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.eventId).toBeGreaterThan(0);
  });

  it('POST /webhooks/:id/test returns 404 for unknown webhook', async () => {
    const env = await publicApiAuthEnv();
    const { res } = await jsonRoute(publicApiRoutes, '/webhooks/missing/test', {
      method: 'POST',
      env,
      headers: apiKeyHeaders(),
    });
    expect(res.status).toBe(404);
  });
});

describe('public API stream error path', () => {
  it('emits error event when feed query fails', async () => {
    const env = createRouteTestEnv({
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => {
              throw new Error('db down');
            },
            first: async () => {
              throw new Error('db down');
            },
          }),
        }),
      } as never,
    });
    const res = await requestRoute(publicApiRoutes, '/stream?cursor=0', { env });
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    reader.cancel();
    expect(new TextDecoder().decode(value)).toContain('event: error');
  });
});
