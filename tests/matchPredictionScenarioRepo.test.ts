import { describe, expect, it } from 'vitest';
import {
  archiveScenario,
  getLatestComparison,
  getScenarioById,
  listActiveScenariosForMatch,
  replaceMatchScenarioSet,
  saveScenarioSnapshot,
} from '../src/db/repositories/matchPredictionScenarioRepo';
import { createMockDb } from './helpers/mockEnv';
import { mockComparison, mockScenario } from './helpers/scenarioFixtures';

describe('matchPredictionScenarioRepo', () => {
  it('replaceMatchScenarioSet deletes and inserts scenarios plus comparison', async () => {
    const runCalls: string[] = [];
    const db = createMockDb({
      run: (sql) => {
        runCalls.push(sql);
        return { success: true };
      },
    });

    const scenario = mockScenario();
    await replaceMatchScenarioSet(db, 'm-1', [scenario], mockComparison());

    expect(runCalls.some((sql) => sql.includes('DELETE FROM match_prediction_scenarios'))).toBe(true);
    expect(runCalls.some((sql) => sql.includes('INSERT INTO match_prediction_scenarios'))).toBe(true);
    expect(runCalls.some((sql) => sql.includes('INSERT INTO scenario_comparisons'))).toBe(true);
  });

  it('listActiveScenariosForMatch maps rows to scenario objects', async () => {
    const scenario = mockScenario({ id: 'mps-row' });
    const row = {
      id: scenario.id,
      match_id: scenario.matchId,
      scenario_type: scenario.scenarioType,
      scenario_name: scenario.scenarioName,
      scenario_rank: scenario.scenarioRank,
      is_baseline: 1,
      initial_conditions_json: JSON.stringify(scenario.initialConditions),
      trigger_conditions_json: JSON.stringify(scenario.triggerConditions),
      invalidation_conditions_json: JSON.stringify(scenario.invalidationConditions),
      scenario_probability: scenario.scenarioProbability,
      scenario_confidence: scenario.scenarioConfidence,
      home_win_prob: scenario.homeWinProb,
      draw_prob: scenario.drawProb,
      away_win_prob: scenario.awayWinProb,
      expected_home_goals: scenario.expectedHomeGoals,
      expected_away_goals: scenario.expectedAwayGoals,
      most_likely_score: scenario.mostLikelyScore,
      scoreline_distribution_json: JSON.stringify(scenario.scorelineDistribution),
      interval_distribution_json: JSON.stringify(scenario.intervalDistribution),
      key_drivers_json: JSON.stringify(scenario.keyDrivers),
      risk_factors_json: JSON.stringify(scenario.riskFactors),
      explanation_json: JSON.stringify({ featureSelection: scenario.featureSelection }),
      model_version: scenario.modelVersion,
      input_hash: scenario.inputHash,
      feature_snapshot_r2_key: scenario.featureSnapshotR2Key,
      status: scenario.status,
      generated_at: scenario.updatedAt,
      updated_at: scenario.updatedAt,
    };

    const db = createMockDb({
      all: () => ({ results: [row] }),
    });

    const scenarios = await listActiveScenariosForMatch(db, 'm-1');
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]?.id).toBe('mps-row');
    expect(scenarios[0]?.isBaseline).toBe(true);
  });

  it('getScenarioById returns null when missing', async () => {
    const db = createMockDb({ first: () => null });
    expect(await getScenarioById(db, 'missing')).toBeNull();
  });

  it('listActiveScenariosForMatch returns [] when results omitted', async () => {
    const db = createMockDb({ all: () => ({}) });
    expect(await listActiveScenariosForMatch(db, 'm-1')).toEqual([]);
  });

  it('getLatestComparison maps empty keyDifferences', async () => {
    const db = createMockDb({
      first: () => ({
        scenario_a_id: 'a',
        scenario_b_id: 'b',
        probability_gap: 0.1,
        confidence_gap: 0.05,
        home_win_delta: 0.02,
        draw_delta: -0.01,
        away_win_delta: -0.01,
        xg_home_delta: 0.1,
        xg_away_delta: -0.05,
        comparison_summary: 'Summary',
        comparison_json: JSON.stringify({ keyDifferences: ['delta xG'] }),
      }),
    });
    const comparison = await getLatestComparison(db, 'm-1');
    expect(comparison?.keyDifferences).toContain('delta xG');
  });

  it('saveScenarioSnapshot inserts probability snapshot row', async () => {
    const runCalls: string[] = [];
    const db = createMockDb({
      run: (sql) => {
        runCalls.push(sql);
        return { success: true };
      },
    });
    await saveScenarioSnapshot(db, mockScenario(), {
      minute: 15,
      deltaFromPrevious: 0.02,
      updateReason: 'goal',
      eventId: 'evt-1',
    });
    expect(runCalls.some((sql) => sql.includes('INSERT INTO scenario_probability_snapshots'))).toBe(true);
  });

  it('archiveScenario updates status', async () => {
    const runCalls: string[] = [];
    const db = createMockDb({
      run: (sql) => {
        runCalls.push(sql);
        return { success: true };
      },
    });
    await archiveScenario(db, 'mps-1');
    expect(runCalls.some((sql) => sql.includes("status = 'archived'"))).toBe(true);
  });
});
