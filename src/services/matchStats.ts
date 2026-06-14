import type { AppEnv } from '../env';
import { parseEnv } from '../env';
import { resolveMatchRef, type MatchWithSlug } from './matchRef';
import {
  shouldSyncFifaMatch,
  syncFifaMatchByRef,
} from '../ingestion/fifa/fifaLiveSync';
import { shouldSyncFifaBlogAndStats, ensureFifaBlogAndStats } from '../ingestion/fifa/fifaLiveBlogSync';
import { loadTeamMatchStatsCompleteness } from '../ingestion/fifa/teamMatchStatsComplete';

export type TeamMatchStatsRow = {
  teamId: string;
  teamName: string;
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  xg: number | null;
  passes: number | null;
  passAccuracy: number | null;
};

export type MatchStatsPayload = {
  matchId: string;
  slug: string;
  status: string;
  minute: number | null;
  homeScore: number;
  awayScore: number;
  updatedAt: string | null;
  dataSource: 'recorded' | 'unavailable' | 'fifa_live';
  home: TeamMatchStatsRow;
  away: TeamMatchStatsRow;
  events: {
    goals: number;
    yellowCards: number;
    redCards: number;
    substitutions: number;
  };
  xgEstimateNote: string;
  dataSourceLabel?: string;
};

export type GetMatchStatsOptions = {
  /** Cloudflare waitUntil — FIFA sync runs in background instead of blocking the response. */
  waitUntil?: (promise: Promise<unknown>) => void;
};

async function refreshFifaStatsIfNeeded(env: AppEnv, resolved: MatchWithSlug): Promise<void> {
  if (!resolved) return;
  const matchId = resolved.id;

  const needsScoreSync =
    resolved.status === 'live' && (await shouldSyncFifaMatch(env, matchId, resolved.status));
  const statsIncomplete =
    (resolved.status === 'live' || resolved.status === 'completed') &&
    !(await loadTeamMatchStatsCompleteness(
      env.DB,
      matchId,
      resolved.home_team_id,
      resolved.away_team_id,
    )).complete;
  const needsBlogStatsSync =
    (resolved.status === 'live' || resolved.status === 'completed') &&
    (statsIncomplete ||
      (await shouldSyncFifaBlogAndStats(
        env,
        matchId,
        resolved.status,
        resolved.home_team_id,
        resolved.away_team_id,
      )));
  if (needsScoreSync || needsBlogStatsSync) {
    await syncFifaMatchByRef(env, matchId).catch(() => undefined);
  }
  await ensureFifaBlogAndStats(
    env,
    matchId,
    resolved.home_team_id,
    resolved.away_team_id,
    resolved.fifa_match_id,
    resolved.status,
  ).catch(() => undefined);
}

