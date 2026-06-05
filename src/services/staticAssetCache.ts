const ONE_YEAR = 'public, max-age=31536000, immutable';
const ONE_DAY = 'public, max-age=86400, stale-while-revalidate=604800';
const ONE_HOUR = 'public, max-age=3600, stale-while-revalidate=86400';
const NO_CACHE = 'no-cache';

const HASHED_ASSET = /^\/assets\/.+\.[a-f0-9]{8,}\.(js|css|mjs|map)$/i;
const LONG_CACHE_STATIC =
  /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf)$/i;
const MANIFEST_CACHE = /\.webmanifest$/i;
const SHORT_CACHE_STATIC = /\.(js|css|mjs)$/i;

export function cacheControlForStaticAsset(pathname: string, isSpaFallback = false): string {
  if (isSpaFallback || pathname === '/' || pathname === '/index.html') {
    return NO_CACHE;
  }

  if (HASHED_ASSET.test(pathname) || pathname.startsWith('/assets/')) {
    return ONE_YEAR;
  }

  if (LONG_CACHE_STATIC.test(pathname)) {
    return ONE_YEAR;
  }

  if (MANIFEST_CACHE.test(pathname)) {
    return ONE_DAY;
  }

  if (SHORT_CACHE_STATIC.test(pathname)) {
    return ONE_HOUR;
  }

  return NO_CACHE;
}

export function applyStaticAssetCacheHeaders(
  pathname: string,
  headers: Headers,
  isSpaFallback = false,
): void {
  headers.set('Cache-Control', cacheControlForStaticAsset(pathname, isSpaFallback));
}

export function withStaticAssetCacheHeaders(
  request: Request,
  response: Response,
  isSpaFallback = false,
): Response {
  const pathname = new URL(request.url).pathname;
  const headers = new Headers(response.headers);
  applyStaticAssetCacheHeaders(pathname, headers, isSpaFallback);
  return new Response(response.body, { status: response.status, headers });
}
