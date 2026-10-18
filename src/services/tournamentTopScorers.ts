import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';

export type TopScorerEntry = {
  rank: number;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  countryCode: string | null;
  goals: number;
};

export type TopScorersPayload = {
  tournamentId: string;
  updatedAt: string;
  scorers: TopScorerEntry[];
};

const GOAL_EVENT_TYPES = ['goal', 'penalty_goal'] as const;

export async function buildTopScorersPayload(
  env: AppEnv,
  tournamentId = WC2026_TOURNAMENT_ID,
  limit = 10,
): Promise<TopScorersPayload> {
  const placeholders = GOAL_EVENT_TYPES.map(() => '?').join(', ');
  const { results = [] } = await env.DB.prepare(
    `SELECT
       p.id AS playerId,
       p.name AS playerName,
       me.team_id AS teamId,
       t.name AS teamName,
       t.country_code AS countryCode,
       COUNT(*) AS goals
     FROM match_events me
     INNER JOIN matches m ON m.id = me.match_id
     INNER JOIN players p ON p.id = me.player_id
     LEFT JOIN teams t ON t.id = me.team_id
     WHERE m.tournament_id = ?
       AND m.status IN ('completed', 'finished')
       AND me.player_id IS NOT NULL
       AND me.event_type IN (${placeholders})
     GROUP BY p.id
     ORDER BY goals DESC, p.name ASC
     LIMIT ?`,
  )
    .bind(tournamentId, ...GOAL_EVENT_TYPES, limit)
    .all<{
      playerId: string;
      playerName: string;
      teamId: string;
      teamName: string;
      countryCode: string | null;
      goals: number;
    }>();

  return {
    tournamentId,
    updatedAt: new Date().toISOString(),
    scorers: results.map((row, index) => ({
      rank: index + 1,
      playerId: row.playerId,
      playerName: row.playerName,
      teamId: row.teamId,
      teamName: row.teamName ?? '',
      countryCode: row.countryCode,
      goals: row.goals,
    })),
  };
}
