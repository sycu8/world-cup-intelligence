import { describe, expect, it } from 'vitest';
import {
  estimateTripleFromElo,
  runTournamentMonteCarlo,
  simulateTournamentOnce,
  type TournamentMonteCarloInput,
} from '../src/models/tournament/tournamentMonteCarlo';

describe('tournamentMonteCarlo', () => {
  it('estimateTripleFromElo favors stronger home team', () => {
    const ratings = { home: 1900, away: 1600 };
    const triple = estimateTripleFromElo('home', 'away', ratings, false);
    expect(triple.homeWin).toBeGreaterThan(triple.awayWin);
    expect(triple.homeWin + triple.draw + triple.awayWin).toBeCloseTo(1, 5);
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
  const teams = ['t-a1', 't-a2', 't-b1', 't-b2'];
  const ratings = Object.fromEntries(teams.map((id, index) => [id, 1700 - index * 40]));

  return {
    simulations: 1,
    teamRatings: ratings,
    matchProbs: {},
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

function minimalInput(): TournamentMonteCarloInput {
  const teams = ['t-a1', 't-a2', 't-b1', 't-b2'];
  const ratings = Object.fromEntries(teams.map((id, index) => [id, 1700 - index * 40]));

  return {
    simulations: 1,
    teamRatings: ratings,
    matchProbs: {},
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
    knockoutMatches: [
      { id: 'm-w26-r32-01', stage: 'Round of 32' },
      { id: 'm-w26-r16-01', stage: 'Round of 16' },
      { id: 'm-w26-qf-01', stage: 'Quarter-final' },
      { id: 'm-w26-sf-01', stage: 'Semi-final' },
      { id: 'm-w26-final-01', stage: 'Final' },
    ],
    groupRankLinks: [
      {
        sourceMatchId: null,
        targetMatchId: 'm-w26-r32-01',
        targetSlot: 'home',
        ruleType: 'group_rank',
        group: 'A',
        rank: 1,
      },
      {
        sourceMatchId: null,
        targetMatchId: 'm-w26-r32-01',
        targetSlot: 'away',
        ruleType: 'group_rank',
        group: 'B',
        rank: 1,
      },
    ],
    winnerLinks: [
      {
        sourceMatchId: 'm-w26-r32-01',
        targetMatchId: 'm-w26-r16-01',
        targetSlot: 'home',
        ruleType: 'winner',
      },
      {
        sourceMatchId: 'm-w26-r16-01',
        targetMatchId: 'm-w26-qf-01',
        targetSlot: 'home',
        ruleType: 'winner',
      },
      {
        sourceMatchId: 'm-w26-qf-01',
        targetMatchId: 'm-w26-sf-01',
        targetSlot: 'home',
        ruleType: 'winner',
      },
      {
        sourceMatchId: 'm-w26-sf-01',
        targetMatchId: 'm-w26-final-01',
        targetSlot: 'home',
        ruleType: 'winner',
      },
    ],
  };
}
