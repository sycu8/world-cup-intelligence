import { describe, expect, it, vi } from 'vitest';
import { BULK_RECOMPUTE_KV_KEY } from '../src/constants/pipeline';

describe('bulkRecomputeRunner KV contract', () => {
  it('pending flag is any non-empty KV value', async () => {
    const kv = {
      get: vi.fn(async (k: string) => (k === BULK_RECOMPUTE_KV_KEY ? 'statsbomb-ingest' : null)),
      put: vi.fn(),
      delete: vi.fn(),
    };
    const { runBulkRecomputeIfPending } = await import('../src/services/bulkRecomputeRunner');

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
});
