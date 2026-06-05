import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import * as lineupsRepo from '../db/repositories/lineupsRepo';
import { scheduleRecomputeAfterDataChange } from './bulkRecomputeRunner';
import { recomputeMatchProbability } from './recomputeMatch';
import { logInfo } from '../utils/logger';

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

type SquadPlayerRow = {
  player_id: string;
  shirt_number: number | null;
  listed_position: string | null;
  position: string | null;
  name: string;
};

type OfficialSquadRow = {
  id: string;
  team_id: string;
  source_id: string | null;
  confidence: number;
  announced_at: string | null;
};

export type OfficialLineupPlayerInput = {
  playerId: string;
  isStarter?: boolean;
  positionSlot?: string | null;
  shirtNumber?: number | null;
};

export type SetOfficialMatchLineupInput = {
  matchId: string;
  teamId: string;
  formation: string;
  players: OfficialLineupPlayerInput[];
  sourceId?: string | null;
  confidence?: number;
};

async function getOfficialSquadForTeam(
  db: D1Database,
  teamId: string,
): Promise<{ squad: OfficialSquadRow; players: SquadPlayerRow[] } | null> {
  const squad = await db
    .prepare(
      `SELECT id, team_id, source_id, confidence, announced_at FROM squads
       WHERE team_id = ? AND tournament_id = ? AND is_official = 1
       ORDER BY announced_at DESC, confidence DESC LIMIT 1`,
    )
    .bind(teamId, WC2026_TOURNAMENT_ID)
    .first<OfficialSquadRow>();

  if (!squad) return null;

  const { results } = await db
    .prepare(
      `SELECT sp.player_id, sp.shirt_number, sp.listed_position, p.position, p.name
       FROM squad_players sp
       JOIN players p ON p.id = sp.player_id
       WHERE sp.squad_id = ? AND sp.status = 'available'
       ORDER BY sp.shirt_number ASC, p.name ASC`,
    )
    .bind(squad.id)
    .all<SquadPlayerRow>();

  const players = results ?? [];
  if (players.length < 7) return null;

  return { squad, players };
}

function pickStartingEleven(players: SquadPlayerRow[], matchId: string, teamId: string): SquadPlayerRow[] {
  if (players.length <= 11) return players;
  const offset = hashString(`${matchId}:${teamId}`) % Math.max(1, players.length - 10);
  return players.slice(offset, offset + 11);
}

function shouldReplaceLineup(
  existing: { is_official: number; source_type: string | null } | null,
  sourceType: string,
): boolean {
  if (!existing) return true;
  if (existing.source_type === 'match_official') return sourceType === 'match_official';
  if (sourceType === 'match_official') return true;
  return existing.source_type !== 'squad_official' || sourceType === 'squad_official';
}

export async function applyOfficialLineupToMatch(
  env: AppEnv,
  input: SetOfficialMatchLineupInput,
): Promise<{ lineupId: string; updated: boolean }> {
  const existing = await lineupsRepo.getMatchLineupRow(env.DB, input.matchId, input.teamId);
  if (!shouldReplaceLineup(existing, 'match_official')) {
    return { lineupId: existing!.id, updated: false };
  }

  const starters = input.players.filter((p) => p.isStarter !== false).slice(0, 11);
  const lineupId = await lineupsRepo.upsertMatchLineup(env.DB, {
    matchId: input.matchId,
    teamId: input.teamId,
    formation: input.formation,
    sourceId: input.sourceId ?? 'src-admin',
    sourceType: 'match_official',
    isOfficial: true,
    confidence: input.confidence ?? 0.95,
    players: starters.map((p, i) => ({
      playerId: p.playerId,
      isStarter: true,
      positionSlot: p.positionSlot ?? String(i + 1),
      shirtNumber: p.shirtNumber ?? null,
    })),
  });

  return { lineupId, updated: true };
}

export async function syncOfficialSquadToMatch(
  env: AppEnv,
  matchId: string,
  teamId: string,
): Promise<boolean> {
  const squadData = await getOfficialSquadForTeam(env.DB, teamId);
  if (!squadData) return false;

  const existing = await lineupsRepo.getMatchLineupRow(env.DB, matchId, teamId);
  if (!shouldReplaceLineup(existing, 'squad_official')) return false;

  const starters = pickStartingEleven(squadData.players, matchId, teamId);
  const formation =
    inferFormationFromPlayers(starters) ||
    FORMATIONS[hashString(`${matchId}:${teamId}`) % FORMATIONS.length];

  await lineupsRepo.upsertMatchLineup(env.DB, {
    matchId,
    teamId,
    formation,
    sourceId: squadData.squad.source_id,
    sourceType: 'squad_official',
    isOfficial: true,
    confidence: squadData.squad.confidence,
    publishedAt: squadData.squad.announced_at,
    players: starters.map((p, i) => ({
      playerId: p.player_id,
      isStarter: true,
      positionSlot: p.listed_position ?? p.position ?? String(i + 1),
      shirtNumber: p.shirt_number,
    })),
  });

  return true;
}

export type SyncOfficialLineupsResult = {
  matchesChecked: number;
  lineupsUpdated: number;
  matchIds: string[];
};

/**
 * Propagate official squads and pending match lineups to upcoming WC 2026 fixtures.
 * Skips finished matches and preserves confirmed match-day XIs (source_type = match_official).
 */
export async function syncOfficialLineupsToMatches(
  env: AppEnv,
  options: { hoursAhead?: number; recompute?: boolean } = {},
): Promise<SyncOfficialLineupsResult> {
  const hoursAhead = options.hoursAhead ?? 24 * 14;
  const { results } = await env.DB.prepare(
    `SELECT id, home_team_id, away_team_id FROM matches
     WHERE tournament_id = ?
       AND status IN ('scheduled', 'live')
       AND kickoff_utc <= datetime('now', ? || ' hours')
       AND kickoff_utc >= datetime('now', '-6 hours')
     ORDER BY kickoff_utc ASC`,
  )
    .bind(WC2026_TOURNAMENT_ID, `+${hoursAhead}`)
    .all<{ id: string; home_team_id: string; away_team_id: string }>();

  const matches = results ?? [];
  const updatedMatchIds = new Set<string>();
  let lineupsUpdated = 0;

  for (const match of matches) {
    for (const teamId of [match.home_team_id, match.away_team_id]) {
      const changed = await syncOfficialSquadToMatch(env, match.id, teamId);
      if (changed) {
        lineupsUpdated += 1;
        updatedMatchIds.add(match.id);
      }
    }
  }

  const matchIds = [...updatedMatchIds];
  if (matchIds.length && options.recompute !== false) {
    if (matchIds.length >= 12) {
      await scheduleRecomputeAfterDataChange(env, `lineup-official-sync:${matchIds.length}`, {
        queue: true,
      });
    } else {
      for (const matchId of matchIds) {
        await recomputeMatchProbability(env, matchId);
      }
    }
  }

  logInfo('official lineup sync done', {
    matchesChecked: matches.length,
    lineupsUpdated,
    matchesUpdated: matchIds.length,
  });

  return { matchesChecked: matches.length, lineupsUpdated, matchIds };
}
