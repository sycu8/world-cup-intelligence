import { describe, expect, it } from 'vitest';
import {
  newsThumbnailR2Key,
  newsAssetPublicPath,
  thumbNeedsRecompress,
  NEWS_THUMB_MAX_WIDTH,
} from '../src/services/newsImagePipeline';

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
