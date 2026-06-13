import type { AppEnv } from '../../env';
import { nowIso } from '../../utils/time';
import { logError, logInfo } from '../../utils/logger';
import { FIFA_SOURCE_ID, WC2026_TOURNAMENT_ID } from './constants';
import { fetchFifaTimeline, fetchFifaMatchInfo, type FifaMatchInfo } from './fifaApiClient';
import { fetchFifaGamedayTeamMatchStats } from './fifaGamedayClient';
import {
  deriveShotsFromTimeline,
  parseFifaTimelineCommentary,
  type FifaTimelinePayload,
} from './parseFifaTimeline';
import { parseGamedayTeamStats } from './parseFifaGamedayStats';
import {
  emitMatchCommentaryUpdated,
  emitMatchStatsUpdated,
} from '../../services/publicApi/emitter';
import { loadTeamMatchStatsCompleteness } from './teamMatchStatsComplete';
import { fetchEspnTeamMatchStats } from '../espn/espnStatsClient';

type TeamStatPatch = {
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  passes: number | null;
  passAccuracy: number | null;
};

async function upsertTeamMatchStats(
  db: D1Database,
  matchId: string,
  teamId: string,
  patch: TeamStatPatch,
): Promise<void> {
  const hasAny =
    patch.possession != null ||
    patch.shots != null ||
    patch.shotsOnTarget != null ||
    patch.passes != null ||
    patch.passAccuracy != null;
  if (!hasAny) return;

  const ts = nowIso();
  const existing = await db
    .prepare(`SELECT id FROM team_match_stats WHERE match_id = ? AND team_id = ?`)
    .bind(matchId, teamId)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(
        `UPDATE team_match_stats SET
           possession = COALESCE(?, possession),
           shots = COALESCE(?, shots),
           shots_on_target = COALESCE(?, shots_on_target),
           passes = COALESCE(?, passes),
           pass_accuracy = COALESCE(?, pass_accuracy),
           created_at = ?
         WHERE id = ?`,
      )
      .bind(
        patch.possession,
        patch.shots,
        patch.shotsOnTarget,
        patch.passes,
        patch.passAccuracy,
        ts,
        existing.id,
      )
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO team_match_stats (
         id, match_id, team_id, possession, shots, shots_on_target, passes, pass_accuracy, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      `tms-fifa-${matchId}-${teamId}`,
      matchId,
      teamId,
      patch.possession ?? 0,
      patch.shots ?? 0,
      patch.shotsOnTarget ?? 0,
      patch.passes ?? 0,
      patch.passAccuracy ?? 0,
      ts,
    )
    .run();
}

async function runBatchChunked(db: D1Database, stmts: D1PreparedStatement[], chunkSize = 40): Promise<void> {
  for (let i = 0; i < stmts.length; i += chunkSize) {
    await db.batch(stmts.slice(i, i + chunkSize));
  }
}

