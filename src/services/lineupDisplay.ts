import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { syncOfficialSquadToMatch } from './officialLineupSync';
import { syncFifaMatchLineupsByRef } from '../ingestion/fifa/fifaLineupSync';
import * as lineupsRepo from '../db/repositories/lineupsRepo';

export type LineupPositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

export type LineupPlayerEntry = {
  shirtNumber: number | null;
  name: string;
  position: string;
  positionGroup: LineupPositionGroup;
  isStarter: boolean;
};

export type LineupUiSource = 'official' | 'squad' | 'projected' | 'unknown';

export type LineupDisplay = {
  formation: string | null;
  /** Starters only — backward compatible flat list */
  players: Pick<LineupPlayerEntry, 'shirtNumber' | 'name' | 'position'>[];
  starters: LineupPlayerEntry[];
  substitutes: LineupPlayerEntry[];
  grouped: Record<LineupPositionGroup, LineupPlayerEntry[]>;
  displayLines: string[];
  source: LineupUiSource;
  sourceType: string | null;
  hasAccurateLineup: boolean;
  confidence: number | null;
};

const SHORT_POSITION = /^(GK|CB|LB|RB|FB|WB|LWB|RWB|DM|CM|AM|WG|LW|RW|ST|CF|SS|LM|RM)$/i;

const FORMATIONS = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '5-3-2'] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

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

export function lineupPositionGroup(position: string): LineupPositionGroup {
  const p = position.toUpperCase();
  if (p === 'GK' || p.includes('GOAL')) return 'GK';
  if (/^(CB|LB|RB|FB|WB|LWB|RWB|DF|DEF)/.test(p) || p === 'D') return 'DEF';
  if (/^(DM|CM|AM|LM|RM|MF|MID)/.test(p) || p === 'M') return 'MID';
  if (/^(ST|CF|SS|WG|LW|RW|FW|FWD)/.test(p) || p === 'F') return 'FWD';
  return 'MID';
}

export function formatLineupPlayerLine(entry: {
  shirtNumber: number | null;
  name: string;
  position: string;
}): string {
  const num = entry.shirtNumber != null ? `(${entry.shirtNumber})` : '(—)';
  return `${num} - ${entry.name} - ${entry.position}`;
}

function mapUiSource(sourceType: string | null, isOfficial: boolean): LineupUiSource {
  if (sourceType === 'match_official') return 'official';
  if (sourceType === 'squad_official') return 'squad';
  if (sourceType === 'projected') return 'projected';
  if (isOfficial) return 'official';
  return 'unknown';
}

const GROUP_ORDER: LineupPositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];

function sortLineupStarters(starters: LineupPlayerEntry[]): LineupPlayerEntry[] {
  return [...starters].sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.positionGroup);
    const gb = GROUP_ORDER.indexOf(b.positionGroup);
    if (ga !== gb) return ga - gb;
    return (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999);
  });
}

function groupPlayers(entries: LineupPlayerEntry[]): Record<LineupPositionGroup, LineupPlayerEntry[]> {
  const grouped: Record<LineupPositionGroup, LineupPlayerEntry[]> = {
    GK: [],
    DEF: [],
    MID: [],
    FWD: [],
  };
  for (const e of entries) {
    grouped[e.positionGroup].push(e);
  }
  for (const key of GROUP_ORDER) {
    grouped[key].sort((a, b) => (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999));
  }
  return grouped;
}

function buildDisplayFromEntries(
  formation: string | null,
  entries: LineupPlayerEntry[],
  source: LineupUiSource,
  sourceType: string | null,
  hasAccurateLineup: boolean,
  confidence: number | null,
): LineupDisplay {
  const starters = sortLineupStarters(entries.filter((e) => e.isStarter));
  const substitutes = entries.filter((e) => !e.isStarter);
  return {
    formation,
    players: starters.map(({ shirtNumber, name, position }) => ({ shirtNumber, name, position })),
    starters,
    substitutes,
    grouped: groupPlayers(starters),
    displayLines: starters.map(formatLineupPlayerLine),
    source,
    sourceType,
    hasAccurateLineup,
    confidence,
  };
}

const STARTER_SLOTS: { shirt: number; pos: string }[] = [
  { shirt: 1, pos: 'GK' },
  { shirt: 2, pos: 'RB' },
  { shirt: 3, pos: 'CB' },
  { shirt: 4, pos: 'CB' },
  { shirt: 5, pos: 'LB' },
  { shirt: 6, pos: 'DM' },
  { shirt: 7, pos: 'CM' },
  { shirt: 8, pos: 'CM' },
  { shirt: 10, pos: 'AM' },
  { shirt: 11, pos: 'LW' },
  { shirt: 14, pos: 'RW' },
  { shirt: 9, pos: 'ST' },
];

