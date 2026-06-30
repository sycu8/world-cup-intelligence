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
       WHERE ps.match_id IN (SELECT id FROM matches WHERE tournament_id = ?)
         AND ps.id = (
           SELECT ps2.id
           FROM probability_snapshots ps2
           WHERE ps2.match_id = ps.match_id
           ORDER BY ps2.minute DESC, ps2.second DESC, ps2.created_at DESC
           LIMIT 1
         )`,
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

/** Earliest pre-match style snapshot — prefer minute 0, else oldest recorded. */
export async function getPreMatchSnapshot(
  db: D1Database,
  matchId: string,
): Promise<ProbabilitySnapshotRow | null> {
  return db
    .prepare(
      `SELECT * FROM probability_snapshots
       WHERE match_id = ?
       ORDER BY CASE WHEN minute = 0 THEN 0 ELSE 1 END, minute ASC, second ASC, created_at ASC
       LIMIT 1`,
    )
    .bind(matchId)
    .first<ProbabilitySnapshotRow>();
}

/** Snapshot for public API — live uses latest minute; completed uses kickoff (minute 0) only. */
export async function getDisplaySnapshot(
  db: D1Database,
  matchId: string,
  status: string,
): Promise<ProbabilitySnapshotRow | null> {
  if (status === 'live') {
    return getLatestSnapshot(db, matchId);
  }
  if (status === 'completed') {
    const pre = await getPreMatchSnapshot(db, matchId);
    if (pre && (pre.minute ?? 0) === 0) return pre;
    return null;
  }
  return getLatestSnapshot(db, matchId);
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
