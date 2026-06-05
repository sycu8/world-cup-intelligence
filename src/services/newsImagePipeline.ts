import type { AppEnv } from '../env';
import { logError, logInfo } from '../utils/logger';

const MAX_DOWNLOAD_BYTES = 2_500_000;
/** Card thumbnails display ~360–400px; 480 covers 2× retina. */
export const NEWS_THUMB_MAX_WIDTH = 400;
const WEBP_QUALITY = 0.82;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_STORED_BYTES = 80_000;
/** Card thumbs from BBC/Guardian feeds should stay well under this after normalization. */
const LEGACY_OVERSIZED_BYTES = 40_000;

function looksLikeImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url);
}

function isImageContentType(contentType: string, url: string): boolean {
  const ct = contentType.toLowerCase();
  if (ct.startsWith('image/')) return true;
  if (ct.includes('octet-stream') && looksLikeImageUrl(url)) return true;
  return looksLikeImageUrl(url);
}

export function newsThumbnailR2Key(docId: string): string {
  return `news/thumbs/${docId}.webp`;
}

export function newsAssetPublicPath(docId: string): string {
  return `/api/news/assets/${docId}`;
}

/**
 * Download RSS image, resize/compress to WebP, store on R2_ARTIFACTS for CDN serve.
 */
export async function compressAndStoreNewsImage(
  env: AppEnv,
  docId: string,
  imageUrl: string | null | undefined,
): Promise<string | null> {
  if (!imageUrl?.trim()) return null;

  try {
    const outBlob = await downloadOptimizedThumb(imageUrl);
    if (!outBlob) {
      logError('thumb optimize failed', { docId });
      return null;
    }

    if (outBlob.size > MAX_STORED_BYTES) {
      logError('thumb still too large after optimize', { docId, bytes: outBlob.size });
      return null;
    }

    const r2Key = newsThumbnailR2Key(docId);
    const storedType = outBlob.type.includes('webp') ? 'image/webp' : 'image/jpeg';
    await env.R2_ARTIFACTS.put(r2Key, await outBlob.arrayBuffer(), {
      httpMetadata: {
        contentType: storedType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    logInfo('news thumb stored', { docId, r2Key, bytes: outBlob.size });
    return r2Key;
  } catch (e) {
    logError('news image pipeline failed', { docId, error: String(e) });
    return null;
  }
}

async function downloadOptimizedThumb(imageUrl: string): Promise<Blob | null> {
  const fetchInit = {
    headers: {
      'User-Agent': 'wc-tactical-platform/1.0 (news-thumb)',
      Accept: 'image/*',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cf: {
      cacheTtl: 86400,
      image: {
        width: NEWS_THUMB_MAX_WIDTH,
        fit: 'scale-down',
        format: 'webp',
        quality: 82,
      },
    },
  } as RequestInit;

  const cfImageRes = await fetch(imageUrl, fetchInit);
  if (cfImageRes.ok) {
    const ct = cfImageRes.headers.get('content-type') ?? '';
    const buf = await cfImageRes.arrayBuffer();
    if (
      ct.includes('webp') &&
      buf.byteLength >= 200 &&
      buf.byteLength <= MAX_STORED_BYTES
    ) {
      return new Blob([buf], { type: 'image/webp' });
    }
  }

  const res = await fetch(imageUrl, {
    headers: fetchInit.headers,
    signal: fetchInit.signal,
    cf: { cacheTtl: 86400 },
  } as RequestInit);

  if (!res.ok) return null;

  const contentType = res.headers.get('content-type') ?? '';
  if (!isImageContentType(contentType, imageUrl)) return null;

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_DOWNLOAD_BYTES || buf.byteLength < 200) return null;

  const source = new Blob([buf], { type: contentType });
  const webp = await resizeToWebp(source);
  if (webp) return webp;

  if (buf.byteLength <= MAX_STORED_BYTES) {
    return source;
  }

  return null;
}

async function resizeToWebp(blob: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, NEWS_THUMB_MAX_WIDTH / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    try {
      return await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
    } catch {
      return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.78 });
    }
  } catch {
    return null;
  }
}

/** True when an R2 thumb should be re-encoded (legacy full-size feed image). */
export function thumbNeedsRecompress(
  _contentType: string | undefined,
  size: number | undefined,
): boolean {
  return size != null && size > LEGACY_OVERSIZED_BYTES;
}
