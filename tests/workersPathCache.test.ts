import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPathCachedResponse,
  pathCacheKey,
  putPathCachedResponse,
  withPathCache,
} from '../src/services/workersPathCache';

describe('workersPathCache', () => {
  const store = new Map<string, Response>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('caches', {
      default: {
        match: async (req: Request) => store.get(req.url),
        put: async (req: Request, res: Response) => {
          store.set(req.url, res);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds stable internal cache keys', () => {
    expect(pathCacheKey('spa:/matches').url).toBe('https://pitchintel.internal/spa:/matches');
    expect(pathCacheKey('/api/home').url).toBe('https://pitchintel.internal/api/home');
    expect(pathCacheKey('api/home').url).toBe('https://pitchintel.internal/api/home');
  });

  it('returns cached responses on hit', async () => {
    const key = '/api/test';
    const cached = new Response('cached', { status: 200 });
    await putPathCachedResponse(key, cached, 30);

    const hit = await getPathCachedResponse(key);
    expect(hit).toBeDefined();
    expect(await hit!.text()).toBe('cached');
  });

  it('stores cache-control headers when putting responses', async () => {
    const response = new Response('body', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    await putPathCachedResponse('/api/x', response, 60);

    const stored = store.get(pathCacheKey('/api/x').url)!;
    expect(stored.headers.get('Cache-Control')).toBe(
      'public, max-age=60, stale-while-revalidate=120',
    );
    expect(stored.headers.get('Content-Type')).toBe('text/plain');
  });

  it('withPathCache returns cached response without calling build', async () => {
    const response = new Response('hit', { status: 200 });
    await putPathCachedResponse('/cached', response, 10);
    const build = vi.fn(async () => new Response('miss', { status: 200 }));

    const result = await withPathCache('/cached', 10, build);
    expect(await result.text()).toBe('hit');
    expect(build).not.toHaveBeenCalled();
  });

  it('withPathCache builds and caches successful responses', async () => {
    const build = vi.fn(async () => new Response('fresh', { status: 200 }));

    const result = await withPathCache('/fresh', 45, build);
    expect(await result.text()).toBe('fresh');
    expect(build).toHaveBeenCalledOnce();

    const hit = await getPathCachedResponse('/fresh');
    expect(await hit!.text()).toBe('fresh');
  });

  it('withPathCache does not cache non-ok responses', async () => {
    const build = vi.fn(async () => new Response('error', { status: 500 }));

    const result = await withPathCache('/error', 30, build);
    expect(result.status).toBe(500);
    expect(store.has(pathCacheKey('/error').url)).toBe(false);
  });
});
