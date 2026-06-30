import { describe, it, expect } from 'vitest';
import {
  commentaryNeedsFullRetranslate,
  COMMENTARY_RETRANSLATE_RATIO,
} from '../src/ingestion/fifa/matchRecapSync';

describe('commentaryNeedsFullRetranslate', () => {
  it('requires sync when commentary is missing', () => {
    expect(commentaryNeedsFullRetranslate(0, 0)).toBe(true);
  });

  it('skips full retranslate when only a few lines are still English', () => {
    expect(commentaryNeedsFullRetranslate(45, 3)).toBe(false);
  });

  it('retranslates when most lines are still English', () => {
    const threshold = Math.ceil(20 * COMMENTARY_RETRANSLATE_RATIO);
    expect(commentaryNeedsFullRetranslate(20, threshold)).toBe(true);
  });
});
