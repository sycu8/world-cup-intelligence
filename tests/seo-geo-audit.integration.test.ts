import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouteTestEnv } from './helpers/mockRouteDb';
import { mockExecutionCtx } from './helpers/routeHarness';
import { SEO_PAGE_PATHS } from '../src/services/seoPages';

const mocks = vi.hoisted(() => ({
  getPathCachedResponse: vi.fn(async () => null as Response | null),
  putPathCachedResponse: vi.fn(async () => undefined),
}));

vi.mock('../src/services/workersPathCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/workersPathCache')>();
  return {
    ...actual,
    getPathCachedResponse: mocks.getPathCachedResponse,
    putPathCachedResponse: mocks.putPathCachedResponse,
  };
});

vi.mock('../src/queues/ingestConsumer', () => ({ handleIngestBatch: vi.fn() }));
vi.mock('../src/queues/modelConsumer', () => ({ handleModelBatch: vi.fn() }));
vi.mock('../src/scheduled/cron', () => ({ handleScheduledCron: vi.fn() }));

import worker from '../src/index';

const ORIGIN = 'https://wc.example.com';
const INDEX = `<!DOCTYPE html><html><head><title>Default</title></head><body><div id="root"></div></body></html>`;

function assetsBinding() {
  return {
    fetch: vi.fn(async (req: Request) => {
      const path = new URL(req.url).pathname;
      if (path === '/index.html' || path === '/') {
        return new Response(INDEX, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      return new Response('missing', { status: 404 });
    }),
  } as never;
}

function htmlChecks(html: string) {
  return {
    hasCanonical: /rel="canonical"/.test(html),
    hasJsonLd: /application\/ld\+json/.test(html),
    hasAnswer: /id="seo-answer"/.test(html),
  };
}

describe('SEO/GEO audit integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPathCachedResponse.mockResolvedValue(null);
  });

  it('passes crawlability checks for discovery endpoints', async () => {
    const env = createRouteTestEnv({ ASSETS: assetsBinding() });

    for (const path of ['/robots.txt', '/llms.txt', '/auth.md']) {
      const res = await worker.fetch(new Request(`${ORIGIN}${path}`), env, mockExecutionCtx);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text.length).toBeGreaterThan(20);
    }

    const robots = await (await worker.fetch(new Request(`${ORIGIN}/robots.txt`), env, mockExecutionCtx)).text();
    expect(robots).toContain('Sitemap:');
    expect(robots).toContain('Llms-Txt:');

    const llms = await (await worker.fetch(new Request(`${ORIGIN}/llms.txt`), env, mockExecutionCtx)).text();
    expect(llms).toContain('FIFA');
    for (const path of SEO_PAGE_PATHS.slice(0, 3)) {
      expect(llms).toContain(path);
    }
  });

  it('returns sitemap even when D1 queries fail', async () => {
    const env = createRouteTestEnv({
      ASSETS: assetsBinding(),
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => {
              throw new Error('d1 unavailable');
            },
          }),
          all: async () => {
            throw new Error('d1 unavailable');
          },
        }),
      } as never,
    });

    const res = await worker.fetch(new Request(`${ORIGIN}/sitemap.xml`), env, mockExecutionCtx);
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<urlset');
    for (const path of SEO_PAGE_PATHS) {
      expect(xml).toContain(path);
    }
  });

  it('injects answer-ready HTML for home, hubs, and SEO landings', async () => {
    const env = createRouteTestEnv({ ASSETS: assetsBinding() });
    const paths = ['/', '/matches', '/guide', '/news-intelligence', SEO_PAGE_PATHS[0]!];

    for (const path of paths) {
      const res = await worker.fetch(new Request(`${ORIGIN}${path}`), env, mockExecutionCtx);
      expect(res.status).toBe(200);
      const checks = htmlChecks(await res.text());
      expect(checks.hasCanonical, path).toBe(true);
      expect(checks.hasJsonLd, path).toBe(true);
      expect(checks.hasAnswer, path).toBe(true);
    }
  });

  it('maps priority query intents to SEO landing titles', async () => {
    const env = createRouteTestEnv({ ASSETS: assetsBinding() });
    const cases = [
      { path: '/lich-thi-dau-world-cup-2026', needle: 'Lịch thi đấu' },
      { path: '/du-doan-world-cup-2026', needle: 'Dự đoán' },
      { path: '/vong-knockout-world-cup-2026', needle: 'knockout' },
    ];

    for (const { path, needle } of cases) {
      const res = await worker.fetch(new Request(`${ORIGIN}${path}`), env, mockExecutionCtx);
      const html = await res.text();
      expect(html).toContain(needle);
      expect(html).toContain('FAQPage');
    }
  });
});
