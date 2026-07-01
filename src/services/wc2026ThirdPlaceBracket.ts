import combinations from '../data/wc2026ThirdPlaceCombinations.json';
import type { GroupStanding } from './tournamentProgression';

/** Group winners that face a third-place qualifier in the Round of 32 (FIFA schedule). */
export const WC2026_WINNER_VS_THIRD_GROUPS = ['A', 'B', 'D', 'E', 'G', 'I', 'K', 'L'] as const;

/** Away slot on each R32 match for the third-place opponent of a group winner. */
export const WC2026_THIRD_PLACE_AWAY_SLOTS: { matchId: string; winnerGroup: string }[] = [
  { matchId: 'm-w26-r32-07', winnerGroup: 'A' },
  { matchId: 'm-w26-r32-13', winnerGroup: 'B' },
  { matchId: 'm-w26-r32-09', winnerGroup: 'D' },
  { matchId: 'm-w26-r32-02', winnerGroup: 'E' },
  { matchId: 'm-w26-r32-10', winnerGroup: 'G' },
  { matchId: 'm-w26-r32-05', winnerGroup: 'I' },
  { matchId: 'm-w26-r32-15', winnerGroup: 'K' },
  { matchId: 'm-w26-r32-08', winnerGroup: 'L' },
];

type CombinationRow = {
  no: number;
  groups: string[];
  assign: Record<string, string>;
};

const combinationByKey = new Map<string, Record<string, string>>();
for (const row of combinations as CombinationRow[]) {
  const key = [...row.groups].sort().join(',');
  combinationByKey.set(key, row.assign);
}

function compareThird(a: GroupStanding & { group: string }, b: GroupStanding & { group: string }): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.teamId.localeCompare(b.teamId);
}

export function rankThirdPlaceCandidates(
  candidates: (GroupStanding & { group: string })[],
): (GroupStanding & { group: string })[] {
  return [...candidates].sort(compareThird);
}

export function resolveThirdPlaceAssignments(
  qualifiedGroups: string[],
): Record<string, string> | null {
  const key = [...qualifiedGroups].sort().join(',');
  return combinationByKey.get(key) ?? null;
}

export type ThirdPlaceSlotAssignment = {
  matchId: string;
  slot: 'away';
  teamId: string;
};

/** Map FIFA Annex C combination to concrete R32 away slots for the top eight third-place teams. */
export function assignThirdPlaceToR32Slots(
  thirdPlaceByGroup: Map<string, GroupStanding & { group: string }>,
): ThirdPlaceSlotAssignment[] {
  const ranked = rankThirdPlaceCandidates([...thirdPlaceByGroup.values()]);
  const qualified = ranked.slice(0, 8);
  if (qualified.length < 8) return [];

  const assign = resolveThirdPlaceAssignments(qualified.map((row) => row.group));
  if (!assign) return [];

  const out: ThirdPlaceSlotAssignment[] = [];
  for (const { matchId, winnerGroup } of WC2026_THIRD_PLACE_AWAY_SLOTS) {
    const thirdGroup = assign[winnerGroup];
    if (!thirdGroup) continue;
    const team = thirdPlaceByGroup.get(thirdGroup);
    if (!team) continue;
    out.push({ matchId, slot: 'away', teamId: team.teamId });
  }
  return out;
}
