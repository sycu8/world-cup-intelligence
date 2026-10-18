import { describe, expect, it } from 'vitest';
import {
  favoriteOutcome,
  outcomeFromScore,
  outcomeVector,
} from '../src/services/predictionAccuracy';
import { brierScore } from '../src/models/backtesting/metrics';

describe('predictionAccuracy', () => {
  it('maps scores to outcomes', () => {
    expect(outcomeFromScore(2, 1)).toBe('home');
    expect(outcomeFromScore(1, 1)).toBe('draw');
    expect(outcomeFromScore(0, 3)).toBe('away');
  });

  it('picks favorite outcome from probabilities', () => {
    expect(favoriteOutcome(0.55, 0.25, 0.2)).toBe('home');
    expect(favoriteOutcome(0.3, 0.4, 0.3)).toBe('draw');
    expect(favoriteOutcome(0.2, 0.25, 0.55)).toBe('away');
  });

  it('scores perfect prediction with zero brier', () => {
    const actual = outcomeVector('home');
    expect(brierScore([0.6, 0.25, 0.15], actual)).toBeLessThan(0.1);
  });
});
