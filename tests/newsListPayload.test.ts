import { describe, expect, it } from 'vitest';
import { fetchHotNewsArticles, mapNewsArticle } from '../src/services/newsListPayload';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_NEWS } from './helpers/fixtures';

describe('newsListPayload', () => {
  it('maps translated article with R2 thumbnail path', () => {
    const mapped = mapNewsArticle({
      ...FIXTURE_NEWS,
      thumbnail_r2_key: 'news/thumbs/news-1.webp',
    });
    expect(mapped.translated).toBe(true);
    expect(mapped.title).toBe(FIXTURE_NEWS.title_vi);
    expect(mapped.thumbnail_url).toBe('/api/news/assets/news-1');
    expect(mapped.source_name).toBe('Test Source');
  });

  it('falls back to English when translation missing', () => {
    const mapped = mapNewsArticle({
      ...FIXTURE_NEWS,
      title_vi: null,
      summary_vi: null,
    });
    expect(mapped.translated).toBe(false);
    expect(mapped.title).toBe(FIXTURE_NEWS.title);
    expect(mapped.titleVi).toBeUndefined();
  });

  it('uses external http thumbnail when no R2 key', () => {
    const mapped = mapNewsArticle({
      ...FIXTURE_NEWS,
      thumbnail_url: 'https://cdn.example.com/img.jpg',
    });
    expect(mapped.thumbnail_url).toBe('https://cdn.example.com/img.jpg');
  });

  it('fetchHotNewsArticles queries and maps rows', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({ results: [FIXTURE_NEWS] }),
      }),
    });
    const articles = await fetchHotNewsArticles(env, 5);
    expect(articles).toHaveLength(1);
    expect(articles[0].id).toBe(FIXTURE_NEWS.id);
  });
});
