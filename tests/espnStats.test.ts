import { describe, it, expect } from 'vitest';
import { parseEspnTeamStats } from '../src/ingestion/espn/parseEspnStats';
import { findEspnEventId, teamLabelsMatch } from '../src/ingestion/espn/espnTeamMatch';

describe('espnTeamMatch', () => {
  it('matches Bosnia naming variants', () => {
    expect(teamLabelsMatch('Bosnia and Herzegovina', 'Bosnia-Herzegovina')).toBe(true);
    expect(teamLabelsMatch('Korea Republic', 'South Korea')).toBe(true);
    expect(teamLabelsMatch('USA', 'United States')).toBe(true);
  });

  it('finds ESPN event on scoreboard', () => {
    const events = [
      {
        id: '760416',
        date: '2026-06-12',
        competitions: [
          {
            competitors: [
              { homeAway: 'home', team: { displayName: 'Canada' } },
              { homeAway: 'away', team: { displayName: 'Bosnia-Herzegovina' } },
            ],
          },
        ],
      },
    ];
    expect(findEspnEventId(events, 'Canada', 'Bosnia and Herzegovina')).toBe('760416');
  });
});

describe('parseEspnStats', () => {
  it('maps ESPN boxscore fields to platform columns', () => {
    const stats = [
      { name: 'possessionPct', displayValue: '61.1' },
      { name: 'totalShots', displayValue: '13' },
      { name: 'shotsOnTarget', displayValue: '4' },
      { name: 'totalPasses', displayValue: '421' },
      { name: 'passPct', displayValue: '0.7' },
    ];
    expect(parseEspnTeamStats(stats)).toEqual({
      possession: 61.1,
      shots: 13,
      shotsOnTarget: 4,
      passes: 421,
      passAccuracy: 70,
    });
  });
});