async function syncCommentary(
  db: D1Database,
  internalMatchId: string,
  timeline: FifaTimelinePayload,
): Promise<number> {
  const lines = parseFifaTimelineCommentary(timeline, internalMatchId);
  if (!lines.length) return 0;

  await db
    .prepare(`DELETE FROM match_commentary WHERE match_id = ? AND source_id = ?`)
    .bind(internalMatchId, FIFA_SOURCE_ID)
    .run();

  const stmts = lines.map((line) =>
    db
      .prepare(
        `INSERT INTO match_commentary (
           id, match_id, minute, period, sort_order, text_vi, text_en, event_type, source_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        line.id,
        internalMatchId,
        line.minute,
        line.period,
        line.sortOrder,
        line.textEn,
        line.textEn,
        line.eventType,
        FIFA_SOURCE_ID,
      ),
  );

  await runBatchChunked(db, stmts);
  return lines.length;
}

function resolveFifaTeamIds(info: FifaMatchInfo): {
  homeFifaTeamId: string | null;
  awayFifaTeamId: string | null;
  idIfes: string | null;
} {
  const idIfes = info.Properties?.IdIFES ?? null;
  return {
    homeFifaTeamId: info.HomeTeam?.IdTeam ?? null,
    awayFifaTeamId: info.AwayTeam?.IdTeam ?? null,
    idIfes: idIfes ? String(idIfes) : null,
  };
}

async function tryEspnStatsFallback(
  db: D1Database,
  internalMatchId: string,
  homeTeamId: string,
  awayTeamId: string,
): Promise<boolean> {
  const [matchRow, teamRows] = await Promise.all([
    db
      .prepare(`SELECT kickoff_utc FROM matches WHERE id = ?`)
      .bind(internalMatchId)
      .first<{ kickoff_utc: string | null }>(),
    db
      .prepare(`SELECT id, name FROM teams WHERE id IN (?, ?)`)
      .bind(homeTeamId, awayTeamId)
      .all<{ id: string; name: string }>(),
  ]);
  if (!matchRow?.kickoff_utc) return false;

  const byId = new Map((teamRows.results ?? []).map((t) => [t.id, t.name]));
  const homeName = byId.get(homeTeamId);
  const awayName = byId.get(awayTeamId);
  if (!homeName || !awayName) return false;

  const espn = await fetchEspnTeamMatchStats(homeName, awayName, matchRow.kickoff_utc);
  if (!espn) return false;

  await upsertTeamMatchStats(db, internalMatchId, homeTeamId, espn.home);
  await upsertTeamMatchStats(db, internalMatchId, awayTeamId, espn.away);
  logInfo('espn stats fallback applied', {
    match_id: internalMatchId,
    espn_event_id: espn.eventId,
  });
  return true;
}

/** Pull Match Centre live blog (timeline) + Gameday team stats into D1. */
export async function syncFifaMatchBlogAndStats(
  env: AppEnv,
  internalMatchId: string,
  homeTeamId: string,
  awayTeamId: string,
  info: FifaMatchInfo,
  fifaMatchIdOverride?: string | null,
): Promise<{ commentary: number; statsUpdated: boolean }> {
  const fifaMatchId = fifaMatchIdOverride ?? info.IdMatch;
  if (!fifaMatchId) {
    logInfo('fifa blog sync skipped — no fifa match id', { match_id: internalMatchId });
    return { commentary: 0, statsUpdated: false };
  }
  let commentary = 0;
  let statsUpdated = false;

  const timeline = await fetchFifaTimeline(fifaMatchId);
  if (timeline?.Event?.length) {
    try {
      commentary = await syncCommentary(env.DB, internalMatchId, timeline);
    } catch (e) {
      logError('fifa commentary sync failed', { match_id: internalMatchId, error: String(e) });
    }

    const { homeFifaTeamId, awayFifaTeamId } = resolveFifaTeamIds(info);
    if (homeFifaTeamId && awayFifaTeamId) {
      const derived = deriveShotsFromTimeline(timeline, homeFifaTeamId, awayFifaTeamId);
      if (derived.homeShots > 0 || derived.awayShots > 0) {
        await upsertTeamMatchStats(env.DB, internalMatchId, homeTeamId, {
          possession: null,
          shots: derived.homeShots,
          shotsOnTarget: derived.homeSot,
          passes: null,
          passAccuracy: null,
        });
        await upsertTeamMatchStats(env.DB, internalMatchId, awayTeamId, {
          possession: null,
          shots: derived.awayShots,
          shotsOnTarget: derived.awaySot,
          passes: null,
          passAccuracy: null,
        });
      }
    }
  }

  const { idIfes, homeFifaTeamId, awayFifaTeamId } = resolveFifaTeamIds(info);
  if (idIfes) {
    const teamsStats = await fetchFifaGamedayTeamMatchStats(idIfes);
    if (teamsStats?.length && homeFifaTeamId && awayFifaTeamId) {
      const homeStats = teamsStats.find((t) => t.idTeam === homeFifaTeamId);
      const awayStats = teamsStats.find((t) => t.idTeam === awayFifaTeamId);
      if (homeStats) {
        await upsertTeamMatchStats(env.DB, internalMatchId, homeTeamId, parseGamedayTeamStats(homeStats.stats));
      }
      if (awayStats) {
        await upsertTeamMatchStats(env.DB, internalMatchId, awayTeamId, parseGamedayTeamStats(awayStats.stats));
      }
      statsUpdated = !!(homeStats || awayStats);
    }
  }

  const statsComplete = await loadTeamMatchStatsCompleteness(
    env.DB,
    internalMatchId,
    homeTeamId,
    awayTeamId,
  );
  if (!statsComplete.complete) {
    const espnApplied = await tryEspnStatsFallback(env.DB, internalMatchId, homeTeamId, awayTeamId);
    if (espnApplied) statsUpdated = true;
  }

  if (commentary > 0 || statsUpdated) {
    await env.KV.put(`meta:fifa_blog_sync:${internalMatchId}`, nowIso(), { expirationTtl: 300 });
  }

  logInfo('fifa blog sync done', {
    match_id: internalMatchId,
    fifa_match_id: fifaMatchId,
    timeline_events: timeline?.Event?.length ?? 0,
    commentary,
    statsUpdated,
  });

  const ts = nowIso();
  if (commentary > 0) {
    await emitMatchCommentaryUpdated(env, internalMatchId, {
      matchId: internalMatchId,
      lineCount: commentary,
      updatedAt: ts,
    }).catch(() => undefined);
  }
  if (statsUpdated) {
    await emitMatchStatsUpdated(env, internalMatchId, {
      matchId: internalMatchId,
      updatedAt: ts,
      dataSource: 'fifa_live',
    }).catch(() => undefined);
  }

  return { commentary, statsUpdated };
}

/** Sync blog/stats when D1 is missing FIFA data (bypasses KV throttle). */
export async function ensureFifaBlogAndStats(
  env: AppEnv,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  fifaMatchId: string | null | undefined,
  status: string,
): Promise<void> {
  if (!fifaMatchId || (status !== 'live' && status !== 'completed')) return;

  const [statsComplete, commentaryRow] = await Promise.all([
    loadTeamMatchStatsCompleteness(env.DB, matchId, homeTeamId, awayTeamId).then((r) => r.complete),
    env.DB.prepare(`SELECT 1 FROM match_commentary WHERE match_id = ? LIMIT 1`).bind(matchId).first(),
  ]);

  if (statsComplete && commentaryRow) return;

  const info = await fetchFifaMatchInfo(fifaMatchId);
  if (!info) return;

  await syncFifaMatchBlogAndStats(env, matchId, homeTeamId, awayTeamId, info, fifaMatchId);
}

export async function shouldSyncFifaBlogAndStats(
  env: AppEnv,
  internalMatchId: string,
  status: string,
  homeTeamId?: string,
  awayTeamId?: string,
): Promise<boolean> {
  if (status !== 'live' && status !== 'completed') return false;

  let homeId = homeTeamId;
  let awayId = awayTeamId;
  if (!homeId || !awayId) {
    const row = await env.DB.prepare(`SELECT home_team_id, away_team_id FROM matches WHERE id = ?`)
      .bind(internalMatchId)
      .first<{ home_team_id: string; away_team_id: string }>();
    if (!row) return false;
    homeId = row.home_team_id;
    awayId = row.away_team_id;
  }

  const { complete } = await loadTeamMatchStatsCompleteness(env.DB, internalMatchId, homeId, awayId);
  if (!complete) return true;

  const last = await env.KV.get(`meta:fifa_blog_sync:${internalMatchId}`);
  if (!last) return true;
  const interval = status === 'live' ? 25_000 : 120_000;
  return Date.now() - new Date(last).getTime() > interval;
}

/** Re-pull Gameday stats for completed/live matches missing possession or passes. */
export async function backfillIncompleteFifaMatchStats(env: AppEnv, limit = 4): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.home_team_id, m.away_team_id, m.fifa_match_id
     FROM matches m
     LEFT JOIN team_match_stats th ON th.match_id = m.id AND th.team_id = m.home_team_id
     LEFT JOIN team_match_stats ta ON ta.match_id = m.id AND ta.team_id = m.away_team_id
     WHERE m.tournament_id = ?
       AND m.status IN ('live', 'completed')
       AND m.fifa_match_id IS NOT NULL
       AND (
         th.id IS NULL OR ta.id IS NULL
         OR COALESCE(th.possession, 0) = 0 OR COALESCE(th.passes, 0) = 0
         OR COALESCE(ta.possession, 0) = 0 OR COALESCE(ta.passes, 0) = 0
       )
     ORDER BY m.kickoff_utc DESC
     LIMIT ?`,
  )
    .bind(WC2026_TOURNAMENT_ID, limit)
    .all<{
      id: string;
      home_team_id: string;
      away_team_id: string;
      fifa_match_id: string;
    }>();

  let synced = 0;
  for (const row of results ?? []) {
    const info = await fetchFifaMatchInfo(row.fifa_match_id);
    if (!info) continue;
    try {
      await syncFifaMatchBlogAndStats(
        env,
        row.id,
        row.home_team_id,
        row.away_team_id,
        info,
        row.fifa_match_id,
      );
      synced += 1;
    } catch (e) {
      logError('fifa stats backfill failed', { match_id: row.id, error: String(e) });
    }
  }

  if (synced > 0) {
    logInfo('fifa stats backfill batch', { synced, candidates: results?.length ?? 0 });
  }
  return synced;
}
