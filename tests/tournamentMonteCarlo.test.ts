import { describe, expect, it } from 'vitest';
import {
  estimateTripleFromElo,
  runTournamentMonteCarlo,
  simulateTournamentOnce,
  type TournamentMonteCarloInput,
} from '../src/models/tournament/tournamentMonteCarlo';
import {
  estimateTripleFromTeamStrength,
  type TeamStrengthProfile,
} from '../src/services/tournamentTeamStrength';

function profile(
  teamId: string,
  overrides: Partial<TeamStrengthProfile> = {},
): TeamStrengthProfile {
  return {
    teamId,
    elo: 1700,
    collectiveStrength: 0.78,
    recentForm: 0.62,
    fifaRanking: 12,
    lineupModifier: 0.98,
    countryCode: null,
    isHost: false,
    effectiveRating: 1750,
    ...overrides,
  };
}

describe('tournamentMonteCarlo', () => {
  it('estimateTripleFromTeamStrength favors stronger team with full squad', () => {
    const triple = estimateTripleFromTeamStrength(
      profile('home', { effectiveRating: 1900, isHost: true }),
      profile('away', { effectiveRating: 1600, lineupModifier: 0.76 }),
      false,
    );
    expect(triple.homeWin).toBeGreaterThan(triple.awayWin);
    expect(triple.homeWin + triple.draw + triple.awayWin).toBeCloseTo(1, 5);
  });

  it('estimateTripleFromElo remains available for legacy callers', () => {
    const triple = estimateTripleFromElo('home', 'away', { home: 1900, away: 1600 }, false);
    expect(triple.homeWin).toBeGreaterThan(triple.awayWin);
  });

  it('runTournamentMonteCarlo returns normalized probabilities', () => {
    const input = finalOnlyInput();
    const result = runTournamentMonteCarlo({ ...input, simulations: 200, rng: () => 0.5 });
    const sum = result.championCounts.reduce((acc, row) => acc + row.prob, 0);
    expect(sum).toBeGreaterThan(0);
    expect(sum).toBeLessThanOrEqual(1.01);
    expect(result.championCounts[0]?.prob).toBeGreaterThan(0);
  });

  it('simulateTournamentOnce is deterministic with fixed rng', () => {
    const input = finalOnlyInput();
    let i = 0;
    const rng = () => {
      i += 1;
      return (i * 0.17) % 1;
    };
    const a = simulateTournamentOnce(input, rng);
    i = 0;
    const b = simulateTournamentOnce(input, rng);
    expect(a).toBe(b);
  });
});

function finalOnlyInput(): TournamentMonteCarloInput {
  const teamStrength = {
    't-a1': profile('t-a1', { effectiveRating: 1820 }),
    't-a2': profile('t-a2', { effectiveRating: 1680 }),
    't-b1': profile('t-b1', { effectiveRating: 1760 }),
    't-b2': profile('t-b2', { effectiveRating: 1640 }),
  };

  return {
    simulations: 1,
    teamStrength,
    groupMatches: [
      {
        id: 'g1',
        groupCode: 'A',
        homeTeamId: 't-a1',
        awayTeamId: 't-a2',
        homeScore: 0,
        awayScore: 0,
        status: 'scheduled',
      },
      {
        id: 'g2',
        groupCode: 'B',
        homeTeamId: 't-b1',
        awayTeamId: 't-b2',
        homeScore: 0,
        awayScore: 0,
        status: 'scheduled',
      },
    ],
    knockoutMatches: [{ id: 'm-w26-final-01', stage: 'Final' }],
    groupRankLinks: [
      {
        sourceMatchId: null,
        targetMatchId: 'm-w26-final-01',
        targetSlot: 'home',
        ruleType: 'group_rank',
        group: 'A',
        rank: 1,
      },
      {
        sourceMatchId: null,
        targetMatchId: 'm-w26-final-01',
        targetSlot: 'away',
        ruleType: 'group_rank',
        group: 'B',
        rank: 1,
      },
    ],
    winnerLinks: [],
  };
}