function inferFormationFromPositions(positions: string[]): string {
  const pos = positions.map((p) => p.toUpperCase());
  const defs = pos.filter((p) => p.includes('B') || p === 'GK' || p.includes('WB')).length;
  const mids = pos.filter((p) => p.includes('M') || p === 'DM' || p === 'AM').length;
  const fwds = pos.filter((p) => p.includes('W') || p === 'ST' || p === 'CF').length;
  if (defs >= 4 && mids >= 3 && fwds >= 2) return '4-3-3';
  if (defs >= 4 && mids >= 2 && fwds >= 2) return '4-2-3-1';
  if (defs >= 3 && mids >= 4) return '3-5-2';
  return '4-4-2';
}

function buildProjectedEntries(teamName: string, matchId: string, teamId: string): LineupPlayerEntry[] {
  const base = hashString(`${matchId}:${teamId}`);
  const formation = FORMATIONS[base % FORMATIONS.length];
  void formation;
  return STARTER_SLOTS.map((slot, i) => {
    const n = 1 + ((base + i * 7) % 3);
    const short = teamName.length > 14 ? teamName.slice(0, 10) + '…' : teamName;
    const position = slot.pos;
    return {
      shirtNumber: slot.shirt,
      name: `${short} · ${position}${n}`,
      position,
      positionGroup: lineupPositionGroup(position),
      isStarter: true,
    };
  });
}

async function loadLineupFromDb(
  env: AppEnv,
  matchId: string,
  teamId: string,
): Promise<LineupDisplay | null> {
  const lineupRow = await env.DB.prepare(
    `SELECT l.id, l.formation, l.is_official, l.source_type, l.confidence
     FROM lineups l WHERE l.match_id = ? AND l.team_id = ?`,
  )
    .bind(matchId, teamId)
    .first<{
      id: string;
      formation: string;
      is_official: number;
      source_type: string | null;
      confidence: number | null;
    }>();

  if (!lineupRow) return null;

  const { results } = await env.DB.prepare(
    `SELECT p.name, lp.shirt_number, lp.position_slot, lp.role, p.position, lp.is_starter
     FROM lineup_players lp
     JOIN players p ON p.id = lp.player_id
     WHERE lp.lineup_id = ?
     ORDER BY lp.is_starter DESC, lp.shirt_number ASC, lp.position_slot ASC, p.name ASC`,
  )
    .bind(lineupRow.id)
    .all<{
      name: string;
      shirt_number: number | null;
      position_slot: string | null;
      role: string | null;
      position: string | null;
      is_starter: number;
    }>();

  const rows = results ?? [];
  if (rows.length === 0) return null;

  const entries: LineupPlayerEntry[] = rows.map((r) => {
    const position = normalizeLineupPosition(r.position_slot, r.role, r.position);
    return {
      shirtNumber: r.shirt_number,
      name: r.name,
      position,
      positionGroup: lineupPositionGroup(position),
      isStarter: r.is_starter === 1,
    };
  });

  const starters = entries.filter((e) => e.isStarter);
  if (starters.length < 7) return null;

  const uiSource = mapUiSource(lineupRow.source_type, lineupRow.is_official === 1);
  const accurate =
    lineupRow.source_type === 'match_official' ||
    lineupRow.source_type === 'squad_official' ||
    (lineupRow.is_official === 1 && starters.length >= 11);

  return buildDisplayFromEntries(
    lineupRow.formation,
    entries,
    uiSource,
    lineupRow.source_type,
    accurate,
    lineupRow.confidence,
  );
}

async function loadSquadFallback(
  env: AppEnv,
  matchId: string,
  teamId: string,
): Promise<LineupDisplay | null> {
  const squad = await env.DB.prepare(
    `SELECT id, confidence FROM squads
     WHERE team_id = ? AND tournament_id = ? AND is_official = 1
     ORDER BY announced_at DESC, confidence DESC LIMIT 1`,
  )
    .bind(teamId, WC2026_TOURNAMENT_ID)
    .first<{ id: string; confidence: number }>();

  if (!squad) return null;

  const { results } = await env.DB.prepare(
    `SELECT p.name, sp.shirt_number, sp.listed_position, p.position
     FROM squad_players sp
     JOIN players p ON p.id = sp.player_id
     WHERE sp.squad_id = ? AND sp.status = 'available'
     ORDER BY sp.shirt_number ASC, p.name ASC`,
  )
    .bind(squad.id)
    .all<{
      name: string;
      shirt_number: number | null;
      listed_position: string | null;
      position: string | null;
    }>();

  const rows = results ?? [];
  if (rows.length < 7) return null;

  const isGoalkeeper = (r: (typeof rows)[0]) => {
    const pos = normalizeLineupPosition(r.listed_position, null, r.position);
    return lineupPositionGroup(pos) === 'GK';
  };

  const gk = rows.find(isGoalkeeper) ?? rows[0];
  const outfield = rows.filter((r) => r !== gk);
  const offset = hashString(`${matchId}:${teamId}`) % Math.max(1, outfield.length - 10);
  const pickedOutfield = outfield.slice(offset, offset + 10);
  const picked = [gk, ...pickedOutfield];
  const bench = rows.filter((r) => !picked.includes(r)).slice(0, 5);

  const toEntry = (r: (typeof rows)[0], isStarter: boolean): LineupPlayerEntry => {
    const position = normalizeLineupPosition(r.listed_position, null, r.position);
    return {
      shirtNumber: r.shirt_number,
      name: r.name,
      position,
      positionGroup: lineupPositionGroup(position),
      isStarter,
    };
  };

  const entries = [...picked.map((r) => toEntry(r, true)), ...bench.map((r) => toEntry(r, false))];
  const positions = picked.map((r) => normalizeLineupPosition(r.listed_position, null, r.position));

  return buildDisplayFromEntries(
    inferFormationFromPositions(positions),
    entries,
    'squad',
    'squad_roster',
    false,
    squad.confidence,
  );
}

