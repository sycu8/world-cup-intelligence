import type { AppEnv } from '../env';
import { parseEnv } from '../env';
import { resolveMatchRef } from './matchRef';
import { assignFormationCoords } from '../lib/formationLayout';
import { lineupPositionGroup, normalizeLineupPosition } from './lineupDisplay';
import { shouldSyncFifaMatch, syncFifaMatchByRef } from '../ingestion/fifa/fifaLiveSync';

export type PitchMapPlayer = {
  playerId: string;
  name: string;
  shirtNumber: number | null;
  position: string;
  x: number;
  y: number;
  isOnPitch: boolean;
  isStarter: boolean;
  subMinute: number | null;
  subType: 'in' | 'out' | null;
  rating: number | null;
  movement: { dx: number; dy: number; magnitude: number } | null;
};

export type PitchMapSide = {
  teamId: string;
  teamName: string;
  formation: string | null;
  source: string;
  players: PitchMapPlayer[];
  bench: PitchMapPlayer[];
};

export type PitchMapEvent = {
  id: string;
  x: number;
  y: number;
  endX?: number | null;
  endY?: number | null;
  eventType: string;
  teamId: string | null;
  playerId: string | null;
  minute: number | null;
};

export type PitchMapPayload = {
  matchId: string;
  slug: string;
  status: string;
  minute: number | null;
  home: PitchMapSide;
  away: PitchMapSide;
  events: PitchMapEvent[];
  showRatings: boolean;
  updatedAt: string | null;
};

type LineupRow = {
  lineup_id: string;
  team_id: string;
  team_name: string;
  formation: string | null;
  source_type: string | null;
  player_id: string;
  player_name: string;
  shirt_number: number | null;
  position_slot: string | null;
  role: string | null;
  player_position: string | null;
  is_starter: number;
  x: number | null;
  y: number | null;
};

type SubEvent = {
  minute: number | null;
  player_id: string | null;
  related_player_id: string | null;
  team_id: string | null;
};

type StatRow = {
  player_id: string;
  team_id: string;
  minutes_played: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  xg: number;
  passes: number;
  pass_accuracy: number;
  yellow_cards: number;
  red_cards: number;
};

type MovementRow = {
  player_id: string;
  team_id: string;
  x: number;
  y: number;
  end_x: number | null;
  end_y: number | null;
};

export function computePlayerRating(stat: StatRow): number {
  let score =
    6 +
    stat.goals * 1.15 +
    stat.assists * 0.75 +
    stat.xg * 1.8 +
    stat.shots_on_target * 0.12 +
    ((stat.pass_accuracy ?? 0) - 75) * 0.015 +
    Math.min(stat.passes, 80) * 0.004;
  score -= stat.yellow_cards * 0.35;
  score -= stat.red_cards * 2;
  return Math.round(Math.max(4, Math.min(10, score)) * 10) / 10;
}

export function applySubstitutions(
  starters: Set<string>,
  onPitch: Set<string>,
  subs: SubEvent[],
  minute: number | null,
): Map<string, { subMinute: number; subType: 'in' | 'out' }> {
  const marks = new Map<string, { subMinute: number; subType: 'in' | 'out' }>();
  const cutoff = minute ?? 999;

  for (const s of subs) {
    if (s.minute == null || s.minute > cutoff) continue;
    const min = s.minute;
    if (s.related_player_id) {
      onPitch.delete(s.related_player_id);
      marks.set(s.related_player_id, { subMinute: min, subType: 'out' });
    }
    if (s.player_id) {
      onPitch.add(s.player_id);
      marks.set(s.player_id, { subMinute: min, subType: 'in' });
    }
  }

  return marks;
}

export function aggregateMovement(rows: MovementRow[]): Map<string, { dx: number; dy: number; magnitude: number }> {
  const sums = new Map<string, { dx: number; dy: number; n: number }>();
  for (const r of rows) {
    if (r.end_x == null || r.end_y == null) continue;
    const dx = r.end_x - r.x;
    const dy = r.end_y - r.y;
    const prev = sums.get(r.player_id) ?? { dx: 0, dy: 0, n: 0 };
    prev.dx += dx;
    prev.dy += dy;
    prev.n += 1;
    sums.set(r.player_id, prev);
  }

  const out = new Map<string, { dx: number; dy: number; magnitude: number }>();
  for (const [id, s] of sums) {
    if (s.n === 0) continue;
    const dx = s.dx / s.n;
    const dy = s.dy / s.n;
    out.set(id, { dx, dy, magnitude: Math.sqrt(dx * dx + dy * dy) });
  }
  return out;
}

