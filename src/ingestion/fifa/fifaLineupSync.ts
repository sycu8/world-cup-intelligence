import type { AppEnv } from '../../env';
import { WC2026_TOURNAMENT_ID, FIFA_SOURCE_ID } from './constants';
import { fetchFifaMatchInfo, type FifaMatchInfo, type FifaSideDetail } from './fifaApiClient';
import { resolveOrCreateFifaPlayer, mapFifaPlayerPosition } from './fifaPlayerResolve';
import { applyOfficialLineupToMatch } from '../../services/officialLineupSync';
import { logInfo, logError } from '../../utils/logger';
import { nowIso } from '../../utils/time';
import * as lineupsRepo from '../../db/repositories/lineupsRepo';

const PRE_KICKOFF_MINUTES = 10;
const PRE_KICKOFF_WINDOW_MINUTES = 90;
const POST_KICKOFF_MINUTES = 120;

export function countFifaStarters(side: FifaSideDetail | null | undefined): number {
  return (side?.Players ?? []).filter((p) => p.Status === 1).length;
}

export function isFifaLineupReady(info: FifaMatchInfo): boolean {
  return countFifaStarters(info.HomeTeam) >= 11 && countFifaStarters(info.AwayTeam) >= 11;
}

/** Whether we should pull FIFA lineups for this kickoff/status (from 10 min before kickoff). */
export function shouldSyncFifaLineupForKickoff(
  kickoffUtc: string | null | undefined,
  status: string,
  nowMs = Date.now(),
): boolean {
  if (!kickoffUtc) return status === 'live';
  if (status === 'live') return true;

  const kickoffMs = new Date(kickoffUtc).getTime();
  if (!Number.isFinite(kickoffMs)) return false;

  const minutesToKick = (kickoffMs - nowMs) / 60_000;
  if (status === 'scheduled') {
    return minutesToKick <= PRE_KICKOFF_WINDOW_MINUTES && minutesToKick >= -POST_KICKOFF_MINUTES;
  }
  if (status === 'completed') return minutesToKick >= -POST_KICKOFF_MINUTES;
  return false;
}

export function isPreKickoffLineupWindow(
  kickoffUtc: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!kickoffUtc) return false;
  const kickoffMs = new Date(kickoffUtc).getTime();
  if (!Number.isFinite(kickoffMs)) return false;
  const minutesToKick = (kickoffMs - nowMs) / 60_000;
  return minutesToKick <= PRE_KICKOFF_MINUTES && minutesToKick >= -5;
}

async function syncFifaTeamLineup(
  db: D1Database,
  matchId: string,
  teamId: string,
  nationality: string | null,
  side: FifaSideDetail | null | undefined,
): Promise<boolean> {
  const players = side?.Players ?? [];
  const starters = players.filter((p) => p.Status === 1);
  const bench = players.filter((p) => p.Status === 2);
  if (starters.length < 11) return false;

  const lineupPlayers: {
    playerId: string;
    isStarter: boolean;
    positionSlot: string;
    shirtNumber: number | null;
  }[] = [];

  for (const fp of [...starters, ...bench]) {
    const playerId = await resolveOrCreateFifaPlayer(db, teamId, nationality, fp);
    if (!playerId) continue;
    lineupPlayers.push({
      playerId,
      isStarter: fp.Status === 1,
      positionSlot: mapFifaPlayerPosition(fp.Position),
      shirtNumber: fp.ShirtNumber ?? null,
    });
  }

  const starterRows = lineupPlayers.filter((p) => p.isStarter);
  if (starterRows.length < 11) return false;

  const formation = (side?.Tactics ?? '4-4-2').trim() || '4-4-2';
  const result = await applyOfficialLineupToMatch(
    { DB: db } as AppEnv,
    {
      matchId,
      teamId,
      formation,
      sourceId: FIFA_SOURCE_ID,
      confidence: 0.99,
      players: lineupPlayers.map((p) => ({
        playerId: p.playerId,
        isStarter: p.isStarter,
        positionSlot: p.positionSlot,
        shirtNumber: p.shirtNumber,
      })),
    },
  );

  return result.updated;
}

