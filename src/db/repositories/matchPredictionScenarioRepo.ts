import type { MatchPredictionScenario, MatchScenarioSet, ScenarioComparison } from '../../models/scenarios/types';
import { newId } from '../../utils/ids';

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type ScenarioRow = {
  id: string;
  match_id: string;
  scenario_type: string;
  scenario_name: string;
  scenario_rank: number;
  is_baseline: number;
  initial_conditions_json: string;
  trigger_conditions_json: string | null;
  invalidation_conditions_json: string | null;
  scenario_probability: number;
  scenario_confidence: number;
  home_win_prob: number | null;
  draw_prob: number | null;
  away_win_prob: number | null;
  expected_home_goals: number | null;
  expected_away_goals: number | null;
  most_likely_score: string | null;
  scoreline_distribution_json: string | null;
  interval_distribution_json: string | null;
  key_drivers_json: string | null;
  risk_factors_json: string | null;
  explanation_json: string | null;
  model_version: string;
  input_hash: string;
  feature_snapshot_r2_key: string | null;
  status: string;
  generated_at: string;
  updated_at: string;
};

function rowToScenario(row: ScenarioRow): MatchPredictionScenario {
  return {
    id: row.id,
    matchId: row.match_id,
    scenarioType: row.scenario_type as MatchPredictionScenario['scenarioType'],
    scenarioName: row.scenario_name,
    scenarioRank: row.scenario_rank,
    isBaseline: row.is_baseline === 1,
    initialConditions: parseJson(row.initial_conditions_json, []),
    triggerConditions: parseJson(row.trigger_conditions_json, []),
    invalidationConditions: parseJson(row.invalidation_conditions_json, []),
    scenarioProbability: row.scenario_probability,
    scenarioConfidence: row.scenario_confidence,
    homeWinProb: row.home_win_prob ?? 0,
    drawProb: row.draw_prob ?? 0,
    awayWinProb: row.away_win_prob ?? 0,
    expectedHomeGoals: row.expected_home_goals ?? 0,
    expectedAwayGoals: row.expected_away_goals ?? 0,
    mostLikelyScore: row.most_likely_score ?? '1-1',
    scorelineDistribution: parseJson(row.scoreline_distribution_json, {}),
    intervalDistribution: parseJson<MatchPredictionScenario['intervalDistribution']>(row.interval_distribution_json, {
      '15': { homeWinProb: 0, drawProb: 0, awayWinProb: 0, topScorelines: [] },
      '30': { homeWinProb: 0, drawProb: 0, awayWinProb: 0, topScorelines: [] },
      '45': { homeWinProb: 0, drawProb: 0, awayWinProb: 0, topScorelines: [] },
      '60': { homeWinProb: 0, drawProb: 0, awayWinProb: 0, topScorelines: [] },
      '75': { homeWinProb: 0, drawProb: 0, awayWinProb: 0, topScorelines: [] },
      '90': { homeWinProb: 0, drawProb: 0, awayWinProb: 0, topScorelines: [] },
    }),
    keyDrivers: parseJson(row.key_drivers_json, []),
    riskFactors: parseJson(row.risk_factors_json, []),
    featureSelection: (() => {
      const parsed = parseJson<{ featureSelection?: MatchPredictionScenario['featureSelection'] }>(
        row.explanation_json,
        {},
      );
      return (
        parsed.featureSelection ?? {
          scenarioType: row.scenario_type as MatchPredictionScenario['scenarioType'],
          selectedFeatureGroups: [],
          requiredInputs: [],
          optionalInputs: [],
          missingInputs: [],
          inputQualityScore: 0.5,
          confidencePenalty: 0,
          reason: [],
        }
      );
    })(),
    modelVersion: row.model_version,
    inputHash: row.input_hash,
    featureSnapshotR2Key: row.feature_snapshot_r2_key ?? '',
    status: row.status as MatchPredictionScenario['status'],
    updatedAt: row.updated_at,
  };
}

