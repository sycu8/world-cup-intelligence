import { describe, expect, it } from 'vitest';
import { cacheControlForStaticAsset } from '../src/services/staticAssetCache';

describe('cacheControlForStaticAsset', () => {
  it('uses no-cache for HTML entry points', () => {
    expect(cacheControlForStaticAsset('/')).toBe('no-cache');
    expect(cacheControlForStaticAsset('/index.html')).toBe('no-cache');
    expect(cacheControlForStaticAsset('/matches/abc', true)).toBe('no-cache');
  });

  it('uses long immutable cache for hashed build assets', () => {
    expect(cacheControlForStaticAsset('/assets/index-a1b2c3d4.js')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(cacheControlForStaticAsset('/assets/HomePage-e99c619a.css')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('uses day cache for images and manifest', () => {
    expect(cacheControlForStaticAsset('/favicon-32x32.png')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(cacheControlForStaticAsset('/site.webmanifest')).toBe(
      'public, max-age=86400, stale-while-revalidate=604800',
    );
  });

  it('uses hour cache for unhashed js/css', () => {
    expect(cacheControlForStaticAsset('/legacy.js')).toBe(
      'public, max-age=3600, stale-while-revalidate=86400',
    );
  });
});