async function loadLineupRows(env: AppEnv, matchId: string): Promise<LineupRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT l.id AS lineup_id, l.team_id, t.name AS team_name, l.formation, l.source_type,
            lp.player_id, p.name AS player_name, lp.shirt_number, lp.position_slot, lp.role,
            p.position AS player_position, lp.is_starter, lp.x, lp.y
     FROM lineups l
     JOIN teams t ON t.id = l.team_id
     JOIN lineup_players lp ON lp.lineup_id = l.id
     JOIN players p ON p.id = lp.player_id
     WHERE l.match_id = ?
     ORDER BY l.team_id, lp.is_starter DESC, lp.shirt_number ASC`,
  )
    .bind(matchId)
    .all<LineupRow>();
  return results ?? [];
}

function buildSide(
  teamId: string,
  teamName: string,
  rows: LineupRow[],
  side: 'home' | 'away',
  subMarks: Map<string, { subMinute: number; subType: 'in' | 'out' }>,
  onPitch: Set<string>,
  ratings: Map<string, number>,
  movement: Map<string, { dx: number; dy: number; magnitude: number }>,
  showRatings: boolean,
): PitchMapSide {
  const formation = rows[0]?.formation ?? null;
  const source = rows[0]?.source_type ?? 'unknown';

  const formationInputs = rows
    .filter((r) => r.is_starter === 1 || onPitch.has(r.player_id))
    .map((r) => ({
      playerId: r.player_id,
      position: normalizeLineupPosition(r.position_slot, r.role, r.player_position),
      positionGroup: lineupPositionGroup(
        normalizeLineupPosition(r.position_slot, r.role, r.player_position),
      ),
    }));
  const computed = assignFormationCoords(formation, formationInputs, side);

  const toPlayer = (r: LineupRow, isStarter: boolean): PitchMapPlayer => {
    const position = normalizeLineupPosition(r.position_slot, r.role, r.player_position);
    const stored =
      r.x != null && r.y != null
        ? { x: side === 'away' ? 1 - r.x : r.x, y: r.y }
        : computed.get(r.player_id);
    const coord = stored ?? { x: side === 'home' ? 0.25 : 0.75, y: 0.5 };
    const sub = subMarks.get(r.player_id);
    const playing = onPitch.has(r.player_id);
    return {
      playerId: r.player_id,
      name: r.player_name,
      shirtNumber: r.shirt_number,
      position,
      x: coord.x,
      y: coord.y,
      isOnPitch: playing,
      isStarter,
      subMinute: sub?.subMinute ?? null,
      subType: sub?.subType ?? null,
      rating: showRatings ? ratings.get(r.player_id) ?? null : null,
      movement: playing ? movement.get(r.player_id) ?? null : null,
    };
  };

  const pitchPlayers = rows.map((r) => toPlayer(r, r.is_starter === 1)).filter((p) => p.isOnPitch);
  const bench = rows.map((r) => toPlayer(r, r.is_starter === 1)).filter((p) => !p.isOnPitch);

  return {
    teamId,
    teamName,
    formation,
    source,
    players: pitchPlayers,
    bench,
  };
}

export type GetPitchMapOptions = {
  /** Cloudflare waitUntil — FIFA score/lineup sync runs in background instead of blocking. */
  waitUntil?: (promise: Promise<unknown>) => void;
};

export async function getPitchMapPayload(
  env: AppEnv,
  ref: string,
  opts?: GetPitchMapOptions,
): Promise<PitchMapPayload | null> {
  const resolved = await resolveMatchRef(env.DB, ref);
  if (!resolved) return null;

  const matchId = resolved.id;
  const cfg = parseEnv(env);
  if ((cfg.fifaLiveEnabled || !cfg.mockSources) && (await shouldSyncFifaMatch(env, matchId, resolved.status))) {
    const work = syncFifaMatchByRef(env, matchId).catch(() => undefined);
    if (opts?.waitUntil) {
      opts.waitUntil(work);
    } else {
      await work;
    }
  }

  const lineupRows = await loadLineupRows(env, matchId);
  if (lineupRows.length === 0) return null;

  const minute = resolved.minute ?? null;
  const showRatings = (minute ?? 0) >= 45 || resolved.status === 'completed';

  const [subEvents, statRows, movementRows, eventRows] = await Promise.all([
    env.DB.prepare(
      `SELECT minute, player_id, related_player_id, team_id FROM match_events
       WHERE match_id = ? AND event_type = 'substitution' ORDER BY minute ASC`,
    )
      .bind(matchId)
      .all<SubEvent>(),
    env.DB.prepare(
      `SELECT player_id, team_id, minutes_played, goals, assists, shots, shots_on_target, xg, passes, pass_accuracy, yellow_cards, red_cards
       FROM player_match_stats WHERE match_id = ?`,
    )
      .bind(matchId)
      .all<StatRow>(),
    env.DB.prepare(
      `SELECT player_id, team_id, x, y, end_x, end_y FROM match_events
       WHERE match_id = ? AND player_id IS NOT NULL AND x IS NOT NULL AND y IS NOT NULL`,
    )
      .bind(matchId)
      .all<MovementRow>(),
    env.DB.prepare(
      `SELECT id, x, y, end_x, end_y, event_type, team_id, player_id, minute FROM match_events
       WHERE match_id = ? AND x IS NOT NULL AND y IS NOT NULL ORDER BY minute ASC`,
    )
      .bind(matchId)
      .all<
        PitchMapEvent & { event_type: string; end_x: number | null; end_y: number | null }
      >(),
  ]);

  const subs = subEvents.results ?? [];
  const ratings = new Map<string, number>();
  for (const s of statRows.results ?? []) {
    if ((s.minutes_played ?? 0) > 0) ratings.set(s.player_id, computePlayerRating(s));
  }
  const movement = aggregateMovement(movementRows.results ?? []);

  const homeRows = lineupRows.filter((r) => r.team_id === resolved.home_team_id);
  const awayRows = lineupRows.filter((r) => r.team_id === resolved.away_team_id);

  const homeStarters = new Set(homeRows.filter((r) => r.is_starter === 1).map((r) => r.player_id));
  const awayStarters = new Set(awayRows.filter((r) => r.is_starter === 1).map((r) => r.player_id));
  const homeOnPitchFinal = new Set(homeStarters);
  const awayOnPitchFinal = new Set(awayStarters);

  for (const s of subs.filter((s) => s.team_id === resolved.home_team_id)) {
    applySubstitutions(homeStarters, homeOnPitchFinal, [s], minute);
  }
  for (const s of subs.filter((s) => s.team_id === resolved.away_team_id)) {
    applySubstitutions(awayStarters, awayOnPitchFinal, [s], minute);
  }

  const homeSubMarks = applySubstitutions(
    homeStarters,
    new Set(homeOnPitchFinal),
    subs.filter((s) => s.team_id === resolved.home_team_id),
    minute,
  );
  const awaySubMarks = applySubstitutions(
    awayStarters,
    new Set(awayOnPitchFinal),
    subs.filter((s) => s.team_id === resolved.away_team_id),
    minute,
  );

  const homeTeam = await env.DB.prepare(`SELECT name FROM teams WHERE id = ?`)
    .bind(resolved.home_team_id)
    .first<{ name: string }>();
  const awayTeam = await env.DB.prepare(`SELECT name FROM teams WHERE id = ?`)
    .bind(resolved.away_team_id)
    .first<{ name: string }>();

  const events: PitchMapEvent[] = (eventRows.results ?? []).map((e) => ({
    id: e.id,
    x: e.x,
    y: e.y,
    endX: e.end_x,
    endY: e.end_y,
    eventType: e.event_type,
    teamId: e.team_id,
    playerId: e.player_id,
    minute: e.minute,
  }));

  return {
    matchId,
    slug: resolved.slug ?? matchId,
    status: resolved.status,
    minute,
    home: buildSide(
      resolved.home_team_id,
      homeTeam?.name ?? 'Home',
      homeRows,
      'home',
      homeSubMarks,
      homeOnPitchFinal,
      ratings,
      movement,
      showRatings,
    ),
    away: buildSide(
      resolved.away_team_id,
      awayTeam?.name ?? 'Away',
      awayRows,
      'away',
      awaySubMarks,
      awayOnPitchFinal,
      ratings,
      movement,
      showRatings,
    ),
    events,
    showRatings,
    updatedAt: resolved.updated_at ?? null,
  };
}
