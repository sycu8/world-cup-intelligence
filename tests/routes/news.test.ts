import { describe, it, expect, vi, beforeEach } from 'vitest';
import { newsRoutes } from '../../src/routes/news';
import { FIXTURE_NEWS } from '../helpers/fixtures';
import { jsonRoute, requestRoute } from '../helpers/routeHarness';
import { createMockKv } from '../helpers/mockEnv';
import { createRouteTestEnv } from '../helpers/mockRouteDb';
import * as newsImagePipeline from '../../src/services/newsImagePipeline';

vi.mock('../../src/services/newsTranslation', () => ({
  ensureNewsArticleTranslated: vi.fn(async (env, row) => ({
    title_vi: row.title_vi ?? 'Tiêu đề',
    summary_vi: row.summary_vi ?? 'Tóm tắt',
  })),
  backfillNewsTranslations: vi.fn(async () => undefined),
  countUntranslatedNews: vi.fn(async () => 3),
  resolvePublisherLabel: vi.fn((row) => row.source_name ?? 'Source'),
}));

vi.mock('../../src/services/newsThumbnailBackfill', () => ({
  backfillNewsThumbnails: vi.fn(async () => undefined),
  recompressNewsThumbnails: vi.fn(async () => undefined),
  resolveNewsThumbSourceUrl: vi.fn(async () => 'https://cdn.example.com/thumb.jpg'),
}));

vi.mock('../../src/services/newsSourceBackfill', () => ({
  backfillNewsSources: vi.fn(async () => undefined),
}));

vi.mock('../../src/services/newsImagePipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof newsImagePipeline>();
  return {
    ...actual,
    thumbNeedsRecompress: vi.fn(() => false),
    compressAndStoreNewsImage: vi.fn(async () => undefined),
  };
});

vi.mock('../../src/services/pipelineBootstrap', () => ({
  ensureNewsCrawlFresh: vi.fn(async () => undefined),
}));

describe('news routes extended', () => {
  beforeEach(() => {
    vi.mocked(newsImagePipeline.thumbNeedsRecompress).mockReturnValue(false);
  });

  it('GET / supports pagination query params', async () => {
    const { res, json } = await jsonRoute<{
      meta: { page: number; pageSize: number; hotCount: number };
    }>(newsRoutes, '/?page=2&pageSize=10&hot=2');
    expect(res.status).toBe(200);
    expect(json.meta.page).toBe(2);
    expect(json.meta.pageSize).toBe(10);
  });

  it('GET / triggers KV backfill branches when meta keys missing', async () => {
    const kv = createMockKv({});
    const env = createRouteTestEnv({ KV: kv });
    const { res } = await jsonRoute(newsRoutes, '/', { env });
    expect(res.status).toBe(200);
  });

  it('GET / triggers untranslated backfill when count > 0', async () => {
    const kv = createMockKv({
      'meta:last_news_thumb_backfill': new Date().toISOString(),
      'meta:last_news_thumb_recompress': new Date().toISOString(),
      'meta:last_news_source_backfill': new Date().toISOString(),
      'meta:news_untranslated_count': '5',
    });
    const env = createRouteTestEnv({ KV: kv });
    const { res } = await jsonRoute(newsRoutes, '/', { env });
    expect(res.status).toBe(200);
  });

  it('GET /:docId returns article with impact fields', async () => {
    const env = createRouteTestEnv(
      {},
      {
        news: [
          {
            ...FIXTURE_NEWS,
            impact_level: 'high',
            impact_summary_vi: 'Ảnh hưởng cao',
            affected_match_ids_json: '["m-w26-ga-1v2","bad-json',
          },
        ],
      },
    );
    const { res, json } = await jsonRoute<{ data: { impact_level: string; affected_match_ids: string[] } }>(
      newsRoutes,
      '/news-1',
      { env },
    );
    expect(res.status).toBe(200);
    expect(json.data.impact_level).toBe('high');
    expect(json.data.affected_match_ids).toEqual([]);
  });

  it('GET /:docId returns 404 for missing article', async () => {
    const { res } = await jsonRoute(newsRoutes, '/missing-doc');
    expect(res.status).toBe(404);
  });

  it('GET /assets/:docId redirects to external thumbnail when R2 missing', async () => {
    const env = createRouteTestEnv({
      R2_ARTIFACTS: {
        head: async () => null,
        get: async () => null,
      } as never,
    });
    const res = await requestRoute(newsRoutes, '/assets/news-1', { env });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('https://');
  });

  it('GET /assets/:docId returns proxied image when recompress needed', async () => {
    vi.mocked(newsImagePipeline.thumbNeedsRecompress).mockReturnValue(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/jpeg' } })),
    );
    const env = createRouteTestEnv({
      R2_ARTIFACTS: {
        head: async () => ({ httpMetadata: { contentType: 'image/png' }, size: 900_000 }),
        get: async () => null,
      } as never,
    });
    const res = await requestRoute(newsRoutes, '/assets/news-1', { env });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/jpeg');
    vi.unstubAllGlobals();
  });

  it('GET /assets/:docId serves R2 object when present', async () => {
    const body = new Uint8Array([1, 2, 3]);
    const env = createRouteTestEnv({
      R2_ARTIFACTS: {
        head: async () => ({ httpMetadata: { contentType: 'image/webp' }, size: 1000 }),
        get: async () => ({
          body,
          writeHttpMetadata: (headers: Headers) => headers.set('Content-Type', 'image/webp'),
        }),
      } as never,
    });
    const res = await requestRoute(newsRoutes, '/assets/news-1', { env });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/webp');
  });

  it('GET /assets/:docId returns 404 when R2 get missing after head', async () => {
    vi.mocked(newsImagePipeline.thumbNeedsRecompress).mockReturnValue(false);
    const env = createRouteTestEnv({
      R2_ARTIFACTS: {
        head: async () => ({ httpMetadata: { contentType: 'image/webp' }, size: 1000 }),
        get: async () => null,
      } as never,
    });
    const { res } = await jsonRoute(newsRoutes, '/assets/news-1', { env });
    expect(res.status).toBe(404);
  });
});
