import type { AppEnv } from '../../env';
import type { MatchRow, TeamRow } from '../../db/schema';
import { brierScore, logLoss } from './metrics';
import {
  actualScoreProbability,
  scorelineLogLoss,
  scorelineTop1Hit,
  scorelineTopKHit,
} from './scorelineMetrics';
import {
  favoriteOutcome,
  outcomeFromScore,
  outcomeVector,
} from '../../services/predictionAccuracy';
import { buildMatchFeaturesWithForm } from '../../services/matchFeatures';
import * as teamsRepo from '../../db/repositories/teamsRepo';
import { computeProbability, type ProbabilityEngineMode } from '../probability/engine';
import type { CalibrationOverrides } from '../probability/calibration';

export type OfflineBacktestMatch = {
  id: string;
  tournamentYear: number;
  homeScore: number;
  awayScore: number;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  tournamentId: string;
};

export type OfflineBacktestSample = {
  matchId: string;
  tournamentYear: number;
  actualScore: string;
  mostLikelyScore: string;
  favoriteHit: boolean;
  scorelineTop1Hit: boolean;
  scorelineTop3Hit: boolean;
  actualScoreProb: number;
  brierScore: number;
  logLoss: number;
  modelVersion: string;
  favoriteProb: number;
};

export type OfflineBacktestReport = {
  modelVersion: string;
  evaluatedAt: string;
  years: number[];
  matchCount: number;
  favoriteHitRate: number | null;
  scorelineTop1Rate: number | null;
  scorelineTop3Rate: number | null;
  avgBrier: number | null;
  avgActualScoreProb: number | null;
  avgLogLoss: number | null;
  calibrationBuckets: { bucket: string; predicted: number; actual: number; n: number }[];
  samples: OfflineBacktestSample[];
};

type LoadedMatch = OfflineBacktestMatch & {
  match: MatchRow;
  home: TeamRow;
  away: TeamRow;
};

export async function loadOfflineBacktestMatches(
  db: D1Database,
  years: number[],
): Promise<OfflineBacktestMatch[]> {
  const placeholders = years.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `SELECT m.id, m.home_score, m.away_score, m.status, m.home_team_id, m.away_team_id,
              m.tournament_id, t.year AS tournament_year
       FROM matches m
       JOIN tournaments t ON t.id = m.tournament_id
       WHERE t.year IN (${placeholders})
         AND m.status IN ('completed', 'finished')
       ORDER BY m.kickoff_utc ASC`,
    )
    .bind(...years)
    .all<{
      id: string;
      home_score: number;
      away_score: number;
      status: string;
      home_team_id: string;
      away_team_id: string;
      tournament_id: string;
      tournament_year: number;
    }>();

  return (results ?? []).map((row) => ({
    id: row.id,
    tournamentYear: row.tournament_year,
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    tournamentId: row.tournament_id,
  }));
}

async function loadMatchBundle(
  env: AppEnv,
  row: OfflineBacktestMatch,
): Promise<LoadedMatch | null> {
  const match = await env.DB.prepare(`SELECT * FROM matches WHERE id = ?`)
    .bind(row.id)
    .first<MatchRow>();
  if (!match) return null;
  const home = await teamsRepo.getTeam(env.DB, match.home_team_id);
  const away = await teamsRepo.getTeam(env.DB, match.away_team_id);
  if (!home || !away) return null;
  return { ...row, match, home, away };
}

