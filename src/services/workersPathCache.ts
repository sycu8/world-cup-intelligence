const CACHE_ORIGIN = 'https://pitchintel.internal';

function defaultCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}

export function pathCacheKey(key: string): Request {
  return new Request(`${CACHE_ORIGIN}${key.startsWith('/') ? key : `/${key}`}`);
}

export async function getPathCachedResponse(key: string): Promise<Response | undefined> {
  return defaultCache().match(pathCacheKey(key));
}

export async function putPathCachedResponse(
  key: string,
  response: Response,
  ttlSec: number,
): Promise<void> {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', `public, max-age=${ttlSec}, stale-while-revalidate=${ttlSec * 2}`);
  const body = await response.clone().arrayBuffer();
  await defaultCache().put(
    pathCacheKey(key),
    new Response(body, { status: response.status, headers }),
  );
}

export async function withPathCache(
  key: string,
  ttlSec: number,
  build: () => Promise<Response>,
): Promise<Response> {
  const hit = await getPathCachedResponse(key);
  if (hit) return hit;

  const response = await build();
  if (response.ok) {
    await putPathCachedResponse(key, response, ttlSec).catch(() => undefined);
  }
  return response;
}