export async function getMatchStats(
  env: AppEnv,
  ref: string,
  opts?: GetMatchStatsOptions,
): Promise<MatchStatsPayload | null> {
  const resolved = await resolveMatchRef(env.DB, ref);
  if (!resolved) return null;

  const matchId = resolved.id;

  if (parseEnv(env).fifaLiveEnabled || !parseEnv(env).mockSources) {
    const work = refreshFifaStatsIfNeeded(env, resolved);
    if (opts?.waitUntil) {
      opts.waitUntil(work);
    } else {
      await work;
    }
  }

  const [homeTeam, awayTeam, statsRows, eventCounts, matchRow] = await Promise.all([
    env.DB.prepare('SELECT id, name FROM teams WHERE id = ?')
      .bind(resolved.home_team_id)
      .first<{ id: string; name: string }>(),
    env.DB.prepare('SELECT id, name FROM teams WHERE id = ?')
      .bind(resolved.away_team_id)
      .first<{ id: string; name: string }>(),
    env.DB.prepare(
      `SELECT team_id, possession, shots, shots_on_target, xg, passes, pass_accuracy, created_at
       FROM team_match_stats WHERE match_id = ?`,
    )
      .bind(matchId)
      .all<{
        team_id: string;
        possession: number | null;
        shots: number | null;
        shots_on_target: number | null;
        xg: number | null;
        passes: number | null;
        pass_accuracy: number | null;
        created_at: string | null;
      }>(),
    env.DB.prepare(
      `SELECT
         SUM(CASE WHEN event_type IN ('goal','penalty_goal','own_goal') THEN 1 ELSE 0 END) AS goals,
         SUM(CASE WHEN event_type = 'yellow_card' THEN 1 ELSE 0 END) AS yellow_cards,
         SUM(CASE WHEN event_type IN ('red_card','second_yellow') THEN 1 ELSE 0 END) AS red_cards,
         SUM(CASE WHEN event_type = 'substitution' THEN 1 ELSE 0 END) AS substitutions
       FROM match_events WHERE match_id = ?`,
    )
      .bind(matchId)
      .first<{
        goals: number | null;
        yellow_cards: number | null;
        red_cards: number | null;
        substitutions: number | null;
      }>(),
    env.DB.prepare('SELECT status, minute, home_score, away_score, updated_at FROM matches WHERE id = ?')
      .bind(matchId)
      .first<{
        status: string;
        minute: number | null;
        home_score: number;
        away_score: number;
        updated_at: string | null;
      }>(),
  ]);

  const statsByTeam = new Map((statsRows.results ?? []).map((r) => [r.team_id, r]));
  const homeStats = statsByTeam.get(resolved.home_team_id);
  const awayStats = statsByTeam.get(resolved.away_team_id);
  const hasStats = !!(homeStats || awayStats);
  const hasRecap = await env.DB.prepare('SELECT 1 FROM match_recaps WHERE match_id = ? LIMIT 1')
    .bind(matchId)
    .first();

  const dataSourceLabel =
    hasRecap && hasStats
      ? 'FIFA Match Centre / Opta'
      : hasStats && (homeStats?.passes ?? 0) > 0 && (homeStats?.possession ?? 0) > 0
        ? 'FIFA Match Centre / ESPN'
        : hasStats
          ? 'FIFA Match Centre'
          : undefined;

  const mapSide = (
    team: { id: string; name: string } | null,
    row: (typeof statsRows.results)[number] | undefined,
  ): TeamMatchStatsRow => ({
    teamId: team?.id ?? '',
    teamName: team?.name ?? '',
    possession: row?.possession ?? null,
    shots: row?.shots ?? null,
    shotsOnTarget: row?.shots_on_target ?? null,
    xg: row?.xg ?? null,
    passes: row?.passes ?? null,
    passAccuracy: row?.pass_accuracy ?? null,
  });

  const latestStatAt = [homeStats?.created_at, awayStats?.created_at, matchRow?.updated_at]
    .filter(Boolean)
    .sort()
    .pop();

  return {
    matchId,
    slug: resolved.slug,
    status: matchRow?.status ?? resolved.status,
    minute: matchRow?.minute ?? resolved.minute ?? null,
    homeScore: matchRow?.home_score ?? resolved.home_score,
    awayScore: matchRow?.away_score ?? resolved.away_score,
    updatedAt: latestStatAt ?? matchRow?.updated_at ?? null,
    dataSource: hasStats ? 'fifa_live' : 'unavailable',
    home: mapSide(homeTeam, homeStats),
    away: mapSide(awayTeam, awayStats),
    events: {
      goals: eventCounts?.goals ?? 0,
      yellowCards: eventCounts?.yellow_cards ?? 0,
      redCards: eventCounts?.red_cards ?? 0,
      substitutions: eventCounts?.substitutions ?? 0,
    },
    xgEstimateNote: hasRecap
      ? 'xG theo Opta/FIFA Match Centre'
      : 'xG ước tính bởi PitchIntel',
    dataSourceLabel,
  };
}
