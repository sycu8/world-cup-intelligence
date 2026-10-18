import { describe, expect, it } from 'vitest';
import {
  isKnockoutMatchStage,
  knockoutExtraTimeProbability,
  knockoutPenaltyProbability,
  KNOCKOUT_ET_DISPLAY_MIN,
} from '../src/models/probability/knockoutForecast';

describe('knockoutForecast', () => {
  it('detects knockout stages', () => {
    expect(isKnockoutMatchStage('Round of 16')).toBe(true);
    expect(isKnockoutMatchStage('Final')).toBe(true);
    expect(isKnockoutMatchStage('Third place')).toBe(true);
    expect(isKnockoutMatchStage('Group')).toBe(false);
  });

  it('derives ET and penalty forecast from draw probability', () => {
    expect(knockoutExtraTimeProbability(0.3, 'Quarter-final')).toBeCloseTo(0.255);
    expect(knockoutPenaltyProbability(0.3, 'Quarter-final')).toBeCloseTo(0.105);
    expect(knockoutExtraTimeProbability(0.3, 'Group')).toBeUndefined();
  });

  it('uses display threshold for UI chips', () => {
    expect(KNOCKOUT_ET_DISPLAY_MIN).toBeGreaterThan(0.1);
  });
});
