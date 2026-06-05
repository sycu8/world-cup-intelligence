export type LineupPlayerInput = {
  playerId: string;
  isStarter: boolean;
  positionSlot?: string | null;
  shirtNumber?: number | null;
  role?: string | null;
};

export type UpsertMatchLineupInput = {
  matchId: string;
  teamId: string;
  formation: string;
  sourceId?: string | null;
  sourceType: string;
  isOfficial: boolean;
  confidence?: number;
  publishedAt?: string | null;
  players: LineupPlayerInput[];
};

export async function upsertMatchLineup(
  db: D1Database,
  input: UpsertMatchLineupInput,
): Promise<string> {
  const lineupId = `lu-${input.matchId}-${input.teamId}`;
  const publishedAt = input.publishedAt ?? new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO lineups (id, match_id, team_id, source_id, source_type, formation, is_official, confidence, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         source_id = excluded.source_id,
         source_type = excluded.source_type,
         formation = excluded.formation,
         is_official = excluded.is_official,
         confidence = excluded.confidence,
         published_at = excluded.published_at`,
    )
    .bind(
      lineupId,
      input.matchId,
      input.teamId,
      input.sourceId ?? null,
      input.sourceType,
      input.formation,
      input.isOfficial ? 1 : 0,
      input.confidence ?? 0.85,
      publishedAt,
    )
    .run();

  await db.prepare('DELETE FROM lineup_players WHERE lineup_id = ?').bind(lineupId).run();

  for (const player of input.players) {
    await db
      .prepare(
        `INSERT INTO lineup_players (lineup_id, player_id, is_starter, role, position_slot, shirt_number)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        lineupId,
        player.playerId,
        player.isStarter ? 1 : 0,
        player.role ?? null,
        player.positionSlot ?? null,
        player.shirtNumber ?? null,
      )
      .run();
  }

  return lineupId;
}

export async function getMatchLineupRow(
  db: D1Database,
  matchId: string,
  teamId: string,
): Promise<{ id: string; formation: string; is_official: number; source_type: string | null } | null> {
  return db
    .prepare(
      `SELECT id, formation, is_official, source_type FROM lineups
       WHERE match_id = ? AND team_id = ?`,
    )
    .bind(matchId, teamId)
    .first<{ id: string; formation: string; is_official: number; source_type: string | null }>();
}

export async function getMatchLineups(db: D1Database, matchId: string) {
  const lineups = await db.prepare('SELECT * FROM lineups WHERE match_id = ?').bind(matchId).all();
  const rows = lineups.results ?? [];
  const enriched = [];
  for (const lineup of rows) {
    const lp = await db
      .prepare(
        `SELECT lp.*, p.name AS player_name
         FROM lineup_players lp
         JOIN players p ON p.id = lp.player_id
         WHERE lp.lineup_id = ?
         ORDER BY lp.is_starter DESC, lp.shirt_number ASC, p.name ASC`,
      )
      .bind((lineup as { id: string }).id)
      .all();
    enriched.push({ ...lineup, players: lp.results ?? [] });
  }
  return enriched;
}
