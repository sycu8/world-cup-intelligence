import { afterEach, describe, expect, it, vi } from 'vitest';
import { BULK_RECOMPUTE_KV_KEY } from '../src/constants/pipeline';
import { handleModelBatch } from '../src/queues/modelConsumer';
import { BULK_RECOMPUTE_BUDGET_MS, readBulkPending, scheduleRecomputeAfterDataChange } from '../src/services/bulkRecomputeRunner';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { createMockMessageBatch } from './helpers/mockMessageBatch';

vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => null),
}));

vi.mock('../src/services/tournamentChampionOdds', () => ({
  refreshChampionOdds: vi.fn(async () => undefined),
  runChampionOddsRefreshIfPending: vi.fn(async () => false),
}));

const MATCHES = ['m-0', 'm-1', 'm-2'];

function matchDb() {
  return createMockDb({ all: () => ({ results: MATCHES.map((id) => ({ id })) }) });
}

describe('bulk walk chain', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('one consumer retries a stuck match and ingest ticks replace the walk from the start', async () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    const attempts = new Map<string, number>();
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    vi.mocked(recomputeMatchProbability).mockImplementation((_env, matchId: string) => {
      attempts.set(matchId, (attempts.get(matchId) ?? 0) + 1);
      markStarted();
      return new Promise(() => undefined);
    });
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      DB: matchDb(),
      MODEL_QUEUE: { send } as never,
    });
    await scheduleRecomputeAfterDataChange(env, 'ingest-0');
    const firstWalk = readBulkPending(await env.KV.get(BULK_RECOMPUTE_KV_KEY))!;
    const pending = handleModelBatch(
      createMockMessageBatch([
        {
          body: { type: 'recompute_wc2026_bulk', walkId: firstWalk.walkId, reason: 'ingest-0' },
          timestamp: new Date(1_700_000_000_000),
        },
      ]),
      env,
    );
    await started;
    await scheduleRecomputeAfterDataChange(env, 'ingest-1');
    await scheduleRecomputeAfterDataChange(env, 'ingest-2');
    await vi.advanceTimersByTimeAsync(BULK_RECOMPUTE_BUDGET_MS);
    await pending;

    const current = readBulkPending(await env.KV.get(BULK_RECOMPUTE_KV_KEY));
    expect(current?.walkId).toBeTruthy();
    expect(current?.walkId).not.toBe(firstWalk.walkId);
    expect(current?.reason).toBe('ingest-2');
    expect(current?.cursor).toBeUndefined();
    expect(attempts.get('m-0')).toBe(1);
    expect(attempts.has('m-1')).toBe(false);
    const continuations = send.mock.calls.filter((call) => {
      const body = call[0] as { walkId?: string; phase?: string };
      return body.walkId === firstWalk.walkId && body.phase !== 'champion';
    });
    expect(continuations).toHaveLength(1);

    vi.mocked(recomputeMatchProbability).mockImplementation(async (_env, matchId: string) => {
      attempts.set(matchId, (attempts.get(matchId) ?? 0) + 1);
      return null;
    });
    const callsBefore = vi.mocked(recomputeMatchProbability).mock.calls.length;
    await handleModelBatch(
      createMockMessageBatch([
        {
          body: { type: 'recompute_wc2026_bulk', walkId: current!.walkId, reason: 'ingest-2' },
          timestamp: new Date(1_700_000_000_000),
        },
      ]),
      env,
    );
    expect(vi.mocked(recomputeMatchProbability).mock.calls.slice(callsBefore).map((call) => call[1])).toEqual(MATCHES);
    const skipped = MATCHES.filter((id) => !attempts.has(id));
    expect(skipped).toEqual([]);
    expect(attempts.get('m-0')).toBe(2);
    expect(attempts.get('m-1')).toBe(1);
    expect(attempts.get('m-2')).toBe(1);
  });

  it('two consumers keep a single lease while a match is stuck', async () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    vi.mocked(recomputeMatchProbability).mockImplementation(() => {
      markStarted();
      return new Promise(() => undefined);
    });
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      DB: matchDb(),
      MODEL_QUEUE: { send } as never,
    });
    await scheduleRecomputeAfterDataChange(env, 'ingest');
    const walk = readBulkPending(await env.KV.get(BULK_RECOMPUTE_KV_KEY))!;
    const body = { type: 'recompute_wc2026_bulk' as const, walkId: walk.walkId, reason: 'ingest' };
    const ack = vi.fn();
    const first = handleModelBatch(
      createMockMessageBatch([{ body, timestamp: new Date(1_700_000_000_000) }]),
      env,
    );
    await started;
    await handleModelBatch(
      createMockMessageBatch([{ body, timestamp: new Date(1_700_000_000_000), ack }]),
      env,
    );
    expect(recomputeMatchProbability).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalled();
    const delayed = send.mock.calls.filter((call) => (call[1] as { delaySeconds?: number } | undefined)?.delaySeconds);
    expect(delayed).toHaveLength(1);
    expect((delayed[0]![0] as { walkId: string }).walkId).toBe(walk.walkId);
    expect((delayed[0]![0] as { reason: string }).reason).toBe('ingest');
    await vi.advanceTimersByTimeAsync(BULK_RECOMPUTE_BUDGET_MS);
    await first;
    expect(recomputeMatchProbability).toHaveBeenCalledTimes(1);
  });

  it('a D1 error retries through the queue and does not enqueue another walk', async () => {
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
    const retries: number[] = [];
    for (let delivery = 0; delivery < 3; delivery += 1) {
      const retry = vi.fn();
      await handleModelBatch(
        createMockMessageBatch([{ body: { type: 'recompute_wc2026_bulk', reason: 'ingest' }, retry }]),
        env,
      );
      retries.push(retry.mock.calls.length);
    }
    expect(retries).toEqual([1, 1, 1]);
    expect(send).not.toHaveBeenCalled();
    expect(await env.KV.get(BULK_RECOMPUTE_KV_KEY)).toBe('ingest');
  });

  it('counts a budget cutoff as a retry and drops a stale walk without rewriting the flag', async () => {
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    const attempts: string[] = [];
    vi.mocked(recomputeMatchProbability).mockImplementation((_env, matchId: string) => {
      attempts.push(matchId);
      if (matchId === 'm-1' && attempts.filter((id) => id === 'm-1').length === 1) {
        return new Promise(() => undefined);
      }
      return Promise.resolve(null);
    });
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      DB: matchDb(),
      MODEL_QUEUE: { send } as never,
    });
    await scheduleRecomputeAfterDataChange(env, 'lineup-sync');
    const walk = readBulkPending(await env.KV.get(BULK_RECOMPUTE_KV_KEY))!;
    const { runBulkRecomputeIfPending } = await import('../src/services/bulkRecomputeRunner');
    await runBulkRecomputeIfPending(env, {
      walkId: walk.walkId,
      reason: 'lineup-sync',
      budgetMs: 30,
    });
    const continuation = send.mock.calls.map((call) => call[0] as { cursor?: string; reason?: string; walkId?: string }).at(-1);
    expect(continuation).toEqual({
      type: 'recompute_wc2026_bulk',
      reason: 'lineup-sync',
      walkId: walk.walkId,
      cursor: 'm-0',
    });

    await runBulkRecomputeIfPending(env, {
      walkId: walk.walkId,
      reason: continuation!.reason,
      cursor: continuation!.cursor,
      budgetMs: 60_000,
    });
    expect(attempts.filter((id) => id === 'm-0')).toEqual(['m-0']);
    expect(attempts.filter((id) => id === 'm-1')).toEqual(['m-1', 'm-1']);
    expect(attempts.includes('m-2')).toBe(true);

    const finished = readBulkPending(await env.KV.get(BULK_RECOMPUTE_KV_KEY));
    expect(finished).toBeNull();
    await runBulkRecomputeIfPending(env, {
      walkId: walk.walkId,
      reason: 'lineup-sync',
      cursor: 'm-0',
    });
    expect(await env.KV.get(BULK_RECOMPUTE_KV_KEY)).toBeNull();
    expect(attempts.filter((id) => id === 'm-0')).toEqual(['m-0']);
  });
});
