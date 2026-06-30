import { describe, expect, it } from 'vitest';
import {
  SCORELINE_MATRIX_MIN_PROB,
  scorelinesForMatrixDisplay,
} from '../app/lib/scorelineMatrix';

describe('scorelineMatrix display filter', () => {
  it('hides scorelines below 0.1%', () => {
    const keys = scorelinesForMatrixDisplay({
      '1-0': 0.15,
      '1-1': 0.12,
      '5-4': 0.0005,
    });
    expect(keys).toEqual(['1-0', '1-1']);
    expect(SCORELINE_MATRIX_MIN_PROB).toBe(0.001);
  });

  it('always keeps highlighted and actual scorelines', () => {
    const keys = scorelinesForMatrixDisplay(
      { '2-1': 0.2, '4-3': 0.0002 },
      { highlight: '4-3', actualScore: '4-3' },
    );
    expect(keys).toEqual(['2-1', '4-3']);
  });
});
