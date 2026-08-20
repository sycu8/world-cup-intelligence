import type { AppEnv } from '../env';
import {
  WC_NEWS_FEEDS,
  newsFeedSourceId,
  type NewsFeed,
} from '../ingestion/adapters/TrustedNewsRssAdapter';
import { nowIso } from '../utils/time';
import { logInfo } from '../utils/logger';

async function ensureFeedSource(env: AppEnv, feed: NewsFeed): Promise<string> {
  const id = newsFeedSourceId(feed.id);
  await env.DB.prepare(
    `INSERT INTO source_registry (id, source_name, source_type, base_url, reliability_score, allowed_usage, health_status)
     VALUES (?, ?, 'rss', ?, ?, 'news', 'healthy')
     ON CONFLICT(id) DO UPDATE SET
       source_name = excluded.source_name,
       base_url = excluded.base_url,
       reliability_score = excluded.reliability_score`,
  )
    .bind(id, feed.publisher, feed.url, feed.reliability)
    .run();
  return id;
}

/** Point legacy news rows at the correct publisher (BBC, FIFA, …). */
export async function backfillNewsSources(env: AppEnv): Promise<number> {
  for (const feed of WC_NEWS_FEEDS) {
    await ensureFeedSource(env, feed);
  }

  let updated = 0;
  for (const feed of WC_NEWS_FEEDS) {
    const sourceId = newsFeedSourceId(feed.id);
    const byKey = await env.DB.prepare(
      `UPDATE source_documents
       SET source_id = ?, reliability_score = ?
       WHERE source_id = 'src-mock' AND content_r2_key LIKE ?`,
    )
      .bind(sourceId, feed.reliability, `news/${feed.id}/%`)
      .run();
    updated += byKey.meta.changes ?? 0;
  }

  const byId = (id: string) => WC_NEWS_FEEDS.find((f) => f.id === id)!;
  const urlRules: { pattern: string; feed: NewsFeed }[] = [
    { pattern: '%bbc.%', feed: byId('rss-bbc-football') },
    { pattern: '%bbci.%', feed: byId('rss-bbc-football') },
    { pattern: '%theguardian.%', feed: byId('rss-guardian-football') },
    { pattern: '%fifa.%', feed: byId('rss-fifa-news') },
  ];

  for (const { pattern, feed } of urlRules) {
    const sourceId = newsFeedSourceId(feed.id);
    const r = await env.DB.prepare(
      `UPDATE source_documents
       SET source_id = ?, reliability_score = ?
       WHERE source_id = 'src-mock' AND source_url LIKE ?`,
    )
      .bind(sourceId, feed.reliability, pattern)
      .run();
    updated += r.meta.changes ?? 0;
  }

  if (updated) logInfo('news sources backfilled', { updated });
  return updated;
}

export async function registerNewsFeedSource(env: AppEnv, feed: NewsFeed): Promise<string> {
  const id = await ensureFeedSource(env, feed);
  await env.DB.prepare(
    `UPDATE source_registry SET health_status = 'healthy', last_success_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(nowIso(), nowIso(), id)
    .run();
  return id;
}
