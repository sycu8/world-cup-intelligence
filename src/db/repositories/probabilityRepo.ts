import type { ProbabilitySnapshotRow } from '../schema';
import type { ProbabilityResult } from '../../models/probability/types';
import { newId } from '../../utils/ids';

export async function listLatestSnapshotsForTournament(
  db: D1Database,
  tournamentId: string,
): Promise<
  Array<{
    matchId: string;
    homeWinProb: number;
    drawProb: number;
    awayWinProb: number;
  }>
> {
  const { results } = await db
    .prepare(
      `SELECT ps.match_id AS matchId, ps.home_win_prob AS homeWinProb,
              ps.draw_prob AS drawProb, ps.away_win_prob AS awayWinProb
       FROM probability_snapshots ps
       INNER JOIN (
         SELECT match_id, MAX(id) AS latest_id
         FROM probability_snapshots
         GROUP BY match_id
       ) latest ON latest.latest_id = ps.id
       INNER JOIN matches m ON m.id = ps.match_id
       WHERE m.tournament_id = ?`,
    )
    .bind(tournamentId)
    .all<{
      matchId: string;
      homeWinProb: number;
      drawProb: number;
      awayWinProb: number;
    }>();
  return results ?? [];
}

export async function getLatestSnapshot(
  db: D1Database,
  matchId: string,
): Promise<ProbabilitySnapshotRow | null> {
  return db
    .prepare(
      'SELECT * FROM probability_snapshots WHERE match_id = ? ORDER BY minute DESC, second DESC LIMIT 1',
    )
    .bind(matchId)
    .first<ProbabilitySnapshotRow>();
}

export async function saveSnapshot(db: D1Database, result: ProbabilityResult, r2Key?: string): Promise<string> {
  const id = newId('ps');
  await db
    .prepare(
      `INSERT INTO probability_snapshots (
        id, match_id, minute, second, home_win_prob, draw_prob, away_win_prob,
        expected_home_goals, expected_away_goals, most_likely_score, scoreline_json,
        interval_json, confidence, model_version, input_hash, feature_snapshot_r2_key, explanation_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      result.matchId,
      result.minute,
      result.second,
      result.homeWinProb,
      result.drawProb,
      result.awayWinProb,
      result.expectedHomeGoals,
      result.expectedAwayGoals,
      result.mostLikelyScore,
      JSON.stringify(result.scorelineDistribution),
      JSON.stringify(result.intervalDistribution),
      result.confidence,
      result.modelVersion,
      result.inputHash,
      r2Key ?? null,
      JSON.stringify({
        topPositiveFactors: result.topPositiveFactors,
        topNegativeFactors: result.topNegativeFactors,
      }),
    )
    .run();
  return id;
}
