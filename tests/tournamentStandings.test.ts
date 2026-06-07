import { describe, expect, it } from 'vitest';
import { sortStandingRows, type StandingRow } from '../src/services/tournamentStandings';

function row(
  teamId: string,
  teamName: string,
  played: number,
  points: number,
  gd = 0,
): StandingRow {
  return {
    teamId,
    teamName,
    shortName: null,
    rank: 0,
    played,
    points,
    gf: 0,
    ga: 0,
    gd,
  };
}

describe('sortStandingRows', () => {
  it('sorts alphabetically when no matches played', () => {
    const ranked = sortStandingRows([
      row('t-usa', 'United States', 0, 0),
      row('t-mex', 'Mexico', 0, 0),
      row('t-can', 'Canada', 0, 0),
      row('t-bra', 'Brazil', 0, 0),
    ]);
    expect(ranked.map((r) => r.teamName)).toEqual([
      'Brazil',
      'Canada',
      'Mexico',
      'United States',
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('sorts by points after results', () => {
    const ranked = sortStandingRows([
      row('t-usa', 'United States', 1, 3, 2),
      row('t-mex', 'Mexico', 1, 0, -2),
      row('t-can', 'Canada', 1, 3, 1),
      row('t-bra', 'Brazil', 1, 0, -1),
    ]);
    expect(ranked[0]?.teamId).toBe('t-usa');
    expect(ranked[1]?.teamId).toBe('t-can');
    expect(ranked[2]?.isThirdPlaceCandidate).toBe(true);
  });
});
