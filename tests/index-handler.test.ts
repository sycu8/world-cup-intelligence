import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouteTestEnv } from './helpers/mockRouteDb';
import { mockExecutionCtx } from './helpers/routeHarness';
import { matchWithNames } from './helpers/fixtures';
import { buildMatchSlug } from '../src/utils/matchSlug';

const mocks = vi.hoisted(() => ({
  handleIngestBatch: vi.fn(async () => undefined),
  handleModelBatch: vi.fn(async () => undefined),
  handleScheduledCron: vi.fn(async () => undefined),
  getPathCachedResponse: vi.fn(async () => null as Response | null),
  putPathCachedResponse: vi.fn(async () => undefined),
}));

vi.mock('../src/queues/ingestConsumer', () => ({
  handleIngestBatch: mocks.handleIngestBatch,
}));

vi.mock('../src/queues/modelConsumer', () => ({
  handleModelBatch: mocks.handleModelBatch,
}));

vi.mock('../src/scheduled/cron', () => ({
  handleScheduledCron: mocks.handleScheduledCron,
}));

vi.mock('../src/services/workersPathCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/workersPathCache')>();
  return {
    ...actual,
    getPathCachedResponse: mocks.getPathCachedResponse,
    putPathCachedResponse: mocks.putPathCachedResponse,
  };
});

import worker from '../src/index';

const fixtureMatch = matchWithNames();
const matchSlug = buildMatchSlug({
  stage: fixtureMatch.stage,
  groupCode: fixtureMatch.group_code,
  homeName: fixtureMatch.home_name,
  awayName: fixtureMatch.away_name,
});

function assetsBinding(responses: Record<string, Response | ((url: string) => Response)>) {
  return {
    fetch: vi.fn(async (req: Request) => {
      const url = new URL(req.url);
      const handler = responses[url.pathname];
      if (typeof handler === 'function') return handler(url.pathname);
      if (handler) return handler;
      return new Response('not found', { status: 404 });
    }),
  } as never;
}

