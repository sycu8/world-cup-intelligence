import { describe, expect, it, vi } from 'vitest';
import {
  compressAndStoreNewsImage,
  newsAssetPublicPath,
  newsThumbnailR2Key,
  thumbNeedsRecompress,
  NEWS_THUMB_MAX_WIDTH,
} from '../src/services/newsImagePipeline';
import { createMockEnv } from './helpers/mockEnv';

describe('newsImagePipeline paths', () => {
  it('builds stable R2 and CDN paths', () => {
    expect(newsThumbnailR2Key('doc-abc')).toBe('news/thumbs/doc-abc.webp');
    expect(newsAssetPublicPath('doc-abc')).toBe('/api/news/assets/doc-abc');
  });

  it('targets card-friendly thumb width', () => {
    expect(NEWS_THUMB_MAX_WIDTH).toBe(400);
  });

  it('flags legacy or oversized thumbs for recompress', () => {
    expect(thumbNeedsRecompress('image/jpeg', 70_000)).toBe(true);
    expect(thumbNeedsRecompress('image/jpeg', 20_000)).toBe(false);
    expect(thumbNeedsRecompress('image/webp', 90_000)).toBe(true);
    expect(thumbNeedsRecompress('image/webp', 40_000)).toBe(false);
  });
});

describe('compressAndStoreNewsImage', () => {
  it('stores optimized webp blob on R2 when fetch succeeds', async () => {
    const webpBytes = new Uint8Array(5000).fill(1);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(webpBytes, {
          status: 200,
          headers: { 'content-type': 'image/webp' },
        }),
      ),
    );

    const put = vi.fn(async () => undefined);
    const env = createMockEnv({
      R2_ARTIFACTS: { put } as never,
    });

    const key = await compressAndStoreNewsImage(env, 'doc-99', 'https://cdn.example.com/photo.jpg');
    expect(key).toBe('news/thumbs/doc-99.webp');
    expect(put).toHaveBeenCalledWith(
      'news/thumbs/doc-99.webp',
      expect.any(ArrayBuffer),
      expect.objectContaining({ httpMetadata: expect.objectContaining({ contentType: 'image/webp' }) }),
    );
  });

  it('returns null for missing image url', async () => {
    const env = createMockEnv();
    expect(await compressAndStoreNewsImage(env, 'doc-x', null)).toBeNull();
  });
});
