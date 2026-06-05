import type { AppEnv } from '../env';
import { WC_NEWS_FEEDS, parseRssItems } from '../ingestion/adapters/TrustedNewsRssAdapter';
import {
  compressAndStoreNewsImage,
  newsAssetPublicPath,
  thumbNeedsRecompress,
} from './newsImagePipeline';
import { normalizeArticleLink, normalizeFeedImageUrl } from './newsImageUrls';
import { logInfo } from '../utils/logger';

type DocRow = {
  id: string;
  source_url: string;
  content_r2_key: string | null;
};

async function buildRssImageIndex(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const feed of WC_NEWS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'wc-tactical-platform/1.0 (rss-reader)' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const items = parseRssItems(await res.text(), 40);
      for (const item of items) {
        if (!item.imageUrl) continue;
        const norm = normalizeFeedImageUrl(item.imageUrl);
        if (norm) map.set(normalizeArticleLink(item.link), norm);
      }
    } catch {
      /* next feed */
    }
  }
  return map;
}

export async function imageUrlFromRaw(
  env: AppEnv,
  contentR2Key: string | null,
): Promise<string | null> {
  if (!contentR2Key) return null;
  const obj = await env.R2_RAW.get(contentR2Key);
  if (!obj) return null;
  try {
    const raw = JSON.parse(await obj.text()) as { imageUrl?: string | null };
    return raw.imageUrl ? normalizeFeedImageUrl(raw.imageUrl) : null;
  } catch {
    return null;
  }
}

export async function resolveNewsThumbSourceUrl(
  env: AppEnv,
  docId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT source_url, content_r2_key FROM source_documents WHERE id = ?',
  )
    .bind(docId)
    .first<{ source_url: string; content_r2_key: string | null }>();
  if (!row) return null;

  const fromRaw = await imageUrlFromRaw(env, row.content_r2_key);
  if (fromRaw) return fromRaw;

  const rssImages = await buildRssImageIndex();
  return rssImages.get(normalizeArticleLink(row.source_url)) ?? null;
}

/** Fill thumbnails for articles crawled before image pipeline or when R2 store failed. */
export async function backfillNewsThumbnails(env: AppEnv, limit = 50): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT id, source_url, content_r2_key
     FROM source_documents
     WHERE (thumbnail_r2_key IS NULL OR thumbnail_r2_key = '')
       AND (thumbnail_url IS NULL OR thumbnail_url = '' OR thumbnail_url NOT LIKE 'http%')
     ORDER BY published_at DESC
     LIMIT ?`,
  )
    .bind(limit)
    .all<DocRow>();

  const rows = results ?? [];
  if (!rows.length) return 0;

  const rssImages = await buildRssImageIndex();
  let updated = 0;

  for (const row of rows) {
    let imageUrl =
      rssImages.get(normalizeArticleLink(row.source_url)) ??
      (await imageUrlFromRaw(env, row.content_r2_key));

    if (!imageUrl) continue;

    const thumbnailR2Key = await compressAndStoreNewsImage(env, row.id, imageUrl);
    if (thumbnailR2Key) {
      await env.DB.prepare(
        `UPDATE source_documents SET thumbnail_url = ?, thumbnail_r2_key = ? WHERE id = ?`,
      )
        .bind(newsAssetPublicPath(row.id), thumbnailR2Key, row.id)
        .run();
    } else {
      await env.DB.prepare(`UPDATE source_documents SET thumbnail_url = ? WHERE id = ?`)
        .bind(imageUrl, row.id)
        .run();
    }
    updated++;
  }

  if (updated) logInfo('news thumbnails backfilled', { updated });
  return updated;
}

/** Re-encode legacy JPEG/PNG thumbs stored before WebP pipeline fixes. */
export async function recompressNewsThumbnails(env: AppEnv, limit = 30): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT id, source_url, content_r2_key, thumbnail_r2_key
     FROM source_documents
     WHERE thumbnail_r2_key IS NOT NULL AND thumbnail_r2_key != ''
     ORDER BY published_at DESC
     LIMIT ?`,
  )
    .bind(limit)
    .all<DocRow & { thumbnail_r2_key: string }>();

  const rows = results ?? [];
  if (!rows.length) return 0;

  const rssImages = await buildRssImageIndex();
  let updated = 0;

  for (const row of rows) {
    const head = await env.R2_ARTIFACTS.head(row.thumbnail_r2_key);
    if (!head) continue;
    if (!thumbNeedsRecompress(head.httpMetadata?.contentType, head.size)) continue;

    const imageUrl =
      rssImages.get(normalizeArticleLink(row.source_url)) ??
      (await imageUrlFromRaw(env, row.content_r2_key));
    if (!imageUrl) continue;

    const thumbnailR2Key = await compressAndStoreNewsImage(env, row.id, imageUrl);
    if (!thumbnailR2Key) continue;

    await env.DB.prepare(
      `UPDATE source_documents SET thumbnail_url = ?, thumbnail_r2_key = ? WHERE id = ?`,
    )
      .bind(newsAssetPublicPath(row.id), thumbnailR2Key, row.id)
      .run();
    updated++;
  }

  if (updated) logInfo('news thumbnails recompressed', { updated });
  return updated;
}
