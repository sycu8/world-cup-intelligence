import type { AppEnv } from '../env';
import { resolveMatchRef } from './matchRef';

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
  dataSource: 'recorded' | 'unavailable';
  home: TeamMatchStatsRow;
  away: TeamMatchStatsRow;
  events: {
    goals: number;
    yellowCards: number;
    redCards: number;
    substitutions: number;
  };
  xgEstimateNote: string;
};

export async function getMatchStats(env: AppEnv, ref: string): Promise<MatchStatsPayload | null> {
  const resolved = await resolveMatchRef(env.DB, ref);
  if (!resolved) return null;

  const matchId = resolved.id;

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
    dataSource: hasStats ? 'recorded' : 'unavailable',
    home: mapSide(homeTeam, homeStats),
    away: mapSide(awayTeam, awayStats),
    events: {
      goals: eventCounts?.goals ?? 0,
      yellowCards: eventCounts?.yellow_cards ?? 0,
      redCards: eventCounts?.red_cards ?? 0,
      substitutions: eventCounts?.substitutions ?? 0,
    },
    xgEstimateNote: 'xG ước tính bởi PitchIntel',
  };
}
