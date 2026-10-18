import { describe, expect, it, vi } from 'vitest';
import { BULK_BUDGET_SKIPS_KEY, BULK_RECOMPUTE_CURSOR_KEY, BULK_RECOMPUTE_KV_KEY } from '../src/constants/pipeline';
import { recomputeMatchProbability } from '../src/services/recomputeMatch';
import {
  isBulkWalkLeaseActive,
  resumeStalledBulkWalk,
  runBulkRecomputeIfPending,
  scheduleRecomputeAfterDataChange,
} from '../src/services/bulkRecomputeRunner';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';

vi.mock('../src/services/recomputeMatch', () => ({
  recomputeAllWc2026Matches: vi.fn(async () => ({
    total: 2,
    recomputed: 2,
    failed: [],
  })),
  recomputeMatchProbability: vi.fn(async () => null),
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

  it('scheduleRecomputeAfterDataChange queues a new walk and does not run it inline', async () => {
    vi.mocked(recomputeMatchProbability).mockClear();
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      MODEL_QUEUE: { send } as never,
      DB: createMockDb({ all: () => ({ results: [{ id: 'm-a' }] }) }),
    });
    await scheduleRecomputeAfterDataChange(env, 'manual', { immediate: true });
    expect(recomputeMatchProbability).not.toHaveBeenCalled();
    const flag = JSON.parse((await env.KV.get(BULK_RECOMPUTE_KV_KEY)) ?? '{}') as { walkId?: string; cursor?: string };
    expect(flag.walkId).toEqual(expect.any(String));
    expect(flag.cursor).toBeUndefined();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'recompute_wc2026_bulk', reason: 'manual', walkId: flag.walkId }),
    );
    expect(env.KV.delete).not.toHaveBeenCalledWith(BULK_RECOMPUTE_KV_KEY);
  });

  it('stops at the time budget and enqueues a continuation with a cursor', async () => {
    vi.mocked(recomputeMatchProbability).mockClear();
    const ids = ['m-a', 'm-b', 'm-c', 'm-d'];
    let clock = 10_000;
    vi.mocked(recomputeMatchProbability).mockImplementation(async () => {
      clock += 30_000;
      return null;
    });
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      DB: createMockDb({ all: () => ({ results: ids.map((id) => ({ id })) }) }),
      KV: createMockKv({ [BULK_RECOMPUTE_KV_KEY]: 'ingest' }),
      MODEL_QUEUE: { send } as never,
    });

    const ran = await runBulkRecomputeIfPending(env, { budgetMs: 60_000, now: () => clock });

    expect(ran).toBe(true);
    expect(vi.mocked(recomputeMatchProbability).mock.calls.map((call) => call[1])).toEqual(['m-a', 'm-b']);
    expect(send).toHaveBeenCalledWith({
      type: 'recompute_wc2026_bulk',
      reason: 'ingest',
      cursor: 'm-b',
    });
    const saved = JSON.parse((await env.KV.get(BULK_RECOMPUTE_KV_KEY)) ?? '{}') as {
      reason?: string;
      cursor?: string;
      progressAt?: number;
    };
    expect(saved.reason).toBe('ingest');
    expect(saved.cursor).toBe('m-b');
    expect(saved.progressAt).toEqual(expect.any(Number));
    expect(await env.KV.get(BULK_RECOMPUTE_CURSOR_KEY)).toBe('m-b');
  });

  it('resumes after the cursor and does not recompute matches already passed', async () => {
    vi.mocked(recomputeMatchProbability).mockClear();
    const ids = ['m-a', 'm-b', 'm-c'];
    vi.mocked(recomputeMatchProbability).mockResolvedValue(null);
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      DB: createMockDb({ all: () => ({ results: ids.map((id) => ({ id })) }) }),
      KV: createMockKv({
        [BULK_RECOMPUTE_KV_KEY]: 'ingest',
        [BULK_RECOMPUTE_CURSOR_KEY]: 'm-b',
      }),
      MODEL_QUEUE: { send } as never,
    });

    await runBulkRecomputeIfPending(env, { cursor: 'm-a' });

    expect(vi.mocked(recomputeMatchProbability).mock.calls.map((call) => call[1])).toEqual(['m-c']);
    expect(send).toHaveBeenCalledWith({
      type: 'recompute_wc2026_bulk',
      reason: 'ingest',
      phase: 'champion',
    });
    expect(await env.KV.get(BULK_RECOMPUTE_KV_KEY)).toBeNull();
  });

  it('leaves a match cut off by the budget for the next chunk', async () => {
    vi.mocked(recomputeMatchProbability).mockClear();
    vi.mocked(recomputeMatchProbability).mockImplementationOnce(() => new Promise(() => undefined));
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      DB: createMockDb({ all: () => ({ results: [{ id: 'm-a' }, { id: 'm-b' }] }) }),
      KV: createMockKv({ [BULK_RECOMPUTE_KV_KEY]: 'ingest' }),
      MODEL_QUEUE: { send } as never,
    });

    await runBulkRecomputeIfPending(env, { budgetMs: 20 });

    expect(recomputeMatchProbability).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      type: 'recompute_wc2026_bulk',
      reason: 'ingest',
    });
    expect(await env.KV.get(BULK_RECOMPUTE_CURSOR_KEY)).toBeNull();
    const flag = JSON.parse((await env.KV.get(BULK_RECOMPUTE_KV_KEY)) ?? '{}') as {
      reason?: string;
      budgetCuts?: Record<string, number>;
    };
    expect(flag.reason).toBe('ingest');
    expect(flag.budgetCuts).toEqual({ 'm-a': 1 });
  });

  it('skips a match after the second budget cut and the walk can finish', async () => {
    vi.mocked(recomputeMatchProbability).mockClear();
    vi.mocked(recomputeMatchProbability).mockImplementation(() => new Promise(() => undefined));
    const env = createMockEnv({
      DB: createMockDb({ all: () => ({ results: [{ id: 'm-a' }, { id: 'm-b' }] }) }),
      KV: createMockKv({ [BULK_RECOMPUTE_KV_KEY]: 'ingest' }),
      MODEL_QUEUE: { send: vi.fn(async () => undefined) } as never,
    });

    await runBulkRecomputeIfPending(env, { budgetMs: 20 });
    await runBulkRecomputeIfPending(env, { budgetMs: 20 });

    expect(await env.KV.get(BULK_RECOMPUTE_CURSOR_KEY)).toBe('m-a');
    expect(await env.KV.get(BULK_BUDGET_SKIPS_KEY)).toBe('1');
    vi.mocked(recomputeMatchProbability).mockReset();
    vi.mocked(recomputeMatchProbability).mockResolvedValue(null);

    await runBulkRecomputeIfPending(env, { budgetMs: 60_000 });

    expect(vi.mocked(recomputeMatchProbability).mock.calls.map((call) => call[1])).toEqual(['m-b']);
    expect(await env.KV.get(BULK_RECOMPUTE_KV_KEY)).toBeNull();
  });

  it('blocks live recompute only while the walk lease is active', async () => {
    const now = 1_700_000_000_000;
    const active = createMockEnv({
      KV: createMockKv({
        [BULK_RECOMPUTE_KV_KEY]: JSON.stringify({ walkId: 'w', reason: 'ingest', leaseUntil: now + 1_000 }),
      }),
    });
    const expired = createMockEnv({
      KV: createMockKv({
        [BULK_RECOMPUTE_KV_KEY]: JSON.stringify({ walkId: 'w', reason: 'ingest', leaseUntil: now - 1 }),
      }),
    });
    expect(await isBulkWalkLeaseActive(active, now)).toBe(true);
    expect(await isBulkWalkLeaseActive(expired, now)).toBe(false);
    expect(await isBulkWalkLeaseActive(createMockEnv(), now)).toBe(false);
  });

  it('re-sends a stalled walk from the last finished match', async () => {
    const now = 1_700_000_000_000;
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      KV: createMockKv({
        [BULK_RECOMPUTE_KV_KEY]: JSON.stringify({
          walkId: 'walk-stalled',
          reason: 'ingest',
          cursor: 'm-a',
          leaseUntil: 0,
          progressAt: now - 11 * 60_000,
        }),
      }),
      MODEL_QUEUE: { send } as never,
    });

    expect(await resumeStalledBulkWalk(env, now)).toBe(true);
    expect(send).toHaveBeenCalledWith({
      type: 'recompute_wc2026_bulk',
      reason: 'ingest',
      walkId: 'walk-stalled',
      cursor: 'm-a',
    });
    expect(await resumeStalledBulkWalk(env, now)).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a retry after a timeout starts again at the match the budget cut off', async () => {
    const ids = ['m-a', 'm-b', 'm-c'];
    vi.mocked(recomputeMatchProbability).mockClear();
    vi.mocked(recomputeMatchProbability).mockImplementationOnce(() => new Promise(() => undefined));
    const env = createMockEnv({
      DB: createMockDb({ all: () => ({ results: ids.map((id) => ({ id })) }) }),
      KV: createMockKv({ [BULK_RECOMPUTE_KV_KEY]: 'ingest' }),
      MODEL_QUEUE: { send: vi.fn(async () => undefined) } as never,
    });

    await runBulkRecomputeIfPending(env, { budgetMs: 20 });
    vi.mocked(recomputeMatchProbability).mockClear();
    vi.mocked(recomputeMatchProbability).mockResolvedValue(null);

    await runBulkRecomputeIfPending(env, { budgetMs: 60_000 });

    expect(vi.mocked(recomputeMatchProbability).mock.calls.map((call) => call[1])).toEqual(['m-a', 'm-b', 'm-c']);
  });

  it('rethrows a chunk error instead of enqueueing another walk', async () => {
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      DB: {
        prepare: () => {
          throw new Error('D1 down');
        },
      } as never,
      KV: createMockKv({ [BULK_RECOMPUTE_KV_KEY]: 'ingest' }),
      MODEL_QUEUE: { send } as never,
    });

    await expect(runBulkRecomputeIfPending(env)).rejects.toThrow('D1 down');
    expect(send).not.toHaveBeenCalled();
    expect(await env.KV.get(BULK_RECOMPUTE_KV_KEY)).toBe('ingest');
  });

  it('processes at most one chunk of matches per message', async () => {
    const ids = Array.from({ length: 20 }, (_, index) => `m-${index}`);
    vi.mocked(recomputeMatchProbability).mockClear();
    vi.mocked(recomputeMatchProbability).mockResolvedValue(null);
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      DB: createMockDb({ all: () => ({ results: ids.map((id) => ({ id })) }) }),
      KV: createMockKv({ [BULK_RECOMPUTE_KV_KEY]: 'ingest' }),
      MODEL_QUEUE: { send } as never,
    });

    await runBulkRecomputeIfPending(env, { budgetMs: 60_000 });

    expect(vi.mocked(recomputeMatchProbability).mock.calls.map((call) => call[1])).toEqual(ids.slice(0, 8));
    expect(send).toHaveBeenCalledWith({
      type: 'recompute_wc2026_bulk',
      reason: 'ingest',
      cursor: 'm-7',
    });
  });
});
