import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crawlWorldCupNews } from '../src/ingestion/newsCrawler';
import { createIngestionEnv } from './helpers/ingestionMockDb';
import { NEWS_CRAWL_KV_KEY } from '../src/constants/pipeline';

vi.mock('../src/services/newsPublish', () => ({
  publishNewsArticle: vi.fn(async (_env, _feed, item: { link: string }) =>
    item.link.includes('new') ? 'doc-1' : null,
  ),
}));

vi.mock('../src/services/newsThumbnailBackfill', () => ({
  backfillNewsThumbnails: vi.fn(async () => 2),
}));

vi.mock('../src/ingestion/adapters/FifaWc2026NewsAdapter', () => ({
  fetchFifaWc2026NewsItems: vi.fn(async () => [
    {
      title: 'FIFA WC2026',
      link: 'https://www.fifa.com/en/articles/new-host',
      description: 'World Cup news',
      pubDate: '2026-01-01',
      imageUrl: null,
    },
    {
      title: 'Duplicate skip',
      link: 'https://www.fifa.com/en/articles/existing',
      description: 'World Cup',
      pubDate: '2026-01-01',
      imageUrl: null,
    },
  ]),
}));

describe('ingestion newsCrawler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('logs non-OK RSS responses and continues', async () => {
    const { fetchFifaWc2026NewsItems } = await import('../src/ingestion/adapters/FifaWc2026NewsAdapter');
    vi.mocked(fetchFifaWc2026NewsItems).mockResolvedValueOnce([]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
    const { env } = createIngestionEnv();
    const inserted = await crawlWorldCupNews(env);
    expect(inserted).toBe(0);
  });

  it('crawls RSS feeds and FIFA adapter, backfills thumbnails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('fail-feed')) {
        return new Response('error', { status: 503 });
      }
      const xml = `<rss><channel><item>
        <title>Mexico World Cup 2026 lineup</title>
        <link>https://news.example.com/new-rss</link>
        <description>FIFA tournament update</description>
        <pubDate>Mon, 01 Jun 2026 12:00:00 GMT</pubDate>
      </item></channel></rss>`;
      return new Response(xml, { status: 200 });
    });

    const { env } = createIngestionEnv();
    const inserted = await crawlWorldCupNews(env);
    expect(inserted).toBeGreaterThan(0);
    expect(env.KV.put).toHaveBeenCalledWith(NEWS_CRAWL_KV_KEY, expect.any(String), expect.any(Object));
    const { backfillNewsThumbnails } = await import('../src/services/newsThumbnailBackfill');
    expect(backfillNewsThumbnails).toHaveBeenCalledWith(env, 60);
  });

  it('logs RSS fetch failures and continues', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    const { env } = createIngestionEnv();
    const inserted = await crawlWorldCupNews(env);
    expect(inserted).toBeGreaterThanOrEqual(0);
  });

  it('handles FIFA adapter errors gracefully', async () => {
    const { fetchFifaWc2026NewsItems } = await import('../src/ingestion/adapters/FifaWc2026NewsAdapter');
    vi.mocked(fetchFifaWc2026NewsItems).mockRejectedValueOnce(new Error('fifa down'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<rss><channel></channel></rss>', { status: 200 }),
    );
    const { env } = createIngestionEnv();
    await expect(crawlWorldCupNews(env)).resolves.toBe(0);
  });
});
