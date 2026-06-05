import type { AppEnv } from '../env';
import {
  resolveScheduleTournamentId,
  WC2026_MATCH_COUNT,
  WC2026_TOURNAMENT_ID,
  WC2026_YEAR,
} from '../constants/tournament';

export async function buildSchedulePayload(
  env: AppEnv,
  tournamentParam?: string | null,
) {
  const tournamentId = resolveScheduleTournamentId(tournamentParam ?? undefined);
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.kickoff_utc, m.status, m.stage, m.group_code,
            m.home_score, m.away_score, m.minute, m.tournament_id,
            ht.name AS home_name, ht.short_name AS home_short,
            at.name AS away_name, at.short_name AS away_short,
            date(m.kickoff_utc) AS match_date
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     WHERE m.tournament_id = ?
     ORDER BY m.kickoff_utc ASC`,
  )
    .bind(tournamentId)
    .all();

  const byDate: Record<string, unknown[]> = {};
  for (const row of results ?? []) {
    const d =
      (row as { match_date?: string; kickoff_utc?: string }).match_date ??
      (row as { kickoff_utc?: string }).kickoff_utc?.slice(0, 10) ??
      'unknown';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(row);
  }

  const list = results ?? [];
  return {
    data: { byDate, matches: list, tournamentId, total: list.length },
    meta: {
      expectedMatches: WC2026_MATCH_COUNT,
      year: WC2026_YEAR,
      tournamentId: WC2026_TOURNAMENT_ID,
      wc2026Only: true,
    },
  };
}