export async function syncFifaMatchLineupsFromInfo(
  env: AppEnv,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  info: FifaMatchInfo,
): Promise<{ updated: boolean; home: boolean; away: boolean }> {
  if (!isFifaLineupReady(info)) {
    return { updated: false, home: false, away: false };
  }

  const [homeTeam, awayTeam] = await Promise.all([
    env.DB.prepare(`SELECT country_code FROM teams WHERE id = ?`)
      .bind(homeTeamId)
      .first<{ country_code: string | null }>(),
    env.DB.prepare(`SELECT country_code FROM teams WHERE id = ?`)
      .bind(awayTeamId)
      .first<{ country_code: string | null }>(),
  ]);

  let home = false;
  let away = false;
  try {
    home = await syncFifaTeamLineup(
      env.DB,
      matchId,
      homeTeamId,
      homeTeam?.country_code ?? null,
      info.HomeTeam,
    );
    away = await syncFifaTeamLineup(
      env.DB,
      matchId,
      awayTeamId,
      awayTeam?.country_code ?? null,
      info.AwayTeam,
    );
  } catch (e) {
    logError('fifa lineup sync failed', { match_id: matchId, error: String(e) });
    return { updated: false, home, away };
  }

  if (home || away) {
    logInfo('fifa lineup sync applied', {
      match_id: matchId,
      fifa_match_id: info.IdMatch,
      home_updated: home,
      away_updated: away,
      formation_home: info.HomeTeam?.Tactics,
      formation_away: info.AwayTeam?.Tactics,
    });
  }

  return { updated: home || away, home, away };
}

export async function syncFifaMatchLineupsByRef(env: AppEnv, matchId: string): Promise<boolean> {
  const match = await env.DB.prepare(
    `SELECT id, home_team_id, away_team_id, kickoff_utc, status, fifa_match_id
     FROM matches WHERE id = ?`,
  )
    .bind(matchId)
    .first<{
      id: string;
      home_team_id: string;
      away_team_id: string;
      kickoff_utc: string | null;
      status: string;
      fifa_match_id: string | null;
    }>();

  if (!match) return false;

  const forceSync =
    match.status === 'live' ||
    isPreKickoffLineupWindow(match.kickoff_utc) ||
    shouldSyncFifaLineupForKickoff(match.kickoff_utc, match.status);

  if (!forceSync) {
    const homeRow = await lineupsRepo.getMatchLineupRow(env.DB, matchId, match.home_team_id);
    const awayRow = await lineupsRepo.getMatchLineupRow(env.DB, matchId, match.away_team_id);
    if (
      homeRow?.source_type === 'match_official' &&
      awayRow?.source_type === 'match_official'
    ) {
      return false;
    }
  }

  let fifaId = match.fifa_match_id;
  if (!fifaId) {
    const { syncFifaMatchByRef } = await import('./fifaLiveSync');
    await syncFifaMatchByRef(env, matchId).catch(() => undefined);
    const refreshed = await env.DB.prepare(`SELECT fifa_match_id FROM matches WHERE id = ?`)
      .bind(matchId)
      .first<{ fifa_match_id: string | null }>();
    fifaId = refreshed?.fifa_match_id ?? null;
  }
  if (!fifaId) return false;

  const info = await fetchFifaMatchInfo(fifaId);
  if (!info) return false;

  const result = await syncFifaMatchLineupsFromInfo(
    env,
    matchId,
    match.home_team_id,
    match.away_team_id,
    info,
  );

  if (result.updated) {
    await env.KV.put(`meta:fifa_lineup_sync:${matchId}`, nowIso(), { expirationTtl: 600 });
  }

  return result.updated;
}

export type SyncFifaLineupsBatchResult = {
  checked: number;
  updated: number;
  matchIds: string[];
};

/** Pull FIFA match-sheet lineups for fixtures in the pre-kickoff / live window. */
export async function syncFifaLineupsForUpcomingMatches(env: AppEnv): Promise<SyncFifaLineupsBatchResult> {
  const { results } = await env.DB.prepare(
    `SELECT id, kickoff_utc, status FROM matches
     WHERE tournament_id = ?
       AND status IN ('scheduled', 'live')
       AND kickoff_utc IS NOT NULL
       AND datetime(kickoff_utc) <= datetime('now', '+${PRE_KICKOFF_WINDOW_MINUTES} minutes')
       AND datetime(kickoff_utc) >= datetime('now', '-${POST_KICKOFF_MINUTES} minutes')
     ORDER BY kickoff_utc ASC
     LIMIT 12`,
  )
    .bind(WC2026_TOURNAMENT_ID)
    .all<{ id: string; kickoff_utc: string; status: string }>();

  const matchIds: string[] = [];
  for (const row of results ?? []) {
    if (!shouldSyncFifaLineupForKickoff(row.kickoff_utc, row.status)) continue;

    const inPreKickoff = isPreKickoffLineupWindow(row.kickoff_utc);
    const last = await env.KV.get(`meta:fifa_lineup_sync:${row.id}`);
    if (last && !inPreKickoff && row.status === 'scheduled') {
      const age = Date.now() - new Date(last).getTime();
      if (age < 120_000) continue;
    }
    if (inPreKickoff || row.status === 'live' || row.status === 'scheduled') {
      const updated = await syncFifaMatchLineupsByRef(env, row.id);
      if (updated) matchIds.push(row.id);
    }
  }

  if (matchIds.length) {
    logInfo('fifa lineup batch sync', { updated: matchIds.length, matchIds });
  }

  return { checked: results?.length ?? 0, updated: matchIds.length, matchIds };
}