export async function replaceMatchScenarioSet(
  db: D1Database,
  matchId: string,
  scenarios: MatchPredictionScenario[],
  comparison: ScenarioComparison,
): Promise<void> {
  await db.prepare('DELETE FROM scenario_comparisons WHERE match_id = ?').bind(matchId).run();
  await db.prepare('DELETE FROM scenario_probability_snapshots WHERE match_id = ?').bind(matchId).run();
  await db.prepare('DELETE FROM match_prediction_scenarios WHERE match_id = ?').bind(matchId).run();

  for (const s of scenarios) {
    await db
      .prepare(
        `INSERT INTO match_prediction_scenarios (
          id, match_id, scenario_type, scenario_name, scenario_rank, is_baseline,
          initial_conditions_json, trigger_conditions_json, invalidation_conditions_json,
          scenario_probability, scenario_confidence,
          home_win_prob, draw_prob, away_win_prob,
          expected_home_goals, expected_away_goals, most_likely_score,
          scoreline_distribution_json, interval_distribution_json,
          key_drivers_json, risk_factors_json, explanation_json,
          model_version, input_hash, feature_snapshot_r2_key, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        s.id,
        matchId,
        s.scenarioType,
        s.scenarioName,
        s.scenarioRank,
        s.isBaseline ? 1 : 0,
        JSON.stringify(s.initialConditions),
        JSON.stringify(s.triggerConditions),
        JSON.stringify(s.invalidationConditions),
        s.scenarioProbability,
        s.scenarioConfidence,
        s.homeWinProb,
        s.drawProb,
        s.awayWinProb,
        s.expectedHomeGoals,
        s.expectedAwayGoals,
        s.mostLikelyScore,
        JSON.stringify(s.scorelineDistribution),
        JSON.stringify(s.intervalDistribution),
        JSON.stringify(s.keyDrivers),
        JSON.stringify(s.riskFactors),
        JSON.stringify({ featureSelection: s.featureSelection }),
        s.modelVersion,
        s.inputHash,
        s.featureSnapshotR2Key,
        s.status,
        s.updatedAt,
      )
      .run();
  }

  await db
    .prepare(
      `INSERT INTO scenario_comparisons (
        id, match_id, scenario_a_id, scenario_b_id,
        probability_gap, confidence_gap,
        home_win_delta, draw_delta, away_win_delta, xg_home_delta, xg_away_delta,
        comparison_summary, comparison_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId('cmp'),
      matchId,
      comparison.primaryScenarioId,
      comparison.alternativeScenarioId,
      comparison.probabilityGap,
      comparison.confidenceGap,
      comparison.homeWinDelta,
      comparison.drawDelta,
      comparison.awayWinDelta,
      comparison.xgHomeDelta,
      comparison.xgAwayDelta,
      comparison.summary,
      JSON.stringify({ keyDifferences: comparison.keyDifferences }),
    )
    .run();
}

export async function listActiveScenariosForMatch(
  db: D1Database,
  matchId: string,
): Promise<MatchPredictionScenario[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM match_prediction_scenarios
       WHERE match_id = ? AND status = 'active'
       ORDER BY scenario_rank ASC`,
    )
    .bind(matchId)
    .all<ScenarioRow>();
  return (results ?? []).map(rowToScenario);
}

export async function getScenarioById(db: D1Database, scenarioId: string) {
  const row = await db
    .prepare('SELECT * FROM match_prediction_scenarios WHERE id = ?')
    .bind(scenarioId)
    .first<ScenarioRow>();
  return row ? rowToScenario(row) : null;
}

export async function getLatestComparison(db: D1Database, matchId: string): Promise<ScenarioComparison | null> {
  const row = await db
    .prepare(
      `SELECT * FROM scenario_comparisons WHERE match_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(matchId)
    .first<{
      scenario_a_id: string;
      scenario_b_id: string;
      probability_gap: number;
      confidence_gap: number;
      home_win_delta: number;
      draw_delta: number;
      away_win_delta: number;
      xg_home_delta: number;
      xg_away_delta: number;
      comparison_summary: string;
      comparison_json: string | null;
    }>();

  if (!row) return null;
  const extra = parseJson(row.comparison_json, { keyDifferences: [] as string[] });
  return {
    primaryScenarioId: row.scenario_a_id,
    alternativeScenarioId: row.scenario_b_id,
    probabilityGap: row.probability_gap,
    confidenceGap: row.confidence_gap,
    summary: row.comparison_summary,
    keyDifferences: extra.keyDifferences ?? [],
    homeWinDelta: row.home_win_delta,
    drawDelta: row.draw_delta,
    awayWinDelta: row.away_win_delta,
    xgHomeDelta: row.xg_home_delta,
    xgAwayDelta: row.xg_away_delta,
  };
}

export async function saveScenarioSnapshot(
  db: D1Database,
  scenario: MatchPredictionScenario,
  input: {
    minute: number;
    second?: number;
    deltaFromPrevious: number;
    updateReason: string;
    eventId?: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO scenario_probability_snapshots (
        id, scenario_id, match_id, minute, second,
        scenario_probability, home_win_prob, draw_prob, away_win_prob,
        expected_home_goals, expected_away_goals,
        delta_from_previous, update_reason, realtime_event_id,
        model_version, input_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId('snp'),
      scenario.id,
      scenario.matchId,
      input.minute,
      input.second ?? 0,
      scenario.scenarioProbability,
      scenario.homeWinProb,
      scenario.drawProb,
      scenario.awayWinProb,
      scenario.expectedHomeGoals,
      scenario.expectedAwayGoals,
      input.deltaFromPrevious,
      input.updateReason,
      input.eventId ?? null,
      scenario.modelVersion,
      scenario.inputHash,
    )
    .run();
}

export async function archiveScenario(db: D1Database, scenarioId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE match_prediction_scenarios SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(scenarioId)
    .run();
}
