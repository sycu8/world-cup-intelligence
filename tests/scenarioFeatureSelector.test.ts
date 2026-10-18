import { describe, expect, it } from 'vitest';
import { hasPath } from '../src/models/scenarios/scenarioFeatureSelector';
import type { MatchScenarioContext } from '../src/models/scenarios/types';

const ctx = {
  features: { homeLineup: true, awayLineup: false, homeTeam: { recentForm: 1 }, awayTeam: { recentForm: 2 }, sourceConfidence: 0.5 },
} as unknown as MatchScenarioContext;

describe('scenarioFeatureSelector hasPath', () => {
  it('returns false for unknown nested feature paths', () => {
    expect(hasPath(ctx, 'features.unknownField')).toBe(false);
  });

  it('evaluates known feature paths', () => {
    expect(hasPath(ctx, 'features.homeLineup')).toBe(true);
    expect(hasPath(ctx, 'features.awayLineup')).toBe(false);
    expect(hasPath(ctx, 'features.sourceConfidence')).toBe(true);
  });
});
