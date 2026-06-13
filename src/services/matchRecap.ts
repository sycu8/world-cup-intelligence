import type { AppEnv } from '../env';
import { parseEnv } from '../env';
import { resolveMatchRef } from './matchRef';
import { syncFifaMatchByRef } from '../ingestion/fifa/fifaLiveSync';
import { shouldSyncFifaBlogAndStats, ensureFifaBlogAndStats } from '../ingestion/fifa/fifaLiveBlogSync';
import { loadTeamMatchStatsCompleteness } from '../ingestion/fifa/teamMatchStatsComplete';

export type CommentaryLine = {
  id: string;
  minute: number | null;
  period: string | null;
  textVi: string;
  textEn: string;
  eventType: string | null;
};

export type PlayerMatchStatRow = {
  playerId: string;
  playerName: string;
  teamId: string;
  shirtNumber: number | null;
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  yellowCards: number;
  redCards: number;
};

export type MatchRecapPayload = {
  matchId: string;
  slug: string;
  summaryVi: string;
  summaryEn: string;
  sourceId: string | null;
  updatedAt: string | null;
  commentary: CommentaryLine[];
  playerStats: PlayerMatchStatRow[];
};

export async function getMatchRecap(env: AppEnv, ref: string): Promise<MatchRecapPayload | null> {
  const resolved = await resolveMatchRef(env.DB, ref);
  if (!resolved) return null;

  const matchId = resolved.id;

  if (parseEnv(env).fifaLiveEnabled || !parseEnv(env).mockSources) {
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
    if (needsBlogStatsSync) {
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

  const [recap, commentaryRows, playerRows] = await Promise.all([
    env.DB.prepare(
      `SELECT summary_vi, summary_en, source_id, updated_at FROM match_recaps WHERE match_id = ?`,
    )
      .bind(matchId)
      .first<{
        summary_vi: string;
        summary_en: string;
        source_id: string | null;
        updated_at: string | null;
      }>(),
    env.DB.prepare(
      `SELECT id, minute, period, text_vi, text_en, event_type
       FROM match_commentary WHERE match_id = ? ORDER BY sort_order ASC`,
    )
      .bind(matchId)
      .all<{
        id: string;
        minute: number | null;
        period: string | null;
        text_vi: string;
        text_en: string;
        event_type: string | null;
      }>(),
    env.DB.prepare(
      `SELECT pms.player_id, p.name AS player_name, pms.team_id, lp.shirt_number,
              pms.minutes_played, pms.goals, pms.assists, pms.shots, pms.shots_on_target,
              pms.xg, pms.yellow_cards, pms.red_cards
       FROM player_match_stats pms
       JOIN players p ON p.id = pms.player_id
       LEFT JOIN lineup_players lp ON lp.player_id = pms.player_id
         AND lp.lineup_id IN (
           SELECT id FROM lineups WHERE match_id = pms.match_id AND team_id = pms.team_id
         )
       WHERE pms.match_id = ?
       ORDER BY pms.goals DESC, pms.xg DESC, p.name ASC`,
    )
      .bind(matchId)
      .all<{
        player_id: string;
        player_name: string;
        team_id: string;
        shirt_number: number | null;
        minutes_played: number;
        goals: number;
        assists: number;
        shots: number;
        shots_on_target: number;
        xg: number;
        yellow_cards: number;
        red_cards: number;
      }>(),
  ]);

  if (!recap && (commentaryRows.results ?? []).length === 0) return null;

  return {
    matchId,
    slug: resolved.slug,
    summaryVi: recap?.summary_vi ?? '',
    summaryEn: recap?.summary_en ?? '',
    sourceId: recap?.source_id ?? null,
    updatedAt: recap?.updated_at ?? null,
    commentary: (commentaryRows.results ?? []).map((r) => ({
      id: r.id,
      minute: r.minute,
      period: r.period,
      textVi: r.text_vi,
      textEn: r.text_en,
      eventType: r.event_type,
    })),
    playerStats: (playerRows.results ?? []).map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      teamId: r.team_id,
      shirtNumber: r.shirt_number,
      minutesPlayed: r.minutes_played,
      goals: r.goals,
      assists: r.assists,
      shots: r.shots,
      shotsOnTarget: r.shots_on_target,
      xg: r.xg,
      yellowCards: r.yellow_cards,
      redCards: r.red_cards,
    })),
  };
}
