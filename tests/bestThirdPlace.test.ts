import { describe, expect, it } from 'vitest';
import { BEST_THIRD_R32_SLOTS } from '../src/services/tournamentProgression';
import { rankBestThirdPlace } from '../src/services/tournamentStandings';

describe('best third place qualification', () => {
  it('defines 8 third-place R32 slots across the FIFA bracket', () => {
    expect(BEST_THIRD_R32_SLOTS).toHaveLength(8);
    const matchIds = new Set(BEST_THIRD_R32_SLOTS.map((s) => s.matchId));
    expect(matchIds).toEqual(
      new Set([
        'm-w26-r32-02',
        'm-w26-r32-05',
        'm-w26-r32-07',
        'm-w26-r32-08',
        'm-w26-r32-09',
        'm-w26-r32-10',
        'm-w26-r32-13',
        'm-w26-r32-15',
      ]),
    );
    expect(BEST_THIRD_R32_SLOTS[0]).toEqual({ matchId: 'm-w26-r32-02', slot: 'away' });
  });

  it('ranks third-place teams by points then GD', () => {
    const ranked = rankBestThirdPlace([
      { teamId: 'a', played: 3, points: 3, gf: 2, ga: 4, gd: -2, group: 'A' },
      { teamId: 'b', played: 3, points: 6, gf: 5, ga: 3, gd: 2, group: 'B' },
      { teamId: 'c', played: 3, points: 6, gf: 4, ga: 2, gd: 2, group: 'C' },
    ]);
    expect(ranked[0].teamId).toBe('b');
    expect(ranked).toHaveLength(3);
  });

  it('computeGroupStandings sorts by points', () => {
    const sorted = [
      { teamId: 't1', played: 2, points: 6, gf: 4, ga: 1, gd: 3 },
      { teamId: 't2', played: 2, points: 3, gf: 2, ga: 2, gd: 0 },
    ];
    expect(sorted[0].points).toBeGreaterThan(sorted[1].points);
  });
});