async function loadClubFallback(env: AppEnv, teamId: string): Promise<LineupDisplay | null> {
  const { results } = await env.DB.prepare(
    `SELECT name, position FROM players WHERE primary_team_id = ? ORDER BY name LIMIT 16`,
  )
    .bind(teamId)
    .all<{ name: string; position: string | null }>();

  const rows = results ?? [];
  if (rows.length < 5) return null;

  const starters = rows.slice(0, 11).map((r, i) => {
    const position = normalizeLineupPosition(null, null, r.position ?? STARTER_SLOTS[i]?.pos ?? 'CM');
    return {
      shirtNumber: STARTER_SLOTS[i]?.shirt ?? i + 1,
      name: r.name,
      position,
      positionGroup: lineupPositionGroup(position),
      isStarter: true,
    };
  });

  const subs = rows.slice(11, 16).map((r, i) => {
    const position = normalizeLineupPosition(null, null, r.position ?? 'CM');
    return {
      shirtNumber: 12 + i,
      name: r.name,
      position,
      positionGroup: lineupPositionGroup(position),
      isStarter: false,
    };
  });

  return buildDisplayFromEntries(
    inferFormationFromPositions(starters.map((s) => s.position)),
    [...starters, ...subs],
    'projected',
    'club_roster',
    false,
    0.65,
  );
}

const empty: LineupDisplay = {
  formation: null,
  players: [],
  starters: [],
  substitutes: [],
  grouped: { GK: [], DEF: [], MID: [], FWD: [] },
  displayLines: [],
  source: 'unknown',
  sourceType: null,
  hasAccurateLineup: false,
  confidence: null,
};

export type EnsureMatchLineupsOptions = {
  /** Cloudflare waitUntil — FIFA/squad sync runs in background instead of blocking the response. */
  waitUntil?: (promise: Promise<unknown>) => void;
};

async function runEnsureMatchLineups(env: AppEnv, matchId: string): Promise<void> {
  await syncFifaMatchLineupsByRef(env, matchId).catch(() => undefined);

  const match = await env.DB.prepare(
    `SELECT home_team_id, away_team_id FROM matches WHERE id = ?`,
  )
    .bind(matchId)
    .first<{ home_team_id: string; away_team_id: string }>();

  if (!match) return;

  for (const teamId of [match.home_team_id, match.away_team_id]) {
    const row = await lineupsRepo.getMatchLineupRow(env.DB, matchId, teamId);
    if (!row || row.source_type !== 'match_official') {
      await syncOfficialSquadToMatch(env, matchId, teamId);
    }
  }
}

/** Ensure both teams have persisted lineups — FIFA match sheet first, then official squads. */
export async function ensureMatchLineups(
  env: AppEnv,
  matchId: string,
  opts?: EnsureMatchLineupsOptions,
): Promise<void> {
  const work = runEnsureMatchLineups(env, matchId);
  if (opts?.waitUntil) {
    opts.waitUntil(work);
    return;
  }
  await work;
}

export async function getLineupDisplayForMatch(
  env: AppEnv,
  matchId: string,
  teamId: string,
  teamName?: string,
): Promise<LineupDisplay> {
  const fromDb = await loadLineupFromDb(env, matchId, teamId);
  if (fromDb) return fromDb;

  const fromSquad = await loadSquadFallback(env, matchId, teamId);
  if (fromSquad) return fromSquad;

  const fromClub = await loadClubFallback(env, teamId);
  if (fromClub) return fromClub;

  if (teamName) {
    const projected = buildProjectedEntries(teamName, matchId, teamId);
    const formation = FORMATIONS[hashString(`${matchId}:${teamId}`) % FORMATIONS.length];
    return buildDisplayFromEntries(
      formation,
      projected,
      'projected',
      'projected',
      false,
      0.55,
    );
  }

  return empty;
}
