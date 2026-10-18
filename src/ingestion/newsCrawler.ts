import type { AppEnv } from '../env';
import {
  DEAD_NEWS_FEED_IDS,
  WC_NEWS_FEEDS,
  parseRssItems,
  shouldKeepSoccerNews,
  isWorldCupRelated,
  type NewsFeed,
} from './adapters/TrustedNewsRssAdapter';
import { fetchFifaWc2026NewsItems } from './adapters/FifaWc2026NewsAdapter';
import { fetchVnExpressWc2026NewsItems } from './adapters/VnExpressWc2026NewsAdapter';
import { backfillNewsThumbnails } from '../services/newsThumbnailBackfill';
import { publishNewsArticle } from '../services/newsPublish';
import { CLUB_LEAGUES } from '../constants/leagues';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { NEWS_CRAWL_KV_KEY } from '../constants/pipeline';
import { nowIso } from '../utils/time';
import { logInfo, logError } from '../utils/logger';

const RSS_PARSE_LIMIT = 30;
const MAX_ITEMS_PER_FEED = 8;

const FIFA_WC2026_FEED = {
  id: 'rss-fifa-wc2026',
  name: 'FIFA World Cup 2026',
  publisher: 'FIFA',
  url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/news',
  reliability: 0.92,
  tournamentId: WC2026_TOURNAMENT_ID,
} as const;

const VNEXPRESS_WC2026_FEED = {
  id: 'rss-vnexpress-wc2026',
  name: 'VnExpress World Cup 2026',
  publisher: 'VnExpress',
  url: 'https://vnexpress.net/the-thao/world-cup-2026/tin-tuc',
  reliability: 0.78,
  contentLocale: 'vi' as const,
  tournamentId: WC2026_TOURNAMENT_ID,
} as const;

/** Map article text to a known competition when keywords clearly match. */
export function resolveNewsTournamentId(title: string, description: string): string | null {
  const text = `${title} ${description}`.toLowerCase();
  for (const league of CLUB_LEAGUES) {
    if (league.newsKeywords.some((k) => text.includes(k.toLowerCase()))) {
      return league.id;
    }
  }
  if (isWorldCupRelated(title, description)) {
    const strongWc =
      text.includes('world cup') ||
      text.includes('wc 2026') ||
      text.includes('wc2026') ||
      text.includes('mundial') ||
      text.includes('fifa world');
    if (strongWc) return WC2026_TOURNAMENT_ID;
  }
  return null;
}

function withTournament(feed: NewsFeed, title: string, description: string): NewsFeed {
  if ('tournamentId' in feed && feed.tournamentId) return feed;
  const tournamentId = resolveNewsTournamentId(title, description);
  if (!tournamentId) return feed;
  return { ...feed, tournamentId };
}

export type NewsCrawlChunk = {
  inserted: number;
  done: boolean;
  feedCursor?: number;
};

export type NewsCrawlOptions = {
  feedCursor?: number;
  /** Stop before this many milliseconds and report the next feed index. */
  budgetMs?: number;
  now?: () => number;
  /** Return the chunk cursor instead of only the inserted count. */
  chunk?: boolean;
};

const THUMB_FEEDS_PER_CHUNK = 4;
const HTML_PHASE = WC_NEWS_FEEDS.length;
const THUMB_PHASE = WC_NEWS_FEEDS.length + 1;

const DEAD_NEWS_FEED_ID_SET = new Set<string>(DEAD_NEWS_FEED_IDS);

async function crawlOneFeed(env: AppEnv, feed: NewsFeed): Promise<number> {
  if (DEAD_NEWS_FEED_ID_SET.has(feed.id)) {
    logInfo('news feed listed dead', { feed: feed.id });
    return 0;
  }
  let inserted = 0;
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'pitchintel-news/1.0 (rss-reader)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      logError('rss fetch failed', { feed: feed.id, status: res.status });
      return 0;
    }
    const xml = await res.text();
    const items = parseRssItems(xml, RSS_PARSE_LIMIT).filter((i) =>
      shouldKeepSoccerNews(i.title, i.description),
    );
    for (const item of items.slice(0, MAX_ITEMS_PER_FEED)) {
      const tagged = withTournament(feed, item.title, item.description);
      const docId = await publishNewsArticle(env, tagged, item);
      if (docId) inserted++;
    }
  } catch (e) {
    logError('rss crawl error', { feed: feed.id, error: String(e) });
  }
  return inserted;
}

async function crawlHtmlSources(env: AppEnv): Promise<number> {
  let inserted = 0;
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
  return inserted;
}

/** One slice of the news crawl. Without a budget the whole crawl runs. */
export async function crawlWorldCupNewsChunk(
  env: AppEnv,
  options: NewsCrawlOptions = {},
): Promise<NewsCrawlChunk> {
  const budgetMs = options.budgetMs;
  const now = options.now ?? Date.now;
  const started = now();
  let cursor = options.feedCursor ?? 0;
  let inserted = 0;
  const expired = () => budgetMs != null && now() - started >= budgetMs;

  while (cursor < WC_NEWS_FEEDS.length) {
    if (expired()) return { inserted, done: false, feedCursor: cursor };
    inserted += await crawlOneFeed(env, WC_NEWS_FEEDS[cursor]!);
    cursor += 1;
    if (budgetMs != null) return { inserted, done: false, feedCursor: cursor };
  }

  if (cursor === HTML_PHASE) {
    if (expired()) return { inserted, done: false, feedCursor: cursor };
    inserted += await crawlHtmlSources(env);
    cursor = THUMB_PHASE;
    if (budgetMs != null) return { inserted, done: false, feedCursor: cursor };
  }

  if (cursor >= THUMB_PHASE) {
    if (budgetMs == null) {
      await backfillNewsThumbnails(env, 60);
    } else {
      const feedOffset = cursor - THUMB_PHASE;
      if (feedOffset < WC_NEWS_FEEDS.length) {
        if (expired()) return { inserted, done: false, feedCursor: THUMB_PHASE + feedOffset };
        await backfillNewsThumbnails(env, 15, { feedOffset, feedLimit: THUMB_FEEDS_PER_CHUNK });
        const nextOffset = feedOffset + THUMB_FEEDS_PER_CHUNK;
        if (nextOffset < WC_NEWS_FEEDS.length) {
          return { inserted, done: false, feedCursor: THUMB_PHASE + nextOffset };
        }
      }
    }
  }

  await env.KV.put(NEWS_CRAWL_KV_KEY, nowIso(), { expirationTtl: 86400 });
  logInfo('soccer news crawl complete', { inserted });
  return { inserted, done: true };
}

/** Crawl worldwide soccer RSS + WC HTML sources into the blog/news feed. */
export async function crawlWorldCupNews(env: AppEnv): Promise<number>;
export async function crawlWorldCupNews(
  env: AppEnv,
  options: NewsCrawlOptions & { chunk: true },
): Promise<NewsCrawlChunk>;
export async function crawlWorldCupNews(
  env: AppEnv,
  options?: NewsCrawlOptions,
): Promise<number | NewsCrawlChunk> {
  const chunk = await crawlWorldCupNewsChunk(env, options);
  if (options?.chunk) return chunk;
  return chunk.inserted;
}

/** Alias — crawl covers global soccer + World Cup. */
export const crawlSoccerNews = crawlWorldCupNews;
