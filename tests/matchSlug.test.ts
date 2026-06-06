import { describe, expect, it } from 'vitest';
import { buildMatchSlug, isLegacyMatchId, stageSlug } from '../src/utils/matchSlug';

describe('matchSlug', () => {
  it('detects legacy internal ids', () => {
    expect(isLegacyMatchId('m-w26-ga-1v2')).toBe(true);
    expect(isLegacyMatchId('vong-bang-a-usa-vs-mex')).toBe(false);
  });

  it('builds group stage slug', () => {
    expect(
      buildMatchSlug({
        stage: 'Group',
        groupCode: 'A',
        homeName: 'United States',
        awayName: 'Mexico',
      }),
    ).toBe('vong-bang-a-united-states-vs-mexico');
  });

  it('maps knockout stages to Vietnamese round slugs', () => {
    expect(stageSlug('Round of 32', null)).toBe('vong-1-16');
    expect(stageSlug('Round of 16', null)).toBe('vong-1-8');
    expect(stageSlug('Quarter-final', null)).toBe('vong-tu-ket');
    expect(stageSlug('Semi-final', null)).toBe('vong-ban-ket');
    expect(stageSlug('Third place', null)).toBe('tranh-hang-3');
    expect(stageSlug('Final', null)).toBe('chung-ket');
  });

  it('builds final slug from team names', () => {
    expect(
      buildMatchSlug({
        stage: 'Final',
        groupCode: null,
        homeName: 'Argentina',
        awayName: 'France',
      }),
    ).toBe('chung-ket-argentina-vs-france');
  });
});
