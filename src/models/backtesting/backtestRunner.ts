import { brierScore, logLoss } from './metrics';
import {
  actualScoreProbability,
  scorelineTop1Hit,
  scorelineTopKHit,
} from './scorelineMetrics';
import {
  favoriteOutcome,
  outcomeFromScore,
  outcomeVector,
} from '../../services/predictionAccuracy';

const HISTORICAL_YEARS = [2006, 2010, 2014, 2018, 2022];

function parseScorelineJson(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

export async function runBacktest(db: D1Database) {
  const { results: matches } = await db
    .prepare(
      `SELECT m.*, t.year FROM matches m
       JOIN tournaments t ON t.id = m.tournament_id
       WHERE t.year IN (${HISTORICAL_YEARS.join(',')}) AND m.status = 'completed'`,
    )
    .all();

  const rows = matches ?? [];
  let brierSum = 0;
  let logLossSum = 0;
  let count = 0;
  let scorelineTop1Hits = 0;
  let scorelineTop3Hits = 0;
  let actualProbSum = 0;
  const buckets = new Map<string, { predicted: number; actual: number; n: number }>();

  for (const m of rows) {
    const snap = await db
      .prepare(
        `SELECT * FROM probability_snapshots WHERE match_id = ? ORDER BY minute ASC, created_at ASC LIMIT 1`,
      )
      .bind((m as { id: string }).id)
      .first<{
        home_win_prob: number;
        draw_prob: number;
        away_win_prob: number;
        most_likely_score: string | null;
        scoreline_json: string | null;
      }>();
    if (!snap) continue;
    const home = (m as { home_score: number }).home_score;
    const away = (m as { away_score: number }).away_score;
    const actualScore = `${home}-${away}`;
    const actualOutcome = outcomeFromScore(home, away);
    const predictedOutcome = favoriteOutcome(snap.home_win_prob, snap.draw_prob, snap.away_win_prob);
    const actual = outcomeVector(actualOutcome);
    const predicted = [snap.home_win_prob, snap.draw_prob, snap.away_win_prob];
    const matrix = parseScorelineJson(snap.scoreline_json);

    brierSum += brierScore(predicted, actual);
    logLossSum += logLoss(predicted, actual.indexOf(1));
    if (scorelineTop1Hit(matrix, actualScore)) scorelineTop1Hits += 1;
    if (scorelineTopKHit(matrix, actualScore, 3)) scorelineTop3Hits += 1;
    actualProbSum += actualScoreProbability(matrix, actualScore);

    const favProb = Math.max(...predicted);
    const bucketKey = ['0-0.45', '0.45-0.6', '0.6-1.0'][
      Number(favProb >= 0.45) + Number(favProb >= 0.6)
    ];
    const b = buckets.get(bucketKey) ?? { predicted: 0, actual: 0, n: 0 };
    b.predicted += favProb;
    b.actual += predictedOutcome === actualOutcome ? 1 : 0;
    b.n += 1;
    buckets.set(bucketKey, b);
    count++;
  }

  const metrics = {
    tournaments: HISTORICAL_YEARS,
    matchCount: count,
    brierScore: count ? brierSum / count : null,
    logLoss: count ? logLossSum / count : null,
    scorelineTop1: count ? scorelineTop1Hits / count : null,
    scorelineTop3: count ? scorelineTop3Hits / count : null,
    avgActualScoreProb: count ? actualProbSum / count : null,
    calibrationBuckets: [...buckets.entries()].map(([bucket, v]) => ({
      bucket,
      predicted: v.predicted / v.n,
      actual: v.actual / v.n,
      n: v.n,
    })),
  };

  await db
    .prepare(
      `INSERT INTO model_runs (id, model_name, model_version, run_type, metrics_json, status)
       VALUES (?, 'wc-prob', 'wc-prob-v5', 'backtest', ?, 'completed')`,
    )
    .bind(`backtest-${Date.now()}`, JSON.stringify(metrics))
    .run();

  return metrics;
}
