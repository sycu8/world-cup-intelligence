import { describe, it, expect } from 'vitest';
import {
  buildGroupPointsPressure,
  groupPointsPressureModifier,
} from '../src/models/probability/groupPointsPressure';
import { computeProbability } from '../src/models/probability/engine';
import { CALIBRATION } from '../src/models/probability/calibration';
import type { GroupStageMatchRow } from '../src/services/tournamentProgression';
import type { MatchFeatureInput, TeamFeatures } from '../src/models/probability/types';

function row(
  group: string,
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
  status: string,
): GroupStageMatchRow {
  return {
    group_code: group,
    home_team_id: home,
    away_team_id: away,
    home_score: homeScore,
    away_score: awayScore,
    status,
  };
}

function stubTeam(id: string): TeamFeatures {
  return {
    teamId: id,
    eloRating: 1700,
    fifaRanking: 20,
    recentForm: 0.2,
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

const baseInput = (): MatchFeatureInput => ({
  matchId: 'm-test',
  tournamentYear: 2026,
  stage: 'Group',
  minute: 0,
  second: 0,
  homeTeam: stubTeam('team-home'),
  awayTeam: stubTeam('team-away'),
  currentScore: { home: 0, away: 0 },
  sourceConfidence: 0.9,
});

describe('groupPointsPressure', () => {
  it('returns zero pressure before any group match is completed', () => {
    const rows: GroupStageMatchRow[] = [
      row('A', 'team-home', 'team-away', 0, 0, 'scheduled'),
      row('A', 'team-home', 'team-c', 0, 0, 'scheduled'),
      row('A', 'team-away', 'team-d', 0, 0, 'scheduled'),
    ];
    const snap = buildGroupPointsPressure(rows, 'A', 'team-home', 'team-away');
    expect(snap?.groupProgress).toBe(0);
    expect(snap?.homePressure).toBe(0);
    expect(snap?.awayPressure).toBe(0);
  });

  it('ramps pressure for unplayed teams as the group progresses', () => {
    const rows: GroupStageMatchRow[] = [
      row('A', 'team-c', 'team-d', 2, 1, 'completed'),
      row('A', 'team-c', 'team-e', 1, 0, 'completed'),
      row('A', 'team-home', 'team-away', 0, 0, 'scheduled'),
      row('A', 'team-home', 'team-c', 0, 0, 'scheduled'),
      row('A', 'team-away', 'team-d', 0, 0, 'scheduled'),
      row('A', 'team-d', 'team-e', 0, 0, 'scheduled'),
    ];
    const snap = buildGroupPointsPressure(rows, 'A', 'team-home', 'team-away');
    expect(snap?.groupProgress).toBeCloseTo(2 / 6, 5);
    expect(snap?.homePressure).toBeGreaterThan(0.35);
    expect(snap?.awayPressure).toBeGreaterThan(0.35);
    expect(snap?.homePressure).toBe(snap?.awayPressure);
  });

  it('boosts attack lambdas and dampens draws under pressure', () => {
    const snapshot = {
      groupProgress: 0.66,
      homePressure: 0.8,
      awayPressure: 0.75,
    };
    const mod = groupPointsPressureModifier(snapshot, CALIBRATION);
    expect(mod.home).toBeCloseTo(1 + 0.8 * CALIBRATION.groupPointsPressureMax, 5);
    expect(mod.away).toBeCloseTo(1 + 0.75 * CALIBRATION.groupPointsPressureMax, 5);
    expect(mod.drawInflationAdjust).toBeLessThan(0);
  });

  it('shifts scheduled group probabilities when pressure is present', async () => {
    const baseline = await computeProbability(baseInput());
    const pressured = await computeProbability({
      ...baseInput(),
      groupPointsPressure: {
        groupProgress: 0.75,
        homePressure: 0.85,
        awayPressure: 0.8,
      },
    });

    expect(pressured.drawProb).toBeLessThan(baseline.drawProb);
    expect(pressured.expectedHomeGoals).toBeGreaterThan(baseline.expectedHomeGoals);
    expect(pressured.expectedAwayGoals).toBeGreaterThan(baseline.expectedAwayGoals);
    expect(
      pressured.homeWinProb + pressured.drawProb + pressured.awayWinProb,
    ).toBeCloseTo(1, 5);
  });
});
