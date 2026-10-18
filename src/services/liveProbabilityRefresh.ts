import type { AppEnv } from '../env';
import { parseEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { LIVE_PROB_REFRESH_INTERVAL_SEC } from '../constants/pipeline';
import { fetchFifaMatchInfo } from '../ingestion/fifa/fifaApiClient';
import { syncFifaMatchBlogAndStats } from '../ingestion/fifa/fifaLiveBlogSync';
import { recomputeMatchProbability } from './recomputeMatch';
import { logInfo } from '../utils/logger';
import { nowIso } from '../utils/time';

type LiveMatchRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  fifa_match_id: string | null;
  status: string;
};

async function listMatchesForStatsProbabilityRefresh(db: D1Database): Promise<LiveMatchRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, home_team_id, away_team_id, fifa_match_id, status
       FROM matches
       WHERE tournament_id = ?
         AND (
           status = 'live'
           OR (
             status = 'completed'
             AND updated_at >= datetime('now', '-45 minutes')
           )
         )
       ORDER BY kickoff_utc DESC`,
    )
    .bind(WC2026_TOURNAMENT_ID)
    .all<LiveMatchRow>();
  return results ?? [];
}

async function syncLiveMatchStats(
  env: AppEnv,
  match: LiveMatchRow,
): Promise<boolean> {
  if (!match.fifa_match_id) return false;
  const cfg = parseEnv(env);
  if (!cfg.fifaLiveEnabled && cfg.mockSources) return false;

  const info = await fetchFifaMatchInfo(match.fifa_match_id);
  if (!info) return false;

  const result = await syncFifaMatchBlogAndStats(
    env,
    match.id,
    match.home_team_id,
    match.away_team_id,
    info,
    match.fifa_match_id,
    { translateCommentary: false },
  );
  return result.statsUpdated;
}

/**
 * Pull latest FIFA team stats and recompute live probabilities (scheduled every 15 minutes).
 */
export async function refreshLiveProbabilitiesFromStats(env: AppEnv): Promise<{
  candidates: number;
  statsSynced: number;
  recomputed: number;
}> {
  const lockKey = 'meta:live_prob_stats_refresh_lock';
  const locked = await env.KV.get(lockKey);
  if (locked) {
    return { candidates: 0, statsSynced: 0, recomputed: 0 };
  }

  await env.KV.put(lockKey, nowIso(), { expirationTtl: LIVE_PROB_REFRESH_INTERVAL_SEC - 30 });

  const matches = await listMatchesForStatsProbabilityRefresh(env.DB);
  let statsSynced = 0;
  let recomputed = 0;

  for (const match of matches) {
    try {
      if (await syncLiveMatchStats(env, match)) statsSynced += 1;
      const result = await recomputeMatchProbability(env, match.id, { allowDuplicateSnapshot: false });
      if (result) recomputed += 1;
      await env.KV.put(`meta:live_prob_refresh:${match.id}`, nowIso(), {
        expirationTtl: LIVE_PROB_REFRESH_INTERVAL_SEC,
      });
    } catch (err) {
      logInfo('live prob stats refresh failed for match', {
        match_id: match.id,
        error: String(err),
      });
    }
  }

  await env.KV.put('meta:last_live_prob_stats_refresh', nowIso(), { expirationTtl: 86400 });

  logInfo('live probability stats refresh complete', {
    candidates: matches.length,
    statsSynced,
    recomputed,
  });

  return { candidates: matches.length, statsSynced, recomputed };
}
