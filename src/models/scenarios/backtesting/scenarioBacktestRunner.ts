import type { AppEnv } from '../../../env';
import { brierScore } from '../../backtesting/metrics';
import { aggregateScenarioMetrics } from './scenarioMetrics';
import { logInfo } from '../../../utils/logger';

type CompletedMatch = {
  id: string;
  home_score: number;
  away_score: number;
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
};

function actualOutcome(home: number, away: number): [number, number, number] {
  if (home > away) return [1, 0, 0];
  if (home === away) return [0, 1, 0];
  return [0, 0, 1];
}

export async function runScenarioBacktest(env: AppEnv, tournamentYear: number): Promise<{
  tournamentYear: number;
  matchCount: number;
  metrics: ReturnType<typeof aggregateScenarioMetrics>;
  calibrationBuckets: { bucket: string; predicted: number; actual: number; n: number }[];
}> {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.home_score, m.away_score,
            ps.home_win_prob, ps.draw_prob, ps.away_win_prob
     FROM matches m
     JOIN tournaments t ON t.id = m.tournament_id
     LEFT JOIN probability_snapshots ps ON ps.match_id = m.id
       AND ps.id = (
         SELECT id FROM probability_snapshots
         WHERE match_id = m.id ORDER BY minute ASC LIMIT 1
       )
     WHERE t.year = ? AND m.status = 'completed' AND ps.id IS NOT NULL`,
  )
    .bind(tournamentYear)
    .all<CompletedMatch>();

  const rows = results;
  const samples: {
    scenarioHitRate: number;
    scenarioBrierScore: number;
    scenarioCalibrationError: number;
    scenarioRankAccuracy: number;
  }[] = [];

  const buckets = new Map<string, { predicted: number; actual: number; n: number }>();

  for (const m of rows) {
    const predicted = [m.home_win_prob, m.draw_prob, m.away_win_prob];
    const actual = actualOutcome(m.home_score, m.away_score);
    const brier = brierScore(predicted, actual);
    const hit = Number(predicted.indexOf(Math.max(...predicted)) === actual.indexOf(1));
    const favProb = Math.max(...predicted);
    const bucketKey = ['0-0.45', '0.45-0.6', '0.6-1.0'][Number(favProb >= 0.45) + Number(favProb >= 0.6)];
    const b = buckets.get(bucketKey) ?? { predicted: 0, actual: 0, n: 0 };
    b.predicted += favProb;
    b.actual += hit;
    b.n += 1;
    buckets.set(bucketKey, b);

    samples.push({
      scenarioHitRate: hit,
      scenarioBrierScore: brier,
      scenarioCalibrationError: Math.abs(favProb - hit),
      scenarioRankAccuracy: hit,
    });
  }

  const metrics = aggregateScenarioMetrics(samples);
  const calibrationBuckets = [...buckets.entries()].map(([bucket, v]) => ({
    bucket,
    predicted: v.predicted / v.n,
    actual: v.actual / v.n,
    n: v.n,
  }));

  const report = {
    tournamentYear,
    matchCount: rows.length,
    metrics,
    calibrationBuckets,
    status: rows.length ? 'completed' : 'no_data',
  };

  logInfo('scenario backtest complete', {
    tournamentYear,
    matchCount: rows.length,
    brier: metrics.scenarioBrierScore,
    status: rows.length ? 'completed' : 'no_data',
  });

  await env.R2_ARTIFACTS.put(
    `backtests/scenarios/${tournamentYear}-${Date.now()}.json`,
    JSON.stringify(report),
    { httpMetadata: { contentType: 'application/json' } },
  );

  await env.DB.prepare(
    `INSERT INTO model_runs (id, model_name, model_version, run_type, metrics_json, status)
     VALUES (?, 'wc-scenario', 'scenario-v1', 'scenario_backtest', ?, ?)`,
  )
    .bind(`scenario-backtest-${tournamentYear}-${Date.now()}`, JSON.stringify(report), 'completed')
    .run();

  return report;
}
