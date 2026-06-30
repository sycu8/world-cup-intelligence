import { describe, it, expect } from 'vitest';
import { computeProbability } from '../src/models/probability/engine';
import { computeScenarioLikelihoods } from '../src/models/probability/scenarioLikelihood';
import { buildTeamSystemProfile } from '../src/models/probability/teamSystemStrength';
import type { MatchFeatureInput, TeamFeatures } from '../src/models/probability/types';

function team(id: string, fifa: number, strength: number): TeamFeatures {
  return {
    teamId: id,
    eloRating: 1500 + strength * 400,
    fifaRanking: fifa,
    recentForm: strength - 0.5,
    goalDifference: (strength - 0.5) * 8,
    xgDifference: strength - 0.5,
    xgFor: 1.1 + strength * 0.5,
    xgAgainst: 1.2 - strength * 0.25,
    possessionProfile: 0.5,
    fieldTilt: 0.5,
    ppda: 9,
    highTurnovers: 0.6,
    transitionThreat: 0.6,
    setPieceXg: 0.22,
    setPieceXga: 0.18,
    defensiveCompactness: strength,
    formationStability: strength,
    benchDepth: strength,
    goalkeeperStrength: strength,
    restDays: 4,
  };
}

function knockoutInput(stage: string, homeFifa = 8, awayFifa = 22): MatchFeatureInput {
  return {
    matchId: `m-ko-${stage}`,
    tournamentYear: 2026,
    stage,
    minute: 0,
    second: 0,
    homeTeam: team('team-home', homeFifa, 0.82),
    awayTeam: team('team-away', awayFifa, 0.68),
    currentScore: { home: 0, away: 0 },
    sourceConfidence: 0.9,
  };
}

describe('knockout probability validation', () => {
  const stages = [
    'Round of 32',
    'Round of 16',
    'Quarter-final',
    'Semi-final',
    'Third place',
    'Final',
  ];

  for (const stage of stages) {
    it(`produces valid W/D/L for ${stage}`, async () => {
      const r = await computeProbability(knockoutInput(stage));
      expect(r.homeWinProb + r.drawProb + r.awayWinProb).toBeCloseTo(1, 5);
      expect(r.expectedHomeGoals).toBeGreaterThan(0);
      expect(r.expectedAwayGoals).toBeGreaterThan(0);
      expect(r.modelVersion).toBe('wc-prob-v5');
    });
  }

  it('raises ET and penalty scenario likelihoods vs group stage', async () => {
    const group = await computeProbability(knockoutInput('Group'));
    const final = await computeProbability(knockoutInput('Final'));
    const input = knockoutInput('Final');
    const homeSystem = buildTeamSystemProfile(input.homeTeam);
    const awaySystem = buildTeamSystemProfile(input.awayTeam);
    const groupScenarios = computeScenarioLikelihoods(
      knockoutInput('Group'),
      group,
      homeSystem,
      awaySystem,
    );
    const finalScenarios = computeScenarioLikelihoods(
      knockoutInput('Final'),
      final,
      homeSystem,
      awaySystem,
    );
    const groupEt = groupScenarios.find((s) => s.scenarioType === 'extra_time_tendency')!.probability;
    const finalEt = finalScenarios.find((s) => s.scenarioType === 'extra_time_tendency')!.probability;
    const groupPens = groupScenarios.find((s) => s.scenarioType === 'penalty_shootout_tendency')!.probability;
    const finalPens = finalScenarios.find((s) => s.scenarioType === 'penalty_shootout_tendency')!.probability;
    expect(finalEt).toBeGreaterThan(groupEt);
    expect(finalPens).toBeGreaterThan(groupPens);
  });

  it('differentiates strong vs weak sides in knockout rounds', async () => {
    const balanced = await computeProbability(knockoutInput('Quarter-final', 20, 22));
    const skewed = await computeProbability(knockoutInput('Quarter-final', 3, 45));
    expect(skewed.homeWinProb).toBeGreaterThan(balanced.homeWinProb);
    expect(skewed.awayWinProb).toBeLessThan(balanced.awayWinProb);
  });

  it('applies lower draw mass when knockout competitive spirit is loaded', async () => {
    const { buildKnockoutCompetitiveSpirit } = await import(
      '../src/models/probability/knockoutCompetitiveSpirit'
    );
    const input = knockoutInput('Round of 32', 10, 30);
    const withoutSpirit = await computeProbability(input);
    const withSpirit = await computeProbability({
      ...input,
      knockoutCompetitiveSpirit: buildKnockoutCompetitiveSpirit(
        input.stage,
        input.homeTeam,
        input.awayTeam,
      ),
    });
    expect(withSpirit.drawProb).toBeLessThan(withoutSpirit.drawProb);
  });
});
