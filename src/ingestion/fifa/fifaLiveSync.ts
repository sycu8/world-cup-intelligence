import type { AppEnv } from '../../env';
import { nowIso } from '../../utils/time';
import { logInfo, logError } from '../../utils/logger';
import {
  fetchFifaCalendarMatches,
  fetchFifaMatchInfo,
  fetchFifaWc2026FixturesCalendar,
  type FifaCalendarMatch,
  type FifaMatchInfo,
  type FifaBooking,
  type FifaGoal,
  type FifaSubstitution,
} from './fifaApiClient';
import {
  fifaCountryToTeamName,
  fifaLocalizedName,
  normalizeTeamName,
  parseFifaMinute,
  periodLabel,
  resolveFifaPlatformStatus,
} from './parse';
import {
  syncFifaMatchBlogAndStats,
  shouldSyncFifaBlogAndStats,
  backfillIncompleteFifaMatchStats,
  backfillMissingFifaRecaps,
} from './fifaLiveBlogSync';
import { syncFifaMatchLineupsFromInfo, shouldSyncFifaLineupForKickoff } from './fifaLineupSync';
import { FIFA_SOURCE_ID, WC2026_TOURNAMENT_ID } from './constants';
import {
  emitMatchCompleted,
  emitMatchScoreUpdate,
  emitMatchStatusChange,
} from '../../services/publicApi/emitter';

export type FifaSyncResult = {
  updatedIds: string[];
  completedIds: string[];
  /** Knockout matches whose home/away were assigned from FIFA. */
  teamUpdatedIds: string[];
  synced: number;
  skipped: number;
};

type TeamRow = { id: string; name: string };
type MatchRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff_utc: string | null;
  status: string;
  stage: string | null;
  fifa_match_id: string | null;
  minute?: number;
  home_score?: number;
  away_score?: number;
};

function numberOrZero(value: number | null | undefined): number {
  return value ?? 0;
}

function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

async function loadTeamIndex(db: D1Database): Promise<Map<string, string>> {
  const { results } = await db
    .prepare(`SELECT id, name FROM teams WHERE id LIKE 'team-w26-%'`)
    .all<TeamRow>();
  const index = new Map<string, string>();
  for (const t of results ?? []) {
    index.set(normalizeTeamName(t.name), t.id);
  }
  return index;
}

function resolveTeamId(
  teamIndex: Map<string, string>,
  side: FifaCalendarMatch['Home'] | null | undefined,
): string | null {
  if (!side) return null;
  const label = fifaCountryToTeamName(side.IdCountry, fifaLocalizedName(side.TeamName));
  return teamIndex.get(normalizeTeamName(label)) ?? null;
}

async function loadInternalMatchIndex(db: D1Database): Promise<{
  byFifaId: Map<string, MatchRow>;
  byTeamsDay: Map<string, MatchRow>;
}> {
  const { results } = await db
    .prepare(
      `SELECT id, home_team_id, away_team_id, kickoff_utc, status, stage, fifa_match_id, minute, home_score, away_score
       FROM matches WHERE tournament_id = ?`,
    )
    .bind(WC2026_TOURNAMENT_ID)
    .all<MatchRow>();

  const byFifaId = new Map<string, MatchRow>();
  const byTeamsDay = new Map<string, MatchRow>();
  for (const row of results ?? []) {
    if (row.fifa_match_id) byFifaId.set(row.fifa_match_id, row);
    if (row.kickoff_utc) {
      byTeamsDay.set(`${row.home_team_id}:${row.away_team_id}:${utcDay(row.kickoff_utc)}`, row);
    }
  }
  return { byFifaId, byTeamsDay };
}

function resolveInternalMatch(
  fifa: FifaCalendarMatch,
  teamIndex: Map<string, string>,
  index: { byFifaId: Map<string, MatchRow>; byTeamsDay: Map<string, MatchRow> },
): MatchRow | null {
  const byFifa = index.byFifaId.get(fifa.IdMatch);
  if (byFifa) return byFifa;

  const homeId = resolveTeamId(teamIndex, fifa.Home);
  const awayId = resolveTeamId(teamIndex, fifa.Away);
  if (!homeId || !awayId) return null;

  return index.byTeamsDay.get(`${homeId}:${awayId}:${utcDay(fifa.Date)}`) ?? null;
}

