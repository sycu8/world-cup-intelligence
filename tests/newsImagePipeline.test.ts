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

  it('falls back to jpeg blob when canvas webp conversion fails', async () => {
    const jpegBytes = new Uint8Array(5000).fill(2);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(jpegBytes, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      ),
    );

    const originalConvert = OffscreenCanvas.prototype.convertToBlob;
    OffscreenCanvas.prototype.convertToBlob = vi.fn(async (opts?: { type?: string }) => {
      if (opts?.type === 'image/webp') throw new Error('webp unsupported');
      return new Blob([jpegBytes], { type: 'image/jpeg' });
    });

    const put = vi.fn(async () => undefined);
    const env = createMockEnv({ R2_ARTIFACTS: { put } as never });
    const key = await compressAndStoreNewsImage(env, 'doc-jpeg', 'https://cdn.example.com/photo.jpg');
    expect(key).toBe('news/thumbs/doc-jpeg.webp');
    expect(put).toHaveBeenCalled();
    OffscreenCanvas.prototype.convertToBlob = originalConvert;
  });

  it('returns null when optimized blob still too large', async () => {
    const huge = new Uint8Array(100_000).fill(1);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(huge, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      ),
    );
    const env = createMockEnv({ R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never });
    expect(await compressAndStoreNewsImage(env, 'doc-big', 'https://cdn.example.com/big.jpg')).toBeNull();
  });

  it('accepts octet-stream URLs that look like images', async () => {
    const bytes = new Uint8Array(5000).fill(3);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const cf = (init as RequestInit)?.cf as { image?: unknown } | undefined;
        if (cf?.image) {
          return new Response(bytes, { status: 200, headers: { 'content-type': 'image/webp' } });
        }
        return new Response(bytes, {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
        });
      }),
    );
    const put = vi.fn(async () => undefined);
    const env = createMockEnv({ R2_ARTIFACTS: { put } as never });
    const key = await compressAndStoreNewsImage(env, 'doc-octet', 'https://cdn.example.com/pic.jpg');
    expect(key).toBe('news/thumbs/doc-octet.webp');
  });

  it('returns null when image download throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network');
    }));
    expect(await compressAndStoreNewsImage(createMockEnv(), 'doc-err', 'https://cdn.example.com/x.jpg')).toBeNull();
  });
});
