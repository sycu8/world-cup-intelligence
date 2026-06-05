import type { AppEnv } from '../env';
import { getFeaturedMatchPayload } from './featuredMatch';
import {
  WC2026_TOURNAMENT_ID,
  WC2026_MATCH_COUNT,
  WC2026_TOURNAMENT_START,
  WC2026_HOST_COUNTRIES,
  WC2026_TEAMS_COUNT,
} from '../constants/tournament';

export async function buildDashboardPayload(env: AppEnv) {
  const [
    featured,
    countRow,
    lastRefresh,
    lastNewsCrawl,
    statusResult,
    groupRow,
  ] = await Promise.all([
    getFeaturedMatchPayload(env),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM matches WHERE tournament_id = ?`)
      .bind(WC2026_TOURNAMENT_ID)
      .first<{ n: number }>(),
    env.KV.get('meta:last_data_refresh'),
    env.KV.get('meta:last_news_crawl'),
    env.DB.prepare(
      `SELECT status, COUNT(*) AS n FROM matches WHERE tournament_id = ? GROUP BY status`,
    )
      .bind(WC2026_TOURNAMENT_ID)
      .all<{ status: string; n: number }>(),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT group_code) AS n FROM matches WHERE tournament_id = ? AND group_code IS NOT NULL`,
    )
      .bind(WC2026_TOURNAMENT_ID)
      .first<{ n: number }>(),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of statusResult.results ?? []) {
    statusCounts[row.status] = Number(row.n);
  }

  return {
    featuredMatch: featured,
    matchCount: Number(countRow?.n ?? 0),
    lastDataRefresh: lastRefresh,
    lastNewsCrawl,
    refreshIntervalSec: 60,
    newsCrawlIntervalSec: 900,
    tournamentStartUtc: WC2026_TOURNAMENT_START,
    expectedMatches: WC2026_MATCH_COUNT,
    hostCountries: [...WC2026_HOST_COUNTRIES],
    teamsCount: WC2026_TEAMS_COUNT,
    groupCount: Number(groupRow?.n ?? 12),
    statusCounts,
  };
}