/** Assign real teams to knockout slots when FIFA Match Centre lists participants. */
export async function syncTeamsFromFifaSide(
  env: AppEnv,
  internal: MatchRow,
  teamIndex: Map<string, string>,
  homeSide: FifaCalendarMatch['Home'] | FifaMatchInfo['HomeTeam'] | null | undefined,
  awaySide: FifaCalendarMatch['Away'] | FifaMatchInfo['AwayTeam'] | null | undefined,
): Promise<MatchRow> {
  if (internal.stage === 'Group') return internal;

  const homeId = resolveTeamId(teamIndex, homeSide as FifaCalendarMatch['Home']);
  const awayId = resolveTeamId(teamIndex, awaySide as FifaCalendarMatch['Away']);
  if (!homeId || !awayId) return internal;
  if (homeId === internal.home_team_id && awayId === internal.away_team_id) return internal;

  const now = nowIso();
  await env.DB.prepare(
    `UPDATE matches SET home_team_id = ?, away_team_id = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(homeId, awayId, now, internal.id)
    .run();

  logInfo('fifa knockout teams synced', {
    match_id: internal.id,
    stage: internal.stage,
    home_team_id: homeId,
    away_team_id: awayId,
  });

  return { ...internal, home_team_id: homeId, away_team_id: awayId };
}

function playerIdFromFifa(
  players: { IdPlayer?: string; ShirtNumber?: number }[] | undefined,
  idPlayer: string | undefined,
): string | null {
  if (!idPlayer || !players?.length) return null;
  const hit = players.find((p) => p.IdPlayer === idPlayer);
  if (!hit?.ShirtNumber) return null;
  return `p-fifa-${idPlayer}`;
}

async function syncMatchEvents(
  db: D1Database,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  info: FifaMatchInfo,
): Promise<void> {
  const home = info.HomeTeam;
  const away = info.AwayTeam;
  if (!home || !away) return;

  await db.prepare(`DELETE FROM match_events WHERE match_id = ? AND source_id = ?`).bind(matchId, FIFA_SOURCE_ID).run();

  const stmts: D1PreparedStatement[] = [];
  let seq = 0;

  const pushEvent = (
    teamId: string,
    eventType: string,
    minute: number,
    period: string,
    playerId: string | null,
    relatedPlayerId: string | null = null,
  ) => {
    seq += 1;
    stmts.push(
      db.prepare(
        `INSERT INTO match_events (id, match_id, team_id, player_id, related_player_id, event_type, minute, period, outcome, xg, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
      ).bind(
        `ev-fifa-${matchId}-${seq}`,
        matchId,
        teamId,
        playerId,
        relatedPlayerId,
        eventType,
        minute,
        period,
        FIFA_SOURCE_ID,
      ),
    );
  };

  const ingestGoals = (goals: FifaGoal[] | undefined, teamId: string, players: typeof home.Players) => {
    for (const g of goals ?? []) {
      const minute = parseFifaMinute(g.Minute);
      pushEvent(teamId, 'goal', minute, periodLabel(g.Period), playerIdFromFifa(players, g.IdPlayer));
    }
  };

  const ingestBookings = (bookings: FifaBooking[] | undefined, teamId: string, players: typeof home.Players) => {
    for (const b of bookings ?? []) {
      const minute = parseFifaMinute(b.Minute);
      const type = b.Card === 2 ? 'red_card' : 'yellow_card';
      pushEvent(teamId, type, minute, periodLabel(b.Period), playerIdFromFifa(players, b.IdPlayer ?? undefined));
    }
  };

  const ingestSubs = (subs: FifaSubstitution[] | undefined, teamId: string, players: typeof home.Players) => {
    for (const s of subs ?? []) {
      const minute = parseFifaMinute(s.Minute);
      const onId = playerIdFromFifa(players, s.IdSubstitute);
      const offId = playerIdFromFifa(players, s.IdPlayer);
      pushEvent(teamId, 'substitution', minute, periodLabel(s.Period), onId, offId);
    }
  };

  ingestGoals(home.Goals, homeTeamId, home.Players);
  ingestGoals(away.Goals, awayTeamId, away.Players);
  ingestBookings(home.Bookings, homeTeamId, home.Players);
  ingestBookings(away.Bookings, awayTeamId, away.Players);
  ingestSubs(home.Substitutions, homeTeamId, home.Players);
  ingestSubs(away.Substitutions, awayTeamId, away.Players);

  if (stmts.length) await db.batch(stmts);
}

