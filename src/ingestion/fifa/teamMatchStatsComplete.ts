/** Minimal team stat columns used to decide if FIFA Match Centre stats are complete. */
export type TeamStatCompletenessRow = {
  possession: number | null;
  passes: number | null;
};

/**
 * Full Match Centre stats require possession and passes for both sides.
 * Timeline-only fallbacks often set shots while leaving possession/passes at 0.
 */
export function areTeamMatchStatsComplete(
  home: TeamStatCompletenessRow | null | undefined,
  away: TeamStatCompletenessRow | null | undefined,
): boolean {
  if (!home || !away) return false;
  const homePoss = home.possession ?? 0;
  const awayPoss = away.possession ?? 0;
  const homePasses = home.passes ?? 0;
  const awayPasses = away.passes ?? 0;
  return homePoss > 0 && awayPoss > 0 && homePasses > 0 && awayPasses > 0;
}

export async function loadTeamMatchStatsCompleteness(
  db: D1Database,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
): Promise<{ complete: boolean; home: TeamStatCompletenessRow | null; away: TeamStatCompletenessRow | null }> {
  const { results } = await db
    .prepare(
      `SELECT team_id, possession, passes
       FROM team_match_stats
       WHERE match_id = ? AND team_id IN (?, ?)`,
    )
    .bind(matchId, homeTeamId, awayTeamId)
    .all<{ team_id: string; possession: number | null; passes: number | null }>();

  const byTeam = new Map((results ?? []).map((r) => [r.team_id, r]));
  const home = byTeam.get(homeTeamId) ?? null;
  const away = byTeam.get(awayTeamId) ?? null;
  return {
    complete: areTeamMatchStatsComplete(home, away),
    home,
    away,
  };
}
