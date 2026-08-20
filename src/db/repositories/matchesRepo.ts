import type { MatchRow } from '../schema';
import { WC2026_TOURNAMENT_ID } from '../../constants/tournament';

export async function listMatches(
  db: D1Database,
  limit = 50,
  offset = 0,
  tournamentId = WC2026_TOURNAMENT_ID,
): Promise<MatchRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM matches
       WHERE tournament_id = ?
       ORDER BY kickoff_utc DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(tournamentId, limit, offset)
    .all<MatchRow>();
  return results ?? [];
}

export async function getMatch(db: D1Database, matchId: string): Promise<MatchRow | null> {
  return db.prepare('SELECT * FROM matches WHERE id = ?').bind(matchId).first<MatchRow>();
}

export async function getMatchesByTournament(db: D1Database, tournamentId: string): Promise<MatchRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM matches WHERE tournament_id = ? ORDER BY kickoff_utc ASC')
    .bind(tournamentId)
    .all<MatchRow>();
  return results ?? [];
}
