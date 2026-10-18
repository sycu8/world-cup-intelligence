import { describe, expect, it, vi } from 'vitest';
import { BULK_RECOMPUTE_KV_KEY } from '../src/constants/pipeline';
import {
  runBulkRecomputeIfPending,
  scheduleRecomputeAfterDataChange,
} from '../src/services/bulkRecomputeRunner';
import { createMockEnv } from './helpers/mockEnv';

vi.mock('../src/services/recomputeMatch', () => ({
  recomputeAllWc2026Matches: vi.fn(async () => ({
    total: 2,
    recomputed: 2,
    failed: [],
  })),
}));

describe('bulkRecomputeRunner KV contract', () => {
  it('pending flag is any non-empty KV value', async () => {
    const kv = {
      get: vi.fn(async (k: string) => (k === BULK_RECOMPUTE_KV_KEY ? 'statsbomb-ingest' : null)),
      put: vi.fn(),
      delete: vi.fn(),
    };
    const env = {
      KV: kv as unknown as KVNamespace,
      DB: {
        prepare: () => ({
          bind: () => ({ all: async () => ({ results: [] }) }),
        }),
      },
    } as import('../src/env').AppEnv;

    const ran = await runBulkRecomputeIfPending(env);
    expect(ran).toBe(true);
    expect(kv.delete).toHaveBeenCalledWith(BULK_RECOMPUTE_KV_KEY);
  });

  it('returns false when no pending flag', async () => {
    const env = createMockEnv();
    expect(await runBulkRecomputeIfPending(env)).toBe(false);
  });

  it('scheduleRecomputeAfterDataChange enqueues model queue job', async () => {
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({ MODEL_QUEUE: { send } as never });
    await scheduleRecomputeAfterDataChange(env, 'lineup-sync');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'recompute_wc2026_bulk', reason: 'lineup-sync' }),
    );
  });

  it('scheduleRecomputeAfterDataChange runs immediately when requested', async () => {
    const env = createMockEnv({
      KV: {
        get: vi.fn(async (k: string) => (k === BULK_RECOMPUTE_KV_KEY ? 'immediate' : null)),
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
      } as never,
    });
    await scheduleRecomputeAfterDataChange(env, 'manual', { immediate: true });
    expect(env.KV.delete).toHaveBeenCalledWith(BULK_RECOMPUTE_KV_KEY);
  });
});
