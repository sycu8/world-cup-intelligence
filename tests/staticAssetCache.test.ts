import { describe, expect, it } from 'vitest';
import {
  applyStaticAssetCacheHeaders,
  cacheControlForStaticAsset,
  withStaticAssetCacheHeaders,
} from '../src/services/staticAssetCache';

describe('cacheControlForStaticAsset', () => {
  it('uses no-cache for HTML entry points and SPA fallbacks', () => {
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

  it('uses long cache for any /assets/ path even without content hash', () => {
    expect(cacheControlForStaticAsset('/assets/legacy-bundle.js')).toBe(
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

  it('uses hour cache for unhashed js/css at root', () => {
    expect(cacheControlForStaticAsset('/legacy.js')).toBe(
      'public, max-age=3600, stale-while-revalidate=86400',
    );
    expect(cacheControlForStaticAsset('/styles.css')).toBe(
      'public, max-age=3600, stale-while-revalidate=86400',
    );
  });

  it('defaults to no-cache for unrecognized paths', () => {
    expect(cacheControlForStaticAsset('/api/home')).toBe('no-cache');
    expect(cacheControlForStaticAsset('/random.txt')).toBe('no-cache');
  });
});

describe('applyStaticAssetCacheHeaders', () => {
  it('sets cache-control on a headers object', () => {
    const headers = new Headers();
    applyStaticAssetCacheHeaders('/assets/app-deadbeef.js', headers);
    expect(headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('respects SPA fallback flag', () => {
    const headers = new Headers();
    applyStaticAssetCacheHeaders('/matches/foo', headers, true);
    expect(headers.get('Cache-Control')).toBe('no-cache');
  });
});

describe('withStaticAssetCacheHeaders', () => {
  it('returns a new response with cache headers applied', async () => {
    const request = new Request('https://example.com/legacy.mjs');
    const response = new Response('export {}', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript' },
    });

    const wrapped = withStaticAssetCacheHeaders(request, response);
    expect(wrapped.status).toBe(200);
    expect(wrapped.headers.get('Content-Type')).toBe('application/javascript');
    expect(wrapped.headers.get('Cache-Control')).toBe(
      'public, max-age=3600, stale-while-revalidate=86400',
    );
    expect(await wrapped.text()).toBe('export {}');
  });
});
