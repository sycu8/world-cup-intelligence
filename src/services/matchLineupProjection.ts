import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';

const FORMATIONS = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '5-3-2'] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function inferFormationFromPlayers(
  players: { listed_position?: string | null; position?: string | null }[],
): string {
  const pos = players.map((p) => (p.listed_position ?? p.position ?? '').toUpperCase());
  const defs = pos.filter((p) => p.includes('D') || p === 'GK').length;
  const mids = pos.filter((p) => p.includes('M')).length;
  const fwds = pos.filter((p) => p.includes('F') || p.includes('W')).length;
  if (defs >= 4 && mids >= 3 && fwds >= 2) return '4-3-3';
  if (defs >= 4 && mids >= 2 && fwds >= 2) return '4-2-3-1';
  if (defs >= 3 && mids >= 4) return '3-5-2';
  return '4-4-2';
}

function syntheticRoster(teamId: string, teamName: string, matchId: string): string[] {
  const slots = ['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'CM', 'CM', 'WG', 'WG', 'ST'];
  const base = hashString(`${matchId}:${teamId}`);
  return slots.map((slot, i) => {
    const n = 1 + ((base + i * 7) % 2);
    const short = teamName.length > 18 ? teamName.slice(0, 12) + '…' : teamName;
    return `${short} · ${slot}${n}`;
  });
}

export type ProjectedLineup = {
  formation: string;
  players: string[];
  source: 'official' | 'squad' | 'projected' | 'unknown';
};

export async function getProjectedLineupForMatch(
  env: AppEnv,
  matchId: string,
  teamId: string,
  teamName: string,
): Promise<ProjectedLineup> {
  const lineupRow = await env.DB.prepare(
    `SELECT l.id, l.formation, l.is_official FROM lineups l
     WHERE l.match_id = ? AND l.team_id = ?`,
  )
    .bind(matchId, teamId)
    .first<{ id: string; formation: string; is_official: number }>();

  if (lineupRow) {
    const { results } = await env.DB.prepare(
      `SELECT p.name FROM lineup_players lp
       JOIN players p ON p.id = lp.player_id
       WHERE lp.lineup_id = ? AND lp.is_starter = 1
       ORDER BY lp.position_slot LIMIT 11`,
    )
      .bind(lineupRow.id)
      .all<{ name: string }>();
    const names = (results ?? []).map((r) => r.name);
    if (names.length) {
      return {
        formation: lineupRow.formation,
        players: names,
        source: lineupRow.is_official ? 'official' : 'projected',
      };
    }
  }

  const squad = await env.DB.prepare(
    `SELECT p.name, p.position, sp.listed_position
     FROM squad_players sp
     JOIN squads s ON s.id = sp.squad_id
     JOIN players p ON p.id = sp.player_id
     WHERE s.team_id = ? AND s.tournament_id = ?
     ORDER BY sp.shirt_number
     LIMIT 11`,
  )
    .bind(teamId, WC2026_TOURNAMENT_ID)
    .all<{ name: string; position: string | null; listed_position: string | null }>();

  const squadList = squad.results;
  if (squadList && squadList.length >= 7) {
    const h = hashString(`${matchId}:${teamId}`);
    const formation = FORMATIONS[h % FORMATIONS.length];
    return {
      formation: inferFormationFromPlayers(squadList),
      players: squadList.map((r) => r.name),
      source: 'squad',
    };
  }

  const club = await env.DB.prepare(
    `SELECT name, position FROM players WHERE primary_team_id = ? ORDER BY name LIMIT 11`,
  )
    .bind(teamId)
    .all<{ name: string; position: string | null }>();

  const clubList = club.results;
  if (clubList && clubList.length >= 5) {
    const h = hashString(`${matchId}:${teamId}`);
    return {
      formation: FORMATIONS[h % FORMATIONS.length],
      players: clubList.map((r) => r.name),
      source: 'projected',
    };
  }

  const h = hashString(`${matchId}:${teamId}`);
  return {
    formation: FORMATIONS[h % FORMATIONS.length],
    players: syntheticRoster(teamId, teamName, matchId),
    source: 'projected',
  };
}
