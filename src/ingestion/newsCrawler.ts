import type { AppEnv } from '../env';
import { WC_NEWS_FEEDS, parseRssItems, isWorldCupRelated } from './adapters/TrustedNewsRssAdapter';
import { fetchFifaWc2026NewsItems } from './adapters/FifaWc2026NewsAdapter';
import { fetchVnExpressWc2026NewsItems } from './adapters/VnExpressWc2026NewsAdapter';
import { backfillNewsThumbnails } from '../services/newsThumbnailBackfill';
import { publishNewsArticle } from '../services/newsPublish';
import { NEWS_CRAWL_KV_KEY } from '../constants/pipeline';
import { nowIso } from '../utils/time';
import { logInfo, logError } from '../utils/logger';

const RSS_PARSE_LIMIT = 25;
const MAX_ITEMS_PER_FEED = 5;

const FIFA_WC2026_FEED = {
  id: 'rss-fifa-wc2026',
  name: 'FIFA World Cup 2026',
  publisher: 'FIFA',
  url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/news',
  reliability: 0.92,
} as const;

const VNEXPRESS_WC2026_FEED = {
  id: 'rss-vnexpress-wc2026',
  name: 'VnExpress World Cup 2026',
  publisher: 'VnExpress',
  url: 'https://vnexpress.net/the-thao/world-cup-2026/tin-tuc',
  reliability: 0.78,
  contentLocale: 'vi',
} as const;

export async function crawlWorldCupNews(env: AppEnv): Promise<number> {
  let inserted = 0;

  for (const feed of WC_NEWS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'wc-tactical-platform/1.0 (rss-reader)' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        logError('rss fetch failed', { feed: feed.id, status: res.status });
        continue;
      }
      const xml = await res.text();
      const items = parseRssItems(xml, RSS_PARSE_LIMIT).filter((i) =>
        isWorldCupRelated(i.title, i.description),
      );

      for (const item of items.slice(0, MAX_ITEMS_PER_FEED)) {
        const docId = await publishNewsArticle(env, feed, item);
        if (docId) inserted++;
      }
    } catch (e) {
      logError('rss crawl error', { feed: feed.id, error: String(e) });
    }
  }

  try {
    const fifaItems = await fetchFifaWc2026NewsItems(12);
    for (const item of fifaItems) {
      const docId = await publishNewsArticle(env, FIFA_WC2026_FEED, item);
      if (docId) inserted++;
    }
    logInfo('fifa wc2026 news crawl', { count: fifaItems.length, inserted });
  } catch (e) {
    logError('fifa wc2026 crawl error', { error: String(e) });
  }

  try {
    const vneItems = await fetchVnExpressWc2026NewsItems(12);
    let vneInserted = 0;
    for (const item of vneItems) {
      const docId = await publishNewsArticle(env, VNEXPRESS_WC2026_FEED, item);
      if (docId) {
        inserted++;
        vneInserted++;
      }
    }
    logInfo('vnexpress wc2026 news crawl', { count: vneItems.length, inserted: vneInserted });
  } catch (e) {
    logError('vnexpress wc2026 crawl error', { error: String(e) });
  }

  await backfillNewsThumbnails(env, 60);

  await env.KV.put(NEWS_CRAWL_KV_KEY, nowIso(), { expirationTtl: 86400 });
  logInfo('news crawl complete', { inserted });
  return inserted;
}
