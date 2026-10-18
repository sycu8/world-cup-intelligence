import { describe, it, expect } from 'vitest';
import { buildScorelineMatrix } from '../src/models/probability/scoreline';

describe('favorite tight-win skew', () => {
  it('boosts 1-0/2-0 over 1-1 when home is a clear favorite', () => {
    const matrix = buildScorelineMatrix(2.2, 0.95);
    const tightWin = Math.max(matrix['1-0'] ?? 0, matrix['2-0'] ?? 0);

    expect(matrix['1-1'] ?? 0).toBeLessThan(tightWin);
    expect(['1-0', '2-0', '2-1']).toContain(
      Object.entries(matrix).sort((a, b) => b[1] - a[1])[0]?.[0],
    );
  });

  it('leaves balanced matches near symmetric (1-1 can still lead)', () => {
    const matrix = buildScorelineMatrix(1.35, 1.3);
    const top = Object.entries(matrix).sort((a, b) => b[1] - a[1])[0]?.[0];
    expect(['1-1', '1-0', '0-1', '2-1', '1-2']).toContain(top);
  });
});
