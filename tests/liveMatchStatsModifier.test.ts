import { describe, expect, it } from 'vitest';
import { hasUsableLiveStats, liveMatchStatsModifier } from '../src/models/probability/liveMatchStatsModifier';

describe('liveMatchStatsModifier', () => {
  it('returns neutral modifiers pre-kickoff', () => {
    expect(
      liveMatchStatsModifier({
        minute: 0,
        home: { possession: 60, shots: 5, shotsOnTarget: 3, xg: 1.2, passes: 200, passAccuracy: 85 },
        away: { possession: 40, shots: 2, shotsOnTarget: 1, xg: 0.4, passes: 120, passAccuracy: 78 },
      }),
    ).toEqual({ home: 1, away: 1 });
  });

  it('favors home when live stats show control', () => {
    const mod = liveMatchStatsModifier({
      minute: 60,
      home: { possession: 62, shots: 12, shotsOnTarget: 6, xg: 1.8, passes: 420, passAccuracy: 88 },
      away: { possession: 38, shots: 5, shotsOnTarget: 2, xg: 0.7, passes: 260, passAccuracy: 80 },
    });
    expect(mod.home).toBeGreaterThan(1);
    expect(mod.away).toBeLessThan(1);
  });

  it('detects usable live stats', () => {
    expect(
      hasUsableLiveStats(
        { possession: 0, shots: 0, shotsOnTarget: 0, xg: null, passes: 0, passAccuracy: null },
        { possession: 55, shots: 1, shotsOnTarget: 0, xg: null, passes: 0, passAccuracy: null },
      ),
    ).toBe(true);
  });
});
