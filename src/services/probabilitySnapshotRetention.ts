import type { AppEnv } from '../env';

const DEFAULT_KEEP_PER_MATCH = 5;

/** Drop old probability snapshots; keep the newest N rows per match. */
export async function pruneProbabilitySnapshots(
  db: D1Database,
  keepPerMatch = DEFAULT_KEEP_PER_MATCH,
): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT match_id AS matchId, COUNT(*) AS n
       FROM probability_snapshots
       GROUP BY match_id
       HAVING n > ?`,
    )
    .bind(keepPerMatch)
    .all<{ matchId: string; n: number }>();

  let removed = 0;
  for (const row of results ?? []) {
    const { meta } = await db
      .prepare(
        `DELETE FROM probability_snapshots
         WHERE match_id = ?
           AND id NOT IN (
             SELECT id FROM probability_snapshots
             WHERE match_id = ?
             ORDER BY id DESC
             LIMIT ?
           )`,
      )
      .bind(row.matchId, row.matchId, keepPerMatch)
      .run();
    removed += meta.changes ?? 0;
  }
  return removed;
}

export async function runProbabilitySnapshotRetention(env: AppEnv): Promise<number> {
  return pruneProbabilitySnapshots(env.DB);
}
