import type { LineupFeatures } from '../models/probability/types';

type LineupPlayerRow = {
  is_starter: number;
  position_slot: string | null;
  role: string | null;
  listed_position?: string | null;
  position?: string | null;
};

function roleFromSlot(slot: string | null): string {
  const s = (slot ?? '').toUpperCase();
  if (s.includes('GK') || s === '1') return 'GK';
  if (s.includes('CB') || s.includes('D')) return 'DEF';
  if (s.includes('M') || s.includes('DM') || s.includes('CM')) return 'MID';
  if (s.includes('F') || s.includes('W') || s.includes('ST')) return 'FWD';
  return 'UNK';
}

export function buildLineupFeaturesFromPlayers(
  formation: string,
  players: LineupPlayerRow[],
  isOfficial: boolean,
): LineupFeatures | undefined {
  const starters = players.filter((p) => p.is_starter === 1);
  if (starters.length < 7) return undefined;

  const roles = starters.map((p) =>
    roleFromSlot(p.position_slot ?? p.role ?? p.listed_position ?? p.position ?? null),
  );
  const missing: string[] = [];
  if (!roles.includes('GK')) missing.push('GK');
  if (roles.filter((r) => r === 'DEF').length < 2) missing.push('DEF');
  if (roles.filter((r) => r === 'MID').length < 2) missing.push('MID');
  if (roles.filter((r) => r === 'FWD').length < 1) missing.push('FWD');

  const completeness = Math.min(1, starters.length / 11);
  const strengthModifier = isOfficial
    ? 0.96 + completeness * 0.04
    : 0.9 + completeness * 0.06;

  return {
    formation,
    strengthModifier,
    missingKeyRoles: missing,
  };
}
