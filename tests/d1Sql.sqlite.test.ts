// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { DLQ_PARKED_COUNT_KEY } from '../src/constants/pipeline';
import { PIPELINE_COUNTER_UPSERT_SQL, PIPELINE_COUNTERS_SQL, addPipelineCounter } from '../src/services/pipelineCounters';
import { RECAP_SYNC_CLAIM_MS, RECAP_SYNC_CLAIM_SQL, RECAP_SYNC_CLAIMS_SQL } from '../src/services/recapSync';

function sqliteCounterEnv(seed: Record<string, string> = {}) {
  const db = new DatabaseSync(':memory:');
  const kv = new Map(Object.entries(seed));
  return {
    db,
    DB: {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              first: async () => (db.prepare(sql).get(...(args as never[])) as { value?: number } | undefined) ?? null,
              run: async () => {
                db.prepare(sql).run(...(args as never[]));
                return { success: true };
              },
            };
          },
          run: async () => {
            db.exec(sql);
            return { success: true };
          },
        };
      },
    },
    KV: {
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: string) => {
        kv.set(key, value);
      },
    },
  };
}

describe('pipeline counter SQL', () => {
  it('adds only the delta on conflict and copies a KV seed once', async () => {
    const env = sqliteCounterEnv({ [DLQ_PARKED_COUNT_KEY]: '7' });
    expect(PIPELINE_COUNTER_UPSERT_SQL).toContain('value = pipeline_counters.value + ?');
    expect(await addPipelineCounter(env, DLQ_PARKED_COUNT_KEY, 1)).toBe(8);
    expect(await addPipelineCounter(env, DLQ_PARKED_COUNT_KEY, 1)).toBe(9);
    expect(await addPipelineCounter(env, DLQ_PARKED_COUNT_KEY, 4)).toBe(13);
    const row = env.db.prepare('SELECT value FROM pipeline_counters WHERE key = ?').get(DLQ_PARKED_COUNT_KEY) as {
      value: number;
    };
    expect(row.value).toBe(13);

    env.db.exec('DELETE FROM pipeline_counters');
    const upsert = env.db.prepare(PIPELINE_COUNTER_UPSERT_SQL);
    expect(upsert.get('plain', 1, 1)).toEqual({ value: 1 });
    for (let i = 0; i < 9; i++) upsert.get('plain', 1, 1);
    expect(env.db.prepare('SELECT value FROM pipeline_counters WHERE key = ?').get('plain')).toEqual({ value: 10 });
    expect(PIPELINE_COUNTERS_SQL).toContain('pipeline_counters');
  });
});

describe('recap sync claim SQL', () => {
  it('lets one match claim once per 10 minutes', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(RECAP_SYNC_CLAIMS_SQL);
    const claim = db.prepare(RECAP_SYNC_CLAIM_SQL);
    const now = 1_700_000_000_000;
    expect(claim.get('m-1', now + RECAP_SYNC_CLAIM_MS, now)).toEqual({ match_id: 'm-1' });
    expect(claim.get('m-1', now + RECAP_SYNC_CLAIM_MS, now + 1_000)).toBeUndefined();
    expect(claim.get('m-2', now + RECAP_SYNC_CLAIM_MS, now)).toEqual({ match_id: 'm-2' });
    expect(claim.get('m-1', now + RECAP_SYNC_CLAIM_MS * 2, now + RECAP_SYNC_CLAIM_MS)).toEqual({
      match_id: 'm-1',
    });
  });
});

describe('AI minute cap', () => {
  it('shares one D1 minute bucket across isolates when KV cannot store the count', async () => {
    const { translateMatchRecapText } = await import('../src/ai/translateMatchRecap');
    const { withAiRun } = await import('../src/ai/aiCallGuard');
    const { createMockEnv } = await import('./helpers/mockEnv');
    const envDb = sqliteCounterEnv();
    const run = vi.fn(async () => ({ response: '{"textVi":"Đội ghi bàn."}' }));
    const kv = {
      get: vi.fn(async () => {
        throw new Error('kv down');
      }),
      put: vi.fn(async () => {
        throw new Error('kv down');
      }),
      delete: vi.fn(async () => undefined),
    };
    const isolate = () =>
      createMockEnv({
        AI: { run } as never,
        AI_CALLS_PER_RUN: '10',
        AI_CALLS_PER_MINUTE: '2',
        DB: envDb.DB as never,
        KV: kv as never,
      });
    const first = isolate();
    const second = isolate();
    const line = 'The team scores from a corner.';

    await withAiRun({ runId: 'a1' }, () => translateMatchRecapText(first, line, 520, 'shot', 1, { matchId: 'm-a' }));
    await withAiRun({ runId: 'a2' }, () => translateMatchRecapText(first, line, 520, 'shot', 2, { matchId: 'm-a' }));
    await withAiRun({ runId: 'b1' }, () => translateMatchRecapText(second, line, 520, 'shot', 3, { matchId: 'm-b' }));

    expect(run).toHaveBeenCalledTimes(2);
  });
});
