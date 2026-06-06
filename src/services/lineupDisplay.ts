import type { AppEnv } from '../env';

export type LineupPlayerEntry = {
  shirtNumber: number | null;
  name: string;
  position: string;
};

export type LineupDisplay = {
  formation: string | null;
  players: LineupPlayerEntry[];
  displayLines: string[];
  source: 'official' | 'unknown';
  hasAccurateLineup: boolean;
};

const SHORT_POSITION = /^(GK|CB|LB|RB|FB|WB|LWB|RWB|DM|CM|AM|WG|LW|RW|ST|CF|SS|LM|RM)$/i;

export function normalizeLineupPosition(
  positionSlot: string | null | undefined,
  role: string | null | undefined,
  playerPosition: string | null | undefined,
): string {
  const raw = (positionSlot ?? role ?? playerPosition ?? '').trim();
  if (!raw) return '—';
  const upper = raw.toUpperCase();
  if (SHORT_POSITION.test(upper)) return upper;
  if (upper.includes('GOAL') || upper === 'G') return 'GK';
  if (upper.includes('DEF') || upper === 'D') return 'CB';
  if (upper.includes('MID') || upper === 'M') return 'CM';
  if (upper.includes('FOR') || upper === 'F') return 'ST';
  if (upper.includes('WING') || upper === 'W') return 'WG';
  return upper.length <= 4 ? upper : upper.slice(0, 3);
}

export function formatLineupPlayerLine(entry: LineupPlayerEntry): string {
  const num = entry.shirtNumber != null ? `(${entry.shirtNumber})` : '(—)';
  return `${num} - ${entry.name} - ${entry.position}`;
}

export async function getLineupDisplayForMatch(
  env: AppEnv,
  matchId: string,
  teamId: string,
): Promise<LineupDisplay> {
  const empty: LineupDisplay = {
    formation: null,
    players: [],
    displayLines: [],
    source: 'unknown',
    hasAccurateLineup: false,
  };

  const lineupRow = await env.DB.prepare(
    `SELECT l.id, l.formation, l.is_official FROM lineups l
     WHERE l.match_id = ? AND l.team_id = ? AND l.is_official = 1`,
  )
    .bind(matchId, teamId)
    .first<{ id: string; formation: string; is_official: number }>();

  if (!lineupRow) return empty;

  const { results } = await env.DB.prepare(
    `SELECT p.name, lp.shirt_number, lp.position_slot, lp.role, p.position
     FROM lineup_players lp
     JOIN players p ON p.id = lp.player_id
     WHERE lp.lineup_id = ? AND lp.is_starter = 1
     ORDER BY lp.shirt_number ASC, lp.position_slot ASC, p.name ASC
     LIMIT 11`,
  )
    .bind(lineupRow.id)
    .all<{
      name: string;
      shirt_number: number | null;
      position_slot: string | null;
      role: string | null;
      position: string | null;
    }>();

  const rows = results ?? [];
  if (rows.length < 7) return empty;

  const players: LineupPlayerEntry[] = rows.map((r) => ({
    shirtNumber: r.shirt_number,
    name: r.name,
    position: normalizeLineupPosition(r.position_slot, r.role, r.position),
  }));

  return {
    formation: lineupRow.formation,
    players,
    displayLines: players.map(formatLineupPlayerLine),
    source: 'official',
    hasAccurateLineup: true,
  };
}
