import { describe, expect, it } from 'vitest';
import { describeSideLineup, type TeamPreviewSide } from '../src/services/matchPreviewAnalysis';

function side(overrides: Partial<TeamPreviewSide> = {}): TeamPreviewSide {
  return {
    teamId: 't1',
    teamName: 'Mexico',
    shortName: 'MEX',
    elo: 1800,
    fifaRanking: 10,
    collectiveStrength: 0.7,
    formation: '4-3-3',
    lineupSource: 'projected',
    hasAccurateLineup: false,
    lineupPlayers: [],
    keyPlayers: [],
    fullLineup: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    recentForm: 'WWD',
    formMatches: 3,
    ...overrides,
  };
}

describe('describeSideLineup', () => {
  it('returns pending message when lineup has fewer than 7 players', () => {
    expect(describeSideLineup(side({ fullLineup: ['A'] }), 'vi')).toContain('Chưa có');
    expect(describeSideLineup(side({ fullLineup: [] }), 'en')).toContain('No confirmed');
  });

  it('labels official, squad, and projected sources', () => {
    expect(describeSideLineup(side({ lineupSource: 'official' }), 'vi')).toContain('chính thức');
    expect(describeSideLineup(side({ lineupSource: 'squad' }), 'en')).toContain('squad');
    expect(describeSideLineup(side({ lineupSource: 'projected' }), 'en')).toContain('projected');
  });
});
