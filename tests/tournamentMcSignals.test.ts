import { describe, expect, it } from 'vitest';
import { blendTriples, pairKey } from '../src/services/tournamentMcSignals';

describe('tournamentMcSignals', () => {
  it('pairKey is order-sensitive', () => {
    expect(pairKey('a', 'b')).toBe('a|b');
    expect(pairKey('b', 'a')).toBe('b|a');
  });

  it('blendTriples returns base when overlay missing', () => {
    const base = { homeWin: 0.5, draw: 0.25, awayWin: 0.25 };
    expect(blendTriples(base, undefined)).toEqual(base);
  });

  it('blendTriples mixes overlay toward recent H2H', () => {
    const base = { homeWin: 0.5, draw: 0.25, awayWin: 0.25 };
    const overlay = { homeWin: 0.8, draw: 0.1, awayWin: 0.1 };
    const blended = blendTriples(base, overlay, 0.5);
    expect(blended.homeWin).toBeGreaterThan(base.homeWin);
    expect(blended.homeWin + blended.draw + blended.awayWin).toBeCloseTo(1, 5);
  });
});
