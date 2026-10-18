import { describe, it, expect } from 'vitest';
import { buildIntervalDistribution } from '../src/models/probability/interval';

describe('interval distribution', () => {
  it('returns all required intervals', () => {
    const d = buildIntervalDistribution(1.3, 1.1, 0, 0, 0, { homeWin: 0.4, draw: 0.28, awayWin: 0.32 });
    expect(d['15']).toBeDefined();
    expect(d['90']).toBeDefined();
    const i90 = d['90'];
    expect(i90.homeWinProb + i90.drawProb + i90.awayWinProb).toBeCloseTo(1, 2);
  });

  it('boosts away win probability when away team leads', () => {
    const leading = buildIntervalDistribution(1.0, 1.0, 60, 0, 2, { homeWin: 0.3, draw: 0.3, awayWin: 0.4 });
    const tied = buildIntervalDistribution(1.0, 1.0, 60, 0, 0, { homeWin: 0.3, draw: 0.3, awayWin: 0.4 });
    expect(leading['90'].awayWinProb).toBeGreaterThan(tied['90'].awayWinProb);
  });
});
