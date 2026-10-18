import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import { brierScore } from '../models/backtesting/metrics';
import {
  actualScoreProbability,
  scorelineTop1Hit,
  scorelineTopKHit,
} from '../models/backtesting/scorelineMetrics';
import type { ProbabilitySnapshotRow } from '../db/schema';

export type PredictionOutcome = 'home' | 'draw' | 'away';

export type MatchPredictionEvaluation = {
  matchId: string;
  kickoffUtc: string;
  homeName: string;
  awayName: string;
  actualScore: string;
  predictedOutcome: PredictionOutcome;
  actualOutcome: PredictionOutcome;
  favoriteHit: boolean;
  predictedScore: string | null;
  scorelineHit: boolean;
  scorelineTop3Hit: boolean;
  actualScoreProb: number;
  brierScore: number;
  modelVersion: string;
  predictedProbs: { home: number; draw: number; away: number };
};

export type PredictionAccuracyReport = {
  tournamentYear: 2026;
  evaluatedAt: string;
  completedTotal: number;
  completedWithSnapshot: number;
  favoriteHits: number;
  favoriteHitRate: number | null;
  drawPredictions: number;
  drawHits: number;
  scorelineHits: number;
  scorelineHitRate: number | null;
  scorelineTop3Hits: number;
  scorelineTop3HitRate: number | null;
  avgBrier: number | null;
  avgActualScoreProb: number | null;
  modelVersions: Record<string, number>;
  recent: MatchPredictionEvaluation[];
};

type MatchRow = {
  id: string;
  kickoff_utc: string;
  home_score: number;
  away_score: number;
  status: string;
  home_name: string;
  away_name: string;
};

export function outcomeFromScore(homeScore: number, awayScore: number): PredictionOutcome {
  if (homeScore > awayScore) return 'home';
  if (homeScore === awayScore) return 'draw';
  return 'away';
}

export function favoriteOutcome(homeWin: number, draw: number, awayWin: number): PredictionOutcome {
  if (homeWin >= draw && homeWin >= awayWin) return 'home';
  if (draw >= homeWin && draw >= awayWin) return 'draw';
  return 'away';
}

export function outcomeVector(outcome: PredictionOutcome): [number, number, number] {
  if (outcome === 'home') return [1, 0, 0];
  if (outcome === 'draw') return [0, 1, 0];
  return [0, 0, 1];
}

function normalizeScoreline(score: string | null | undefined): string | null {
  if (!score) return null;
  return score.replace(/\s+/g, '').replace(':', '-');
}

function parseScorelineJson(snap: ProbabilitySnapshotRow): Record<string, number> {
  if (!snap.scoreline_json) return {};
  try {
    return JSON.parse(snap.scoreline_json) as Record<string, number>;
  } catch {
    return {};
  }
}

export async function evaluateCompletedMatch(
  db: D1Database,
  match: MatchRow,
): Promise<MatchPredictionEvaluation | null> {
  const snap = await probabilityRepo.getPreMatchSnapshot(db, match.id);
  if (!snap) return null;

  const actualOutcome = outcomeFromScore(match.home_score, match.away_score);
  const predictedOutcome = favoriteOutcome(snap.home_win_prob, snap.draw_prob, snap.away_win_prob);
  const predicted = [snap.home_win_prob, snap.draw_prob, snap.away_win_prob];
  const actual = outcomeVector(actualOutcome);
  const predictedScore = normalizeScoreline(snap.most_likely_score);
  const actualScore = `${match.home_score}-${match.away_score}`;
  const matrix = parseScorelineJson(snap);

  return {
    matchId: match.id,
    kickoffUtc: match.kickoff_utc,
    homeName: match.home_name,
    awayName: match.away_name,
    actualScore,
    predictedOutcome,
    actualOutcome,
    favoriteHit: predictedOutcome === actualOutcome,
    predictedScore,
    scorelineHit: predictedScore === actualScore,
    scorelineTop3Hit: scorelineTopKHit(matrix, actualScore, 3),
    actualScoreProb: actualScoreProbability(matrix, actualScore),
    brierScore: brierScore(predicted, actual),
    modelVersion: snap.model_version,
    predictedProbs: {
      home: snap.home_win_prob,
      draw: snap.draw_prob,
      away: snap.away_win_prob,
    },
  };
}

export async function buildPredictionAccuracyReport(env: AppEnv): Promise<PredictionAccuracyReport> {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.kickoff_utc, m.home_score, m.away_score, m.status,
            ht.name AS home_name, at.name AS away_name
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     WHERE m.tournament_id = ?
       AND m.status IN ('completed', 'finished')
     ORDER BY m.kickoff_utc DESC`,
  )
    .bind(WC2026_TOURNAMENT_ID)
    .all<MatchRow>();

  const matches = results ?? [];
  const evaluations: MatchPredictionEvaluation[] = [];

  for (const match of matches) {
    const row = await evaluateCompletedMatch(env.DB, match);
    if (row) evaluations.push(row);
  }

  const favoriteHits = evaluations.filter((e) => e.favoriteHit).length;
  const drawPredictions = evaluations.filter((e) => e.predictedOutcome === 'draw').length;
  const drawHits = evaluations.filter((e) => e.predictedOutcome === 'draw' && e.actualOutcome === 'draw').length;
  const scorelineHits = evaluations.filter((e) => e.scorelineHit).length;
  const scorelineTop3Hits = evaluations.filter((e) => e.scorelineTop3Hit).length;
  const modelVersions: Record<string, number> = {};

  for (const e of evaluations) {
    modelVersions[e.modelVersion] = (modelVersions[e.modelVersion] ?? 0) + 1;
  }

  const withSnapshot = evaluations.length;
  const brierSum = evaluations.reduce((sum, e) => sum + e.brierScore, 0);
  const probSum = evaluations.reduce((sum, e) => sum + e.actualScoreProb, 0);

  return {
    tournamentYear: 2026,
    evaluatedAt: new Date().toISOString(),
    completedTotal: matches.length,
    completedWithSnapshot: withSnapshot,
    favoriteHits,
    favoriteHitRate: withSnapshot ? favoriteHits / withSnapshot : null,
    drawPredictions,
    drawHits,
    scorelineHits,
    scorelineHitRate: withSnapshot ? scorelineHits / withSnapshot : null,
    scorelineTop3Hits,
    scorelineTop3HitRate: withSnapshot ? scorelineTop3Hits / withSnapshot : null,
    avgBrier: withSnapshot ? brierSum / withSnapshot : null,
    avgActualScoreProb: withSnapshot ? probSum / withSnapshot : null,
    modelVersions,
    recent: evaluations.slice(0, 10),
  };
}
