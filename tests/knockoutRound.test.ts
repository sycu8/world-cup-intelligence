import { describe, expect, it } from 'vitest';
import type { ScheduleMatch } from '../app/lib/api';
import {
  areAllGroupsComplete,
  inferActiveKnockoutStage,
  isKnockoutRoundComplete,
  knockoutRoundProgress,
} from '../app/lib/knockoutRound';

function koMatch(
  stage: string,
  id: string,
  status: ScheduleMatch['status'] = 'scheduled',
): ScheduleMatch {
  return {
    id,
    stage,
    status,
    kickoff_utc: '2026-07-01T18:00:00Z',
    home_name: 'Home',
    away_name: 'Away',
    home_score: status === 'completed' ? 2 : 0,
    away_score: status === 'completed' ? 1 : 0,
    slug: id,
  } as ScheduleMatch;
}

describe('knockoutRound helpers', () => {
  it('infers live round as active', () => {
    const matches = [
      koMatch('Round of 32', 'r32-1', 'completed'),
      koMatch('Round of 32', 'r32-2', 'live'),
      koMatch('Round of 16', 'r16-1', 'scheduled'),
    ];
    expect(inferActiveKnockoutStage(matches)).toBe('Round of 32');
  });

  it('infers next incomplete round when no live matches', () => {
    const matches = [
      koMatch('Round of 32', 'r32-1', 'completed'),
      koMatch('Round of 32', 'r32-2', 'completed'),
      koMatch('Round of 16', 'r16-1', 'scheduled'),
      koMatch('Round of 16', 'r16-2', 'scheduled'),
    ];
    expect(inferActiveKnockoutStage(matches)).toBe('Round of 16');
  });

  it('returns last round when tournament is over', () => {
    const matches = [
      koMatch('Semi-final', 'sf-1', 'completed'),
      koMatch('Semi-final', 'sf-2', 'completed'),
      koMatch('Final', 'final', 'completed'),
    ];
    expect(inferActiveKnockoutStage(matches)).toBe('Final');
  });

  it('tracks round completion and progress', () => {
    const matches = [
      koMatch('Quarter-final', 'qf-1', 'completed'),
      koMatch('Quarter-final', 'qf-2', 'live'),
      koMatch('Quarter-final', 'qf-3', 'scheduled'),
      koMatch('Quarter-final', 'qf-4', 'scheduled'),
    ];
    expect(isKnockoutRoundComplete(matches, 'Quarter-final')).toBe(false);
    expect(knockoutRoundProgress(matches, 'Quarter-final')).toEqual({
      done: 1,
      total: 4,
      live: 1,
    });
  });

  it('detects when all groups are complete', () => {
    const groups = {
      A: { complete: true, rows: [] },
      B: { complete: false, rows: [] },
    };
    expect(areAllGroupsComplete(groups, ['A', 'B'])).toBe(false);
    expect(areAllGroupsComplete({ ...groups, B: { complete: true, rows: [] } }, ['A', 'B'])).toBe(
      true,
    );
  });
});