export async function evaluateOfflineMatch(
  env: AppEnv,
  row: OfflineBacktestMatch,
  calibrationOverrides?: CalibrationOverrides,
  engineMode: ProbabilityEngineMode = 'v5',
): Promise<OfflineBacktestSample | null> {
  const bundle = await loadMatchBundle(env, row);
  if (!bundle) return null;

  const features = await buildMatchFeaturesWithForm(
    env,
    bundle.match,
    bundle.home,
    bundle.away,
    bundle.tournamentYear,
  );
  const result = await computeProbability(features, calibrationOverrides, { mode: engineMode });
  const actualScore = `${row.homeScore}-${row.awayScore}`;
  const actualOutcome = outcomeFromScore(row.homeScore, row.awayScore);
  const predictedOutcome = favoriteOutcome(
    result.homeWinProb,
    result.drawProb,
    result.awayWinProb,
  );
  const predicted = [result.homeWinProb, result.drawProb, result.awayWinProb];
  const actual = outcomeVector(actualOutcome);
  const favoriteProb = Math.max(...predicted);

  return {
    matchId: row.id,
    tournamentYear: row.tournamentYear,
    actualScore,
    mostLikelyScore: result.mostLikelyScore,
    favoriteHit: predictedOutcome === actualOutcome,
    scorelineTop1Hit: scorelineTop1Hit(result.scorelineDistribution, actualScore),
    scorelineTop3Hit: scorelineTopKHit(result.scorelineDistribution, actualScore, 3),
    actualScoreProb: actualScoreProbability(result.scorelineDistribution, actualScore),
    brierScore: brierScore(predicted, actual),
    logLoss: logLoss(predicted, actual.indexOf(1)),
    modelVersion: result.modelVersion,
    favoriteProb,
  };
}

export function aggregateOfflineBacktest(
  samples: OfflineBacktestSample[],
  years: number[],
): OfflineBacktestReport {
  const n = samples.length;
  const buckets = new Map<string, { predicted: number; actual: number; n: number }>();

  for (const s of samples) {
    const bucketKey = ['0-0.45', '0.45-0.6', '0.6-1.0'][
      Number(s.favoriteProb >= 0.45) + Number(s.favoriteProb >= 0.6)
    ];
    const b = buckets.get(bucketKey) ?? { predicted: 0, actual: 0, n: 0 };
    b.predicted += s.favoriteProb;
    b.actual += s.favoriteHit ? 1 : 0;
    b.n += 1;
    buckets.set(bucketKey, b);
  }

  const favoriteHits = samples.filter((s) => s.favoriteHit).length;
  const top1 = samples.filter((s) => s.scorelineTop1Hit).length;
  const top3 = samples.filter((s) => s.scorelineTop3Hit).length;
  const brierSum = samples.reduce((sum, s) => sum + s.brierScore, 0);
  const probSum = samples.reduce((sum, s) => sum + s.actualScoreProb, 0);
  const llSum = samples.reduce((sum, s) => sum + s.logLoss, 0);

  return {
    modelVersion: samples[0]?.modelVersion ?? 'unknown',
    evaluatedAt: new Date().toISOString(),
    years,
    matchCount: n,
    favoriteHitRate: n ? favoriteHits / n : null,
    scorelineTop1Rate: n ? top1 / n : null,
    scorelineTop3Rate: n ? top3 / n : null,
    avgBrier: n ? brierSum / n : null,
    avgActualScoreProb: n ? probSum / n : null,
    avgLogLoss: n ? llSum / n : null,
    calibrationBuckets: [...buckets.entries()].map(([bucket, v]) => ({
      bucket,
      predicted: v.predicted / v.n,
      actual: v.actual / v.n,
      n: v.n,
    })),
    samples,
  };
}

export async function runOfflineBacktestFromEnv(
  env: AppEnv,
  years: number[],
  calibrationOverrides?: CalibrationOverrides,
  limit?: number,
  engineMode: ProbabilityEngineMode = 'v5',
): Promise<OfflineBacktestReport> {
  const rows = await loadOfflineBacktestMatches(env.DB, years);
  const slice = limit ? rows.slice(0, limit) : rows;
  const samples: OfflineBacktestSample[] = [];

  for (const row of slice) {
    const sample = await evaluateOfflineMatch(env, row, calibrationOverrides, engineMode);
    if (sample) samples.push(sample);
    if (samples.length > 0 && samples.length % 10 === 0) {
      console.log(`  evaluated ${samples.length}/${slice.length} matches`);
    }
  }

  return aggregateOfflineBacktest(samples, years);
}