async function syncTeamStats(
  db: D1Database,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  info: FifaMatchInfo,
): Promise<void> {
  const possession = info.BallPossession;
  if (possession?.OverallHome == null && possession?.OverallAway == null) return;

  const ts = nowIso();
  for (const [teamId, poss] of [
    [homeTeamId, possession?.OverallHome ?? null],
    [awayTeamId, possession?.OverallAway ?? null],
  ] as const) {
    if (poss == null) continue;
    const existing = await db
      .prepare(`SELECT id FROM team_match_stats WHERE match_id = ? AND team_id = ?`)
      .bind(matchId, teamId)
      .first<{ id: string }>();
    if (existing) {
      await db
        .prepare(`UPDATE team_match_stats SET possession = ?, created_at = ? WHERE id = ?`)
        .bind(poss, ts, existing.id)
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO team_match_stats (id, match_id, team_id, possession, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(`tms-fifa-${matchId}-${teamId}`, matchId, teamId, poss, ts)
        .run();
    }
  }
}

async function applyFifaPayload(
  env: AppEnv,
  internal: MatchRow,
  payload: FifaMatchInfo,
  teamIndex: Map<string, string> = new Map(),
): Promise<'updated' | 'completed' | 'unchanged' | 'teams_updated'> {
  const beforeHome = internal.home_team_id;
  const beforeAway = internal.away_team_id;
  internal = await syncTeamsFromFifaSide(env, internal, teamIndex, payload.HomeTeam, payload.AwayTeam);
  const teamsChanged =
    internal.home_team_id !== beforeHome || internal.away_team_id !== beforeAway;

  const readScore = (team: { Score?: number | null } | undefined, flat?: number | null) =>
    numberOrZero(team?.Score != null ? team.Score : flat);
  const homeScore = readScore(payload.HomeTeam, payload.HomeTeamScore);
  const awayScore = readScore(payload.AwayTeam, payload.AwayTeamScore);
  const minute = parseFifaMinute(payload.MatchTime);
  const status = resolveFifaPlatformStatus(payload);
  const now = nowIso();

  const changed =
    internal.status !== status ||
    minute !== numberOrZero(internal.minute) ||
    homeScore !== numberOrZero(internal.home_score) ||
    awayScore !== numberOrZero(internal.away_score);

  await env.DB
    .prepare(
      `UPDATE matches SET
         status = ?, minute = ?, home_score = ?, away_score = ?,
         fifa_match_id = COALESCE(fifa_match_id, ?),
         updated_at = ?
       WHERE id = ?`,
    )
    .bind(status, minute, homeScore, awayScore, payload.IdMatch, now, internal.id)
    .run();

  await syncMatchEvents(env.DB, internal.id, internal.home_team_id, internal.away_team_id, payload);
  await syncTeamStats(env.DB, internal.id, internal.home_team_id, internal.away_team_id, payload);

  if (shouldSyncFifaLineupForKickoff(internal.kickoff_utc ?? null, status)) {
    try {
      await syncFifaMatchLineupsFromInfo(
        env,
        internal.id,
        internal.home_team_id,
        internal.away_team_id,
        payload,
      );
    } catch (e) {
      logError('fifa lineup sync failed', { match_id: internal.id, error: String(e) });
    }
  }

  if (
    (status === 'live' || status === 'completed') &&
    (await shouldSyncFifaBlogAndStats(
      env,
      internal.id,
      status,
      internal.home_team_id,
      internal.away_team_id,
    ))
  ) {
    try {
      await syncFifaMatchBlogAndStats(
        env,
        internal.id,
        internal.home_team_id,
        internal.away_team_id,
        payload,
        payload.IdMatch,
      );
    } catch (e) {
      logError('fifa live blog/stats sync failed', { match_id: internal.id, error: String(e) });
    }
  }

  if (status === 'completed') {
    if (internal.status !== 'completed') {
      await emitMatchCompleted(env, {
        matchId: internal.id,
        status,
        minute,
        homeScore,
        awayScore,
        updatedAt: now,
      }).catch(() => undefined);
    }
    return 'completed';
  }

  if (changed) {
    const ctx = {
      matchId: internal.id,
      status,
      minute,
      homeScore,
      awayScore,
      updatedAt: now,
    };
    if (internal.status !== status) {
      await emitMatchStatusChange(env, ctx).catch(() => undefined);
    } else {
      await emitMatchScoreUpdate(env, ctx).catch(() => undefined);
    }
  }

  if (teamsChanged) return 'teams_updated';
  return changed ? 'updated' : 'unchanged';
}

async function applyFifaCalendarRow(
  env: AppEnv,
  internal: MatchRow,
  row: FifaCalendarMatch,
  teamIndex: Map<string, string>,
): Promise<'updated' | 'unchanged' | 'teams_updated'> {
  const beforeHome = internal.home_team_id;
  const beforeAway = internal.away_team_id;
  if (internal.stage !== 'Group') {
    internal = await syncTeamsFromFifaSide(env, internal, teamIndex, row.Home, row.Away);
  }
  const teamsChanged =
    internal.home_team_id !== beforeHome || internal.away_team_id !== beforeAway;

  const homeScore = numberOrZero(row.HomeTeamScore);
  const awayScore = numberOrZero(row.AwayTeamScore);
  const minute = parseFifaMinute(row.MatchTime);
  const status = resolveFifaPlatformStatus(row);
  const now = nowIso();

  const changed =
    internal.status !== status ||
    minute !== numberOrZero(internal.minute) ||
    homeScore !== numberOrZero(internal.home_score) ||
    awayScore !== numberOrZero(internal.away_score);

  if (!changed && !teamsChanged) return 'unchanged';

  if (changed) {
    await env.DB.prepare(
      `UPDATE matches SET
         status = ?, minute = ?, home_score = ?, away_score = ?,
         fifa_match_id = COALESCE(fifa_match_id, ?),
         updated_at = ?
       WHERE id = ?`,
    )
      .bind(status, minute, homeScore, awayScore, row.IdMatch, now, internal.id)
      .run();
  }

  return teamsChanged && !changed ? 'teams_updated' : 'updated';
}

function needsFullFifaMatchInfo(row: FifaCalendarMatch, platformStatus: string, nowMs: number): boolean {
  if (platformStatus === 'live') return true;
  const kickoff = new Date(row.Date).getTime();
  const hoursFromKick = (nowMs - kickoff) / 3600_000;
  return hoursFromKick >= -3 && hoursFromKick <= 5;
}

/** @internal exported for unit tests */
export { needsFullFifaMatchInfo, applyFifaPayload, applyFifaCalendarRow };

/** Pull FIFA scores-fixtures / Match Centre data for all WC2026 matches. */
export async function syncFifaWc2026Matches(env: AppEnv): Promise<FifaSyncResult> {
  const updatedIds: string[] = [];
  const completedIds: string[] = [];
  const teamUpdatedIds: string[] = [];
  let synced = 0;
  let skipped = 0;

  const calendar = await fetchFifaWc2026FixturesCalendar();
  const teamIndex = await loadTeamIndex(env.DB);
  const matchIndex = await loadInternalMatchIndex(env.DB);
  const nowMs = Date.now();
  const fifaIdLinks: { id: string; fifaId: string }[] = [];

  for (const row of calendar) {
    if (!row.Home || !row.Away) {
      skipped += 1;
      continue;
    }

    const internal = resolveInternalMatch(row, teamIndex, matchIndex);
    if (!internal) {
      skipped += 1;
      continue;
    }

    if (!internal.fifa_match_id) {
      fifaIdLinks.push({ id: internal.id, fifaId: row.IdMatch });
      internal.fifa_match_id = row.IdMatch;
      matchIndex.byFifaId.set(row.IdMatch, internal);
    }

    const platformStatus = resolveFifaPlatformStatus(row);

    try {
      if (needsFullFifaMatchInfo(row, platformStatus, nowMs)) {
        const info = (await fetchFifaMatchInfo(row.IdMatch)) ?? row;
        const outcome = await applyFifaPayload(env, internal, info as FifaMatchInfo, teamIndex);
        synced += 1;
        if (outcome === 'completed') completedIds.push(internal.id);
        else if (outcome === 'updated') updatedIds.push(internal.id);
        else if (outcome === 'teams_updated') teamUpdatedIds.push(internal.id);

        await env.R2_RAW.put(
          `fifa/live/${row.IdMatch}/${nowIso()}.json`,
          JSON.stringify(info),
          { httpMetadata: { contentType: 'application/json' } },
        );
      } else {
        const outcome = await applyFifaCalendarRow(env, internal, row, teamIndex);
        synced += 1;
        if (platformStatus === 'completed') completedIds.push(internal.id);
        else if (outcome === 'updated') updatedIds.push(internal.id);
        else if (outcome === 'teams_updated') teamUpdatedIds.push(internal.id);
      }
    } catch (e) {
      logError('fifa match sync failed', { match_id: internal.id, error: String(e) });
    }
  }

  if (fifaIdLinks.length) {
    const now = nowIso();
    await env.DB.batch(
      fifaIdLinks.map(({ id, fifaId }) =>
        env.DB.prepare(`UPDATE matches SET fifa_match_id = ?, updated_at = ? WHERE id = ?`).bind(fifaId, now, id),
      ),
    );
  }

  if (synced > 0) {
    await env.KV.put('meta:last_fifa_sync', nowIso(), { expirationTtl: 86400 });
  }

  await backfillIncompleteFifaMatchStats(env, 4).catch((e) => {
    logError('fifa stats backfill batch failed', { error: String(e) });
  });

  await backfillMissingFifaRecaps(env, 4).catch((e) => {
    logError('fifa recap backfill batch failed', { error: String(e) });
  });

  logInfo('fifa wc2026 sync complete', {
    calendar: calendar.length,
    synced,
    skipped,
    updated: updatedIds.length,
    completed: completedIds.length,
  });
  return { updatedIds, completedIds, teamUpdatedIds, synced, skipped };
}

/** On-demand sync for a single internal match (stats page poll). */
export async function syncFifaMatchByRef(env: AppEnv, internalMatchId: string): Promise<boolean> {
  const match = await env.DB.prepare(
    `SELECT id, home_team_id, away_team_id, kickoff_utc, status, stage, fifa_match_id, minute, home_score, away_score
     FROM matches WHERE id = ?`,
  )
    .bind(internalMatchId)
    .first<MatchRow>();
  if (!match) return false;

  const teamIndex = await loadTeamIndex(env.DB);

  let fifaId = match.fifa_match_id;
  if (!fifaId) {
    const day = match.kickoff_utc ? utcDay(match.kickoff_utc) : utcDay(nowIso());
    const from = `${day}T00:00:00Z`;
    const to = `${day}T23:59:59Z`;
    const calendar = await fetchFifaCalendarMatches(from, to);
    const hit = calendar.find((c) => {
      const homeId = resolveTeamId(teamIndex, c.Home);
      const awayId = resolveTeamId(teamIndex, c.Away);
      return homeId === match.home_team_id && awayId === match.away_team_id;
    });
    if (!hit) return false;
    fifaId = hit.IdMatch;
    await env.DB.prepare(`UPDATE matches SET fifa_match_id = ? WHERE id = ?`).bind(fifaId, match.id).run();
  }

  const info = await fetchFifaMatchInfo(fifaId);
  if (!info) return false;
  const synced = await applyFifaPayload(env, match, info, teamIndex);
  const refreshed = await env.DB.prepare(
    `SELECT home_team_id, away_team_id, status FROM matches WHERE id = ?`,
  )
    .bind(match.id)
    .first<{ home_team_id: string; away_team_id: string; status: string }>();
  const homeTeamId = refreshed?.home_team_id ?? match.home_team_id;
  const awayTeamId = refreshed?.away_team_id ?? match.away_team_id;
  const status = refreshed?.status ?? match.status;

  if (status === 'live' || status === 'completed') {
    try {
      await syncFifaMatchBlogAndStats(
        env,
        match.id,
        homeTeamId,
        awayTeamId,
        info,
        fifaId,
      );
    } catch (e) {
      logError('fifa on-demand blog sync failed', { match_id: match.id, error: String(e) });
    }
  }
  void synced;
  await env.KV.put(`meta:fifa_sync:${internalMatchId}`, nowIso(), { expirationTtl: 300 });
  return true;
}

export async function shouldSyncFifaMatch(env: AppEnv, internalMatchId: string, status: string): Promise<boolean> {
  if (status !== 'live') return false;
  const last = await env.KV.get(`meta:fifa_sync:${internalMatchId}`);
  if (!last) return true;
  return Date.now() - new Date(last).getTime() > 20_000;
}
