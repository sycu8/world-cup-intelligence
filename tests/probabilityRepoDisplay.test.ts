import { describe, it, expect } from 'vitest';
import { getDisplaySnapshot } from '../src/db/repositories/probabilityRepo';
import type { ProbabilitySnapshotRow } from '../src/db/schema';

function mockDb(rows: ProbabilitySnapshotRow[]) {
  return {
    prepare: (sql: string) => ({
      bind: (matchId: string) => ({
        first: async () => {
          const forMatch = rows.filter((r) => r.match_id === matchId);
          if (sql.includes('minute DESC')) {
            return [...forMatch].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0))[0] ?? null;
          }
          if (sql.includes('CASE WHEN minute = 0')) {
            const sorted = [...forMatch].sort((a, b) => {
              const a0 = (a.minute ?? 0) === 0 ? 0 : 1;
              const b0 = (b.minute ?? 0) === 0 ? 0 : 1;
              if (a0 !== b0) return a0 - b0;
              return (a.minute ?? 0) - (b.minute ?? 0);
            });
            return sorted[0] ?? null;
          }
          return forMatch[0] ?? null;
        },
      }),
    }),
  } as unknown as D1Database;
}

const baseSnap = (overrides: Partial<ProbabilitySnapshotRow>): ProbabilitySnapshotRow => ({
  id: 'ps-1',
  match_id: 'm-w26-gk-1v2',
  minute: 0,
  second: 0,
  home_win_prob: 0.72,
  draw_prob: 0.18,
  away_win_prob: 0.1,
  expected_home_goals: 1.9,
  expected_away_goals: 0.6,
  most_likely_score: '2-0',
  scoreline_json: '{"2-0":0.2}',
  interval_json: '{}',
  confidence: 0.8,
  model_version: 'wc-prob-v5',
  input_hash: 'h1',
  feature_snapshot_r2_key: null,
  explanation_json: null,
  created_at: '2026-06-17T10:00:00Z',
  ...overrides,
});

describe('getDisplaySnapshot', () => {
  it('returns latest minute snapshot for live matches', async () => {
    const db = mockDb([
      baseSnap({ id: 'ps-pre', minute: 0, home_win_prob: 0.72, most_likely_score: '2-0' }),
      baseSnap({ id: 'ps-live', minute: 78, home_win_prob: 0.41, most_likely_score: '0-0' }),
    ]);
    const snap = await getDisplaySnapshot(db, 'm-w26-gk-1v2', 'live');
    expect(snap?.id).toBe('ps-live');
    expect(snap?.most_likely_score).toBe('0-0');
  });

  it('returns minute-0 snapshot for completed matches (S10 regression)', async () => {
    const db = mockDb([
      baseSnap({ id: 'ps-pre', minute: 0, home_win_prob: 0.72, most_likely_score: '2-0' }),
      baseSnap({ id: 'ps-live', minute: 95, home_win_prob: 0.41, most_likely_score: '0-0' }),
    ]);
    const snap = await getDisplaySnapshot(db, 'm-w26-gk-1v2', 'completed');
    expect(snap?.id).toBe('ps-pre');
    expect(snap?.home_win_prob).toBeGreaterThan(0.6);
    expect(snap?.most_likely_score).toBe('2-0');
  });

  it('returns null for completed matches with only live snapshots', async () => {
    const db = mockDb([
      baseSnap({ id: 'ps-live', minute: 55, home_win_prob: 0.45, most_likely_score: '1-1' }),
    ]);
    const snap = await getDisplaySnapshot(db, 'm-w26-gk-1v2', 'completed');
    expect(snap).toBeNull();
  });
});
