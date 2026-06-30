/**
 * FIFA World Cup 2026 Round of 32 bracket slots (matches 73–88).
 * Fixed runner-up pairings + winner vs third-place slots per FIFA regulations Annex C.
 * @see https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage
 */

export type R32SlotRule =
  | { kind: 'group_rank'; group: string; rank: 1 | 2 | 3 }
  | { kind: 'third_place'; group: string };

export type R32MatchSlot = {
  matchId: string;
  fifaNumber: number;
  home: R32SlotRule;
  away: R32SlotRule;
};

/** FIFA template: internal match id ↔ R32 pairing rules (independent of Annex C combo for fixed runner-up ties). */
export const FIFA_R32_MATCH_SLOTS: R32MatchSlot[] = [
  { matchId: 'm-w26-r32-01', fifaNumber: 73, home: { kind: 'group_rank', group: 'A', rank: 2 }, away: { kind: 'group_rank', group: 'B', rank: 2 } },
  { matchId: 'm-w26-r32-02', fifaNumber: 74, home: { kind: 'group_rank', group: 'E', rank: 1 }, away: { kind: 'third_place', group: 'D' } },
  { matchId: 'm-w26-r32-03', fifaNumber: 75, home: { kind: 'group_rank', group: 'F', rank: 1 }, away: { kind: 'group_rank', group: 'C', rank: 2 } },
  { matchId: 'm-w26-r32-04', fifaNumber: 76, home: { kind: 'group_rank', group: 'C', rank: 1 }, away: { kind: 'group_rank', group: 'F', rank: 2 } },
  { matchId: 'm-w26-r32-05', fifaNumber: 77, home: { kind: 'group_rank', group: 'I', rank: 1 }, away: { kind: 'third_place', group: 'F' } },
  { matchId: 'm-w26-r32-06', fifaNumber: 78, home: { kind: 'group_rank', group: 'E', rank: 2 }, away: { kind: 'group_rank', group: 'I', rank: 2 } },
  { matchId: 'm-w26-r32-07', fifaNumber: 79, home: { kind: 'group_rank', group: 'A', rank: 1 }, away: { kind: 'third_place', group: 'E' } },
  { matchId: 'm-w26-r32-08', fifaNumber: 80, home: { kind: 'group_rank', group: 'L', rank: 1 }, away: { kind: 'third_place', group: 'K' } },
  { matchId: 'm-w26-r32-09', fifaNumber: 81, home: { kind: 'group_rank', group: 'D', rank: 1 }, away: { kind: 'third_place', group: 'B' } },
  { matchId: 'm-w26-r32-10', fifaNumber: 82, home: { kind: 'group_rank', group: 'G', rank: 1 }, away: { kind: 'third_place', group: 'I' } },
  { matchId: 'm-w26-r32-11', fifaNumber: 83, home: { kind: 'group_rank', group: 'K', rank: 2 }, away: { kind: 'group_rank', group: 'L', rank: 2 } },
  { matchId: 'm-w26-r32-12', fifaNumber: 84, home: { kind: 'group_rank', group: 'H', rank: 1 }, away: { kind: 'group_rank', group: 'J', rank: 2 } },
  { matchId: 'm-w26-r32-13', fifaNumber: 85, home: { kind: 'group_rank', group: 'B', rank: 1 }, away: { kind: 'third_place', group: 'J' } },
  { matchId: 'm-w26-r32-14', fifaNumber: 86, home: { kind: 'group_rank', group: 'J', rank: 1 }, away: { kind: 'group_rank', group: 'H', rank: 2 } },
  { matchId: 'm-w26-r32-15', fifaNumber: 87, home: { kind: 'group_rank', group: 'K', rank: 1 }, away: { kind: 'third_place', group: 'L' } },
  { matchId: 'm-w26-r32-16', fifaNumber: 88, home: { kind: 'group_rank', group: 'D', rank: 2 }, away: { kind: 'group_rank', group: 'G', rank: 2 } },
];

/**
 * Annex C combination row when third-place teams advance from groups B,D,E,F,I,J,K,L.
 * Maps each 1X vs 3Y winner slot to the third-place group letter.
 */
export const ANNEX_C_THIRD_SLOTS: Record<string, string> = {
  A: 'E',
  B: 'J',
  D: 'B',
  E: 'D',
  G: 'I',
  I: 'F',
  K: 'L',
  L: 'K',
};

export function thirdPlaceGroupForWinnerSlot(winnerGroup: string): string | null {
  return ANNEX_C_THIRD_SLOTS[winnerGroup] ?? null;
}

export function resolveThirdPlaceGroup(rule: R32SlotRule): string | null {
  if (rule.kind === 'third_place') return rule.group;
  if (rule.kind === 'group_rank' && rule.rank === 3) return rule.group;
  return null;
}
