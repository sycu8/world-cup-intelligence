import type { TeamRow } from '../schema';
import { applyEffectiveTeamProfile } from '../../services/teamProfile';

export async function listTeams(db: D1Database, limit = 50, offset = 0): Promise<TeamRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM teams ORDER BY fifa_ranking ASC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<TeamRow>();
  return results ?? [];
}

export async function getTeam(db: D1Database, teamId: string): Promise<TeamRow | null> {
  const row = await db.prepare('SELECT * FROM teams WHERE id = ?').bind(teamId).first<TeamRow>();
  return row ? applyEffectiveTeamProfile(row) : null;
}

/** Official WC draw slots only — excludes knockout TBD placeholders (team-w26-ko-*). */
export async function getTeamsByTournament(db: D1Database, tournamentId: string): Promise<TeamRow[]> {
  if (!tournamentId || tournamentId === 't-2026') {
    const { results } = await db
      .prepare(
        `SELECT t.* FROM teams t
         WHERE t.id GLOB 'team-w26-[a-l][1-4]'
         ORDER BY t.id ASC`,
      )
      .all<TeamRow>();
    return results ?? [];
  }

  const fromTable = await db
    .prepare(
      `SELECT t.* FROM teams t
       INNER JOIN league_table_rows r ON r.team_id = t.id
       WHERE r.tournament_id = ?
       GROUP BY t.id
       ORDER BY MIN(r.rank) ASC`,
    )
    .bind(tournamentId)
    .all<TeamRow>();
  if (fromTable.results?.length) return fromTable.results.map((row) => applyEffectiveTeamProfile(row));

  const { results } = await db
    .prepare(
      `SELECT DISTINCT t.* FROM teams t
       INNER JOIN matches m ON m.home_team_id = t.id OR m.away_team_id = t.id
       WHERE m.tournament_id = ?
       ORDER BY t.name ASC`,
    )
    .bind(tournamentId)
    .all<TeamRow>();
  return (results ?? []).map((row) => applyEffectiveTeamProfile(row));
}
