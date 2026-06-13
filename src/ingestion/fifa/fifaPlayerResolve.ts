import { nowIso } from '../../utils/time';
import { fifaLocalizedName } from './parse';
import type { FifaPlayer } from './fifaApiClient';

/** FIFA match sheet Position enum → platform slot label. */
export function mapFifaPlayerPosition(position: number | null | undefined): string {
  switch (position) {
    case 0:
      return 'GK';
    case 1:
      return 'CB';
    case 2:
      return 'CM';
    case 3:
      return 'ST';
    default:
      return 'CM';
  }
}

function buildExternalIds(fifaPlayerId: string): string {
  return JSON.stringify({ fifa: fifaPlayerId });
}

/** Resolve or create a platform player row for a FIFA match-sheet player. */
export async function resolveOrCreateFifaPlayer(
  db: D1Database,
  teamId: string,
  nationality: string | null,
  fifaPlayer: FifaPlayer,
): Promise<string | null> {
  const fifaId = fifaPlayer.IdPlayer;
  if (!fifaId) return null;

  const name =
    fifaLocalizedName(fifaPlayer.PlayerName) || fifaLocalizedName(fifaPlayer.ShortName) || null;
  if (!name) return null;

  const playerId = `p-fifa-${fifaId}`;
  const position = mapFifaPlayerPosition(fifaPlayer.Position);
  const ts = nowIso();
  const externalIds = buildExternalIds(fifaId);

  const existing = await db
    .prepare(`SELECT id FROM players WHERE id = ?`)
    .bind(playerId)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(
        `UPDATE players SET
           name = ?, nationality = COALESCE(?, nationality),
           primary_team_id = ?, position = ?, external_ids_json = ?,
           updated_at = ?
         WHERE id = ?`,
      )
      .bind(name, nationality, teamId, position, externalIds, ts, playerId)
      .run();
    return playerId;
  }

  await db
    .prepare(
      `INSERT INTO players (
         id, external_ids_json, name, nationality, primary_team_id, position,
         role_tags_json, profile_status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, '[]', 'active', ?, ?)`,
    )
    .bind(playerId, externalIds, name, nationality, teamId, position, ts, ts)
    .run();

  return playerId;
}
