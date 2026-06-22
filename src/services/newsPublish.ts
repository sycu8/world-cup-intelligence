import type { AppEnv } from '../env';
import type { NewsFeed, RssItem } from '../ingestion/adapters/TrustedNewsRssAdapter';
import { computeHotScore } from './newsScoring';
import { compressAndStoreNewsImage, newsAssetPublicPath } from './newsImagePipeline';
import { normalizeFeedImageUrl } from './newsImageUrls';
import { registerNewsFeedSource } from './newsSourceBackfill';
import { translateNewsHeadline } from '../ai/translateNews';
import { isLikelyVietnamese } from './newsTranslationUtils';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';
import { logError } from '../utils/logger';

export async function publishNewsArticle(
  env: AppEnv,
  feed: NewsFeed,
  item: RssItem,
): Promise<string | null> {
  const existing = await env.DB.prepare('SELECT id FROM source_documents WHERE source_url = ?')
    .bind(item.link)
    .first();
  if (existing) return null;

  const sourceId = await registerNewsFeedSource(env, feed);
  const docId = newId('doc');
  const summaryEn = item.description.slice(0, 800);

  const nativeVi =
    ('contentLocale' in feed && feed.contentLocale === 'vi') || isLikelyVietnamese(item.title, '');
  let titleVi: string | null = null;
  let summaryVi: string | null = null;
  if (nativeVi) {
    titleVi = item.title.trim().slice(0, 320);
    summaryVi = summaryEn.trim().slice(0, 520) || titleVi;
  } else {
    const translation = await translateNewsHeadline(env, item.title, summaryEn);
    titleVi = translation?.titleVi?.trim() || null;
    summaryVi = translation?.summaryVi?.trim() || null;
    if (!titleVi || !summaryVi) {
      logError('news translation deferred — will backfill on read', {
        title: item.title.slice(0, 80),
      });
    }
  }

  const feedImage = normalizeFeedImageUrl(item.imageUrl);
  const thumbnailR2Key = await compressAndStoreNewsImage(env, docId, feedImage);
  const thumbnailUrl = thumbnailR2Key ? newsAssetPublicPath(docId) : feedImage;

  const r2Key = `news/${feed.id}/${docId}.json`;
  await env.R2_RAW.put(
    r2Key,
    JSON.stringify({
      ...item,
      feedId: feed.id,
      crawledAt: nowIso(),
      titleVi,
      summaryVi,
      thumbnailR2Key,
    }),
    { httpMetadata: { contentType: 'application/json' } },
  );

  const hotScore = computeHotScore(item.pubDate, feed.reliability);

  await env.DB.prepare(
    `INSERT INTO source_documents (
      id, source_id, source_url, title, title_vi, published_at, retrieved_at,
      summary, summary_vi, reliability_score, content_r2_key, thumbnail_url, thumbnail_r2_key, hot_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      docId,
      sourceId,
      item.link,
      item.title,
      titleVi,
      item.pubDate,
      nowIso(),
      summaryEn,
      summaryVi,
      feed.reliability,
      r2Key,
      thumbnailUrl,
      thumbnailR2Key,
      hotScore,
    )
    .run();

  const contentForAi = [titleVi, summaryVi, item.title, summaryEn].filter(Boolean).join('\n');

  if (env.MODEL_QUEUE) {
    await env.MODEL_QUEUE.send({
      type: 'ai_extract_news',
      documentId: docId,
      content: contentForAi,
    });
  }

  return docId;
}
