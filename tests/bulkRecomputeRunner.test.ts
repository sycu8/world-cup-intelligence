import { describe, expect, it, vi } from 'vitest';
import { BULK_RECOMPUTE_CURSOR_KEY, BULK_RECOMPUTE_KV_KEY } from '../src/constants/pipeline';
import { recomputeMatchProbability } from '../src/services/recomputeMatch';
import {
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
    expect(JSON.parse((await env.KV.get(BULK_RECOMPUTE_KV_KEY)) ?? '{}')).toEqual({
      reason: 'ingest',
      cursor: 'm-b',
    });
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

  it('advances past a match that exceeds the budget so the next chunk can continue', async () => {
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
      cursor: 'm-a',
    });
    expect(await env.KV.get(BULK_RECOMPUTE_CURSOR_KEY)).toBe('m-a');
    expect(JSON.parse((await env.KV.get(BULK_RECOMPUTE_KV_KEY)) ?? '{}')).toEqual({
      reason: 'ingest',
      cursor: 'm-a',
    });
  });

  it('a retry after a timeout continues from the cursor instead of the first match', async () => {
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

    expect(vi.mocked(recomputeMatchProbability).mock.calls.map((call) => call[1])).toEqual(['m-b', 'm-c']);
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
