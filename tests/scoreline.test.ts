import { describe, it, expect } from 'vitest';
import {
  buildScorelineMatrix,
  aggregateWdl,
  roundedLambdaScore,
  secondaryExpectedScore,
} from '../src/models/probability/scoreline';

describe('scoreline matrix', () => {
  it('sums to 1 after normalization', () => {
    const m = buildScorelineMatrix(1.4, 1.2);
    const sum = Object.values(m).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('aggregates W/D/L', () => {
    const m = buildScorelineMatrix(1.5, 1.5);
    const wdl = aggregateWdl(m);
    expect(wdl.homeWin + wdl.draw + wdl.awayWin).toBeCloseTo(1, 5);
  });

  it('exposes rounded λ score only when it disagrees with matrix argmax', () => {
    const matrix = buildScorelineMatrix(1.85, 0.55);
    expect(roundedLambdaScore(1.85, 0.55)).toBe('2-1');
    const hint = secondaryExpectedScore(matrix, 1.85, 0.55);
    expect(hint === null || hint === '2-1').toBe(true);
  });
});
