import { describe, expect, it } from 'vitest';
import {
  actualScoreProbability,
  normalizeScorelineKey,
  scorelineLogLoss,
  scorelineTop1Hit,
  scorelineTopKHit,
  topScorelines,
} from '../src/models/backtesting/scorelineMetrics';

describe('scorelineMetrics', () => {
  const matrix = {
    '1-0': 0.2,
    '2-0': 0.15,
    '1-1': 0.12,
    '0-0': 0.1,
    '2-1': 0.08,
  };

  it('normalizes scoreline keys', () => {
    expect(normalizeScorelineKey('2:1')).toBe('2-1');
  });

  it('detects top-1 and top-3 hits', () => {
    expect(scorelineTop1Hit(matrix, '1-0')).toBe(true);
    expect(scorelineTop1Hit(matrix, '2-1')).toBe(false);
    expect(scorelineTopKHit(matrix, '2-1', 3)).toBe(false);
    expect(scorelineTopKHit(matrix, '2-0', 3)).toBe(true);
  });

  it('returns actual score probability and log loss', () => {
    expect(actualScoreProbability(matrix, '1-1')).toBeCloseTo(0.12);
    expect(scorelineLogLoss(matrix, '1-1')).toBeCloseTo(-Math.log(0.12));
    expect(actualScoreProbability(matrix, '9-9')).toBe(0);
  });

  it('ranks top scorelines', () => {
    expect(topScorelines(matrix, 2).map((r) => r.score)).toEqual(['1-0', '2-0']);
  });
});
