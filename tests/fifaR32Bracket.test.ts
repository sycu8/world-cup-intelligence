import { describe, expect, it } from 'vitest';
import {
  ANNEX_C_THIRD_SLOTS,
  FIFA_R32_MATCH_SLOTS,
  resolveThirdPlaceGroup,
  thirdPlaceGroupForWinnerSlot,
} from '../src/services/fifaR32Bracket';

describe('FIFA R32 bracket slots', () => {
  it('defines 16 Round of 32 matches (FIFA #73–88)', () => {
    expect(FIFA_R32_MATCH_SLOTS).toHaveLength(16);
    expect(FIFA_R32_MATCH_SLOTS[0]).toMatchObject({
      matchId: 'm-w26-r32-01',
      fifaNumber: 73,
      home: { kind: 'group_rank', group: 'A', rank: 2 },
      away: { kind: 'group_rank', group: 'B', rank: 2 },
    });
  });

  it('has 8 third-place slots spread across the bracket', () => {
    const thirdSlots = FIFA_R32_MATCH_SLOTS.flatMap((slot) => {
      const out: string[] = [];
      if (resolveThirdPlaceGroup(slot.home)) out.push(`${slot.matchId}:home`);
      if (resolveThirdPlaceGroup(slot.away)) out.push(`${slot.matchId}:away`);
      return out;
    });
    expect(thirdSlots).toHaveLength(8);
    expect(new Set(thirdSlots.map((s) => s.split(':')[0])).size).toBe(8);
  });

  it('maps Annex C combination #67 third-place groups', () => {
    expect(thirdPlaceGroupForWinnerSlot('A')).toBe('E');
    expect(thirdPlaceGroupForWinnerSlot('D')).toBe('B');
    expect(ANNEX_C_THIRD_SLOTS).toEqual({
      A: 'E',
      B: 'J',
      D: 'B',
      E: 'D',
      G: 'I',
      I: 'F',
      K: 'L',
      L: 'K',
    });
  });
});