describe('index default export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPathCachedResponse.mockResolvedValue(null);
    mocks.putPathCachedResponse.mockResolvedValue(undefined);
  });

  it('fetch serves SPA root via ASSETS binding', async () => {
    const html = '<html><head></head><body>PitchIntel</body></html>';
    const assetsFetch = vi.fn(async () => new Response(html, { status: 200 }));
    const env = createRouteTestEnv({
      ASSETS: { fetch: assetsFetch } as never,
    });

    const res = await worker.fetch(new Request('https://example.com/'), env, mockExecutionCtx);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('PitchIntel');
    expect(assetsFetch).toHaveBeenCalled();
    expect(mocks.putPathCachedResponse).toHaveBeenCalledWith('spa:/', expect.any(Response), 60);
  });

  it('fetch returns cached SPA root when path cache hits', async () => {
    const cached = new Response('cached-root', { status: 200, headers: { 'Content-Type': 'text/html' } });
    mocks.getPathCachedResponse.mockResolvedValueOnce(cached);
    const env = createRouteTestEnv({
      ASSETS: assetsBinding({ '/': new Response('unused', { status: 200 }) }),
    });

    const res = await worker.fetch(new Request('https://example.com/'), env, mockExecutionCtx);
    expect(await res.text()).toBe('cached-root');
  });

  it('fetch handles /api/health JSON route', async () => {
    const env = createRouteTestEnv();
    const res = await worker.fetch(new Request('https://example.com/api/health'), env, mockExecutionCtx);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe('healthy');
  });

  it('fetch applies CORS wildcard when configured', async () => {
    const env = createRouteTestEnv({ CORS_ORIGINS: '*' });
    const res = await worker.fetch(
      new Request('https://example.com/api/health', {
        headers: { Origin: 'https://app.example.com' },
      }),
      env,
      mockExecutionCtx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('fetch skips CORS middleware when origins list is empty', async () => {
    const env = createRouteTestEnv({ CORS_ORIGINS: '' });
    const res = await worker.fetch(new Request('https://example.com/api/health'), env, mockExecutionCtx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('fetch serves static assets without SPA fallback when asset exists', async () => {
    const env = createRouteTestEnv({
      ASSETS: assetsBinding({
        '/assets/app-deadbeef.js': new Response('console.log(1)', {
          status: 200,
          headers: { 'Content-Type': 'application/javascript' },
        }),
      }),
    });
    const res = await worker.fetch(
      new Request('https://example.com/assets/app-deadbeef.js'),
      env,
      mockExecutionCtx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    expect(await res.text()).toBe('console.log(1)');
  });

  it('fetch falls back to index.html for unknown SPA paths', async () => {
    const indexHtml = '<html><head></head><body id="root"></body></html>';
    const env = createRouteTestEnv({
      ASSETS: assetsBinding({
        '/teams': new Response('missing', { status: 404 }),
        '/index.html': new Response(indexHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }),
      }),
    });

    const res = await worker.fetch(new Request('https://example.com/teams'), env, mockExecutionCtx);
    expect(await res.text()).toContain('root');
    expect(res.headers.get('Link')).toContain('https://example.com/');
    expect(mocks.putPathCachedResponse).toHaveBeenCalledWith('spa:/teams', expect.any(Response), 60);
  });

  it('fetch returns path-cached match SPA response', async () => {
    const cached = new Response('<html>cached match</html>', { status: 200 });
    mocks.getPathCachedResponse.mockImplementation(async (key: string) =>
      key === `spa:match:${matchSlug}` ? cached : null,
    );
    const env = createRouteTestEnv({
      ASSETS: assetsBinding({}),
    });

    const res = await worker.fetch(
      new Request(`https://example.com/matches/${matchSlug}`),
      env,
      mockExecutionCtx,
    );
    expect(await res.text()).toContain('cached match');
  });

  it('fetch serves KV-cached injected HTML for match slug', async () => {
    const injected = '<html><head><title>Mexico vs South Africa</title></head><body></body></html>';
    const kv = {
      get: vi.fn(async (key: string) =>
        key === `cache:spa-match-html:${matchSlug}` ? injected : null,
      ),
      put: vi.fn(async () => undefined),
    };
    const env = createRouteTestEnv({
      KV: kv as never,
      ASSETS: assetsBinding({
        [`/matches/${matchSlug}`]: new Response('missing', { status: 404 }),
        '/index.html': new Response('<html><body></body></html>', { status: 200 }),
      }),
    });

    const res = await worker.fetch(
      new Request(`https://example.com/matches/${matchSlug}`),
      env,
      mockExecutionCtx,
    );
    expect(await res.text()).toContain('Mexico vs South Africa');
    expect(mocks.putPathCachedResponse).toHaveBeenCalled();
  });

  it('fetch injects match meta when slug resolves in DB', async () => {
    const indexHtml = '<!DOCTYPE html><html><head><title>App</title></head><body></body></html>';
    const kv = {
      get: vi.fn(async (key: string) => {
        if (key === `cache:match-ref:${matchSlug}`) {
          return JSON.stringify({ ...fixtureMatch, slug: matchSlug });
        }
        return null;
      }),
      put: vi.fn(async () => undefined),
    };
    const env = createRouteTestEnv({
      KV: kv as never,
      ASSETS: assetsBinding({
        [`/matches/${matchSlug}`]: new Response('missing', { status: 404 }),
        '/index.html': new Response(indexHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }),
      }),
    });

    const res = await worker.fetch(
      new Request(`https://example.com/matches/${matchSlug}`),
      env,
      mockExecutionCtx,
    );
    const html = await res.text();
    expect(html).toContain('Mexico');
    expect(html).toContain('South Africa');
    expect(kv.put).toHaveBeenCalled();
  });

  it('fetch still returns injected HTML when KV put fails', async () => {
    const indexHtml = '<!DOCTYPE html><html><head><title>App</title></head><body></body></html>';
    const kv = {
      get: vi.fn(async (key: string) => {
        if (key === `cache:match-ref:${matchSlug}`) {
          return JSON.stringify({ ...fixtureMatch, slug: matchSlug });
        }
        return null;
      }),
      put: vi.fn(async () => {
        throw new Error('kv down');
      }),
    };
    const env = createRouteTestEnv({
      KV: kv as never,
      ASSETS: assetsBinding({
        [`/matches/${matchSlug}`]: new Response('missing', { status: 404 }),
        '/index.html': new Response(indexHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }),
      }),
    });

    const res = await worker.fetch(
      new Request(`https://example.com/matches/${matchSlug}`),
      env,
      mockExecutionCtx,
    );
    expect(await res.text()).toContain('Mexico');
  });

  it('queue routes ingest jobs by idempotencyKey shape', async () => {
    const env = createRouteTestEnv();
    await worker.queue(
      {
        messages: [{ body: { type: 'crawl_news', idempotencyKey: 'k1' }, ack: vi.fn(), retry: vi.fn() }],
      } as never,
      env,
    );
    expect(mocks.handleIngestBatch).toHaveBeenCalled();
  });

  it('queue routes model jobs when idempotencyKey absent', async () => {
    const env = createRouteTestEnv();
    await worker.queue(
      {
        messages: [{ body: { type: 'recompute', matchId: 'm-1' }, ack: vi.fn(), retry: vi.fn() }],
      } as never,
      env,
    );
    expect(mocks.handleModelBatch).toHaveBeenCalled();
  });

  it('scheduled delegates to cron handler', async () => {
    const env = createRouteTestEnv();
    await worker.scheduled({ cron: '* * * * *' } as ScheduledController, env, mockExecutionCtx);
    expect(mocks.handleScheduledCron).toHaveBeenCalledWith(env, '* * * * *', mockExecutionCtx);
  });
});
