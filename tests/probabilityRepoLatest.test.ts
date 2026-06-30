import { describe, expect, it } from 'vitest';
import { listLatestSnapshotsForTournament } from '../src/db/repositories/probabilityRepo';
import { createMockDb } from './helpers/mockEnv';

describe('listLatestSnapshotsForTournament', () => {
  it('orders by minute then created_at, not lexicographic snapshot id', async () => {
    let sql = '';
    const db = createMockDb({
      all: (query) => {
        sql = query;
        return {
          results: [
            { matchId: 'm-w26-r32-03', homeWinProb: 0.27, drawProb: 0.42, awayWinProb: 0.31 },
          ],
        };
      },
    });

    const rows = await listLatestSnapshotsForTournament(db, 't-2026');
    expect(rows[0]?.drawProb).toBe(0.42);
    expect(sql).toContain('ORDER BY ps2.minute DESC, ps2.second DESC, ps2.created_at DESC');
    expect(sql).not.toContain('MAX(id)');
  });
});
