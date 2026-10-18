import { describe, expect, it, vi } from 'vitest';
import { publishNewsArticle } from '../src/services/newsPublish';
import { createMockDb, createMockEnv } from './helpers/mockEnv';

vi.mock('../src/ai/translateNews', () => ({
  translateNewsHeadline: vi.fn(async () => ({
    titleVi: 'Tiêu đề',
    summaryVi: 'Tóm tắt',
  })),
}));

vi.mock('../src/services/newsImagePipeline', () => ({
  compressAndStoreNewsImage: vi.fn(async () => 'news/thumbs/doc.webp'),
  newsAssetPublicPath: vi.fn((id: string) => `/api/news/assets/${id}`),
}));

vi.mock('../src/services/newsSourceBackfill', () => ({
  registerNewsFeedSource: vi.fn(async () => 'src-feed-1'),
}));

describe('publishNewsArticle', () => {
  const feed = {
    id: 'feed-bbc',
    name: 'BBC Sport',
    url: 'https://example.com/rss',
    reliability: 0.85,
  };
  const item = {
    title: 'Mexico injury update',
    link: 'https://example.com/article-1',
    description: 'Player ruled out before opener.',
    pubDate: '2026-01-10T12:00:00Z',
    imageUrl: 'https://cdn.example.com/img.jpg',
  };

  it('inserts new article and enqueues model processing', async () => {
    const queueSend = vi.fn(async () => undefined);
    const r2Put = vi.fn(async () => undefined);
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        run: () => ({ success: true, meta: { changes: 1 } }),
      }),
      R2_RAW: { put: r2Put } as never,
      MODEL_QUEUE: { send: queueSend } as never,
    });

    const docId = await publishNewsArticle(env, feed, item);
    expect(docId).toMatch(/^doc-/);
    expect(r2Put).toHaveBeenCalled();
    expect(queueSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ai_extract_news', documentId: docId }),
    );
  });

  it('returns null for duplicate source_url', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ id: 'existing' }),
      }),
    });
    expect(await publishNewsArticle(env, feed, item)).toBeNull();
  });
});
