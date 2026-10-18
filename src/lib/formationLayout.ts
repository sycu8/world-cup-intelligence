import { lineupPositionGroup, type LineupPositionGroup } from '../services/lineupDisplay';

export type FormationPlayerInput = {
  playerId: string;
  position: string;
  positionGroup?: LineupPositionGroup;
};

export type PitchCoord = { x: number; y: number };

const DEPTH: Record<LineupPositionGroup, number> = {
  GK: 0.08,
  DEF: 0.24,
  MID: 0.36,
  FWD: 0.44,
};

function parseFormationLines(formation: string | null): Record<LineupPositionGroup, number> {
  const parts = (formation ?? '4-4-2')
    .split('-')
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));
  const out: Record<LineupPositionGroup, number> = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
  if (parts.length === 3) {
    out.DEF = parts[0];
    out.MID = parts[1];
    out.FWD = parts[2];
  } else if (parts.length === 4) {
    out.DEF = parts[0];
    out.MID = parts[1] + parts[2];
    out.FWD = parts[3];
  }
  return out;
}

function lateralBias(position: string): number | null {
  const p = position.toUpperCase();
  if (/^(LB|LWB|LW|LM)$/.test(p)) return 0.14;
  if (/^(RB|RWB|RW|RM)$/.test(p)) return 0.86;
  if (/^(LCB|LC)$/.test(p)) return 0.28;
  if (/^(RCB|RC)$/.test(p)) return 0.72;
  if (/^(ST|CF|SS)$/.test(p)) return 0.5;
  if (/^(AM|DM|CM)$/.test(p)) return 0.5;
  if (p === 'GK') return 0.5;
  return null;
}

function spreadY(index: number, count: number): number {
  if (count <= 1) return 0.5;
  const margin = 0.12;
  const span = 1 - margin * 2;
  return margin + (index / (count - 1)) * span;
}

/** @internal exported for unit tests */
export { spreadY };

/** Normalized pitch coords: home attacks right (x↑), y top→bottom. */
export function assignFormationCoords(
  formation: string | null,
  players: FormationPlayerInput[],
  side: 'home' | 'away',
): Map<string, PitchCoord> {
  const lines = parseFormationLines(formation);
  const grouped: Record<LineupPositionGroup, FormationPlayerInput[]> = {
    GK: [],
    DEF: [],
    MID: [],
    FWD: [],
  };

  for (const p of players) {
    const group = p.positionGroup ?? lineupPositionGroup(p.position);
    grouped[group].push(p);
  }

  const coords = new Map<string, PitchCoord>();

  for (const group of ['GK', 'DEF', 'MID', 'FWD'] as LineupPositionGroup[]) {
    const line = grouped[group];
    const expected = lines[group];
    line.sort((a, b) => {
      const la = lateralBias(a.position) ?? 0.5;
      const lb = lateralBias(b.position) ?? 0.5;
      if (la !== 0.5 || lb !== 0.5) return la - lb;
      return a.position.localeCompare(b.position);
    });

    line.forEach((p, i) => {
      const bias = lateralBias(p.position);
      const y = bias ?? spreadY(i, Math.max(line.length, expected));
      let x = DEPTH[group];
      if (side === 'away') x = 1 - x;
      coords.set(p.playerId, { x, y });
    });
  }

  return coords;
}

export function mirrorCoord(coord: PitchCoord, side: 'home' | 'away'): PitchCoord {
  return side === 'away' ? { x: 1 - coord.x, y: coord.y } : coord;
}
