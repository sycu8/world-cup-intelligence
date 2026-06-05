import { describe, expect, it } from 'vitest';
import { buildLineupFeaturesFromPlayers } from '../src/services/lineupFeatures';

describe('lineupFeatures', () => {
  it('builds stronger modifier for official full XI', () => {
    const players = Array.from({ length: 11 }, (_, i) => ({
      is_starter: 1,
      position_slot: i === 0 ? 'GK' : i < 5 ? 'CB' : i < 8 ? 'CM' : 'ST',
      role: null,
    }));

    const official = buildLineupFeaturesFromPlayers('4-3-3', players, true);
    const projected = buildLineupFeaturesFromPlayers('4-3-3', players, false);

    expect(official?.strengthModifier).toBeGreaterThan(projected?.strengthModifier ?? 0);
    expect(official?.missingKeyRoles).toEqual([]);
  });

  it('flags missing goalkeeper', () => {
    const players = Array.from({ length: 11 }, () => ({
      is_starter: 1,
      position_slot: 'CM',
      role: null,
    }));

    const features = buildLineupFeaturesFromPlayers('4-4-2', players, true);
    expect(features?.missingKeyRoles).toContain('GK');
  });

  it('returns undefined when fewer than 7 starters', () => {
    const players = Array.from({ length: 5 }, () => ({
      is_starter: 1,
      position_slot: 'CM',
      role: null,
    }));

    expect(buildLineupFeaturesFromPlayers('4-4-2', players, true)).toBeUndefined();
  });
});
