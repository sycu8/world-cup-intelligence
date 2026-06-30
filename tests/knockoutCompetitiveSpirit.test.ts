import { describe, it, expect } from 'vitest';
import {
  buildKnockoutCompetitiveSpirit,
  knockoutCompetitiveSpiritModifier,
} from '../src/models/probability/knockoutCompetitiveSpirit';
import { computeProbability } from '../src/models/probability/engine';
import { CALIBRATION } from '../src/models/probability/calibration';
import type { MatchFeatureInput, TeamFeatures } from '../src/models/probability/types';

function stubTeam(id: string, fifa: number, form = 0.2): TeamFeatures {
  return {
    teamId: id,
    eloRating: 1700,
    fifaRanking: fifa,
    recentForm: form,
    goalDifference: 2,
    xgDifference: 0.2,
    xgFor: 1.4,
    xgAgainst: 1.2,
    possessionProfile: 0.5,
    fieldTilt: 0.5,
    ppda: 8,
    highTurnovers: 0.6,
    transitionThreat: 0.6,
    setPieceXg: 0.25,
    setPieceXga: 0.18,
    defensiveCompactness: 0.7,
    formationStability: 0.7,
    benchDepth: 0.65,
    goalkeeperStrength: 0.7,
    restDays: 4,
  };
}

const knockoutBase = (): MatchFeatureInput => ({
  matchId: 'm-ko-test',
  tournamentYear: 2026,
  stage: 'Round of 32',
  minute: 0,
  second: 0,
  homeTeam: stubTeam('team-home', 8, 0.35),
  awayTeam: stubTeam('team-away', 28, 0.15),
  currentScore: { home: 0, away: 0 },
  sourceConfidence: 0.9,
});

describe('knockoutCompetitiveSpirit', () => {
  it('assigns high must-win intensity for elimination rounds', () => {
    const snap = buildKnockoutCompetitiveSpirit(
      'Final',
      stubTeam('h', 5),
      stubTeam('a', 6),
    );
    expect(snap.roundIntensity).toBe(1);
    expect(snap.homeSpirit).toBeGreaterThan(0.9);
    expect(snap.awaySpirit).toBeGreaterThan(0.9);
    expect(snap.mustWinIntensity).toBeGreaterThan(0.85);
  });

  it('boosts attack and dampens draws under knockout spirit', () => {
    const snapshot = buildKnockoutCompetitiveSpirit(
      'Round of 32',
      stubTeam('h', 12),
      stubTeam('a', 40, 0.1),
    );
    const mod = knockoutCompetitiveSpiritModifier(snapshot, CALIBRATION);
    expect(mod.home).toBeGreaterThan(1);
    expect(mod.away).toBeGreaterThan(1);
    expect(mod.drawInflationAdjust).toBeLessThan(0);
  });

  it('lowers draw probability vs group baseline for knockout fixtures', async () => {
    const group = await computeProbability({
      ...knockoutBase(),
      stage: 'Group',
    });
    const knockout = await computeProbability({
      ...knockoutBase(),
      knockoutCompetitiveSpirit: buildKnockoutCompetitiveSpirit(
        'Round of 32',
        knockoutBase().homeTeam,
        knockoutBase().awayTeam,
      ),
    });

    expect(knockout.drawProb).toBeLessThan(group.drawProb);
    expect(knockout.expectedHomeGoals).toBeGreaterThan(group.expectedHomeGoals);
    expect(knockout.expectedAwayGoals).toBeGreaterThan(group.expectedAwayGoals);
    expect(knockout.homeWinProb + knockout.drawProb + knockout.awayWinProb).toBeCloseTo(1, 5);
  });
});
