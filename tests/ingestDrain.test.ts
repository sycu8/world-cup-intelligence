import { describe, expect, it, vi } from 'vitest';
import { handleDlqBatch } from '../src/queues/dlqConsumer';
import {
  DRAIN_PAUSE_SECONDS,
  DRAIN_REPLAY_GAP_SECONDS,
  QUEUE_DELAY_LIMIT_SECONDS,
  REFRESH_MIN_GAP_MS,
  REFRESH_STALE_MS,
  dlqMessageAction,
  DLQ_PARK_TTL_SECONDS,
  DLQ_REPLAY_CURSOR_KV_KEY,
  cappedQueueDelay,
  dlqParkKey,
  drainPauseMs,
  estimateIngestDrainSeconds,
  ingestDedupeKey,
  isStaleIngestTick,
  isStaleRefreshMinute,
  loadReplayCursorMs,
  refreshRunIsDue,
  replayDelayForCursor,
  saveReplayCursorMs,
  takeDlqReplayDelaySeconds,
} from '../src/queues/ingestDrain';
import { DLQ_PARKED_COUNT_KEY, INGEST_STALE_DROPS_KEY } from '../src/constants/pipeline';
import { addPipelineCounter, readPipelineCounter } from '../src/services/pipelineCounters';
import { createMockDb, createMockEnv } from './helpers/mockEnv';

describe('ingest drain', () => {
  it('treats a refresh tick older than 10 minutes as stale and collapses ticks to one key', () => {
    const now = Date.now();
    expect(REFRESH_STALE_MS).toBe(10 * 60_000);
    expect(isStaleRefreshMinute({ type: 'refresh_minute' }, new Date(now - REFRESH_STALE_MS - 1), now)).toBe(true);
    expect(isStaleRefreshMinute({ type: 'refresh_minute' }, new Date(now - 60_000), now)).toBe(false);
    expect(isStaleRefreshMinute({ type: 'refresh_minute' }, new Date(now - 30_000), now)).toBe(false);
    expect(isStaleRefreshMinute({ type: 'refresh_minute' }, undefined, now)).toBe(false);
    expect(isStaleRefreshMinute({ type: 'crawl_news' }, new Date(now - REFRESH_STALE_MS - 1), now)).toBe(false);
    expect(isStaleIngestTick({ type: 'crawl_news' }, new Date(now - REFRESH_STALE_MS - 1), now)).toBe(true);
    expect(isStaleIngestTick({ type: 'sync_leagues' }, new Date(now - REFRESH_STALE_MS - 1), now)).toBe(true);
    expect(isStaleIngestTick({ type: 'refresh_live_probabilities' }, new Date(now - 60_000), now)).toBe(false);
    expect(isStaleIngestTick({ type: 'source_ingest' }, new Date(now - REFRESH_STALE_MS - 1), now)).toBe(false);
    expect(dlqMessageAction({ type: 'refresh_minute' }, new Date(now - REFRESH_STALE_MS - 1), true, now)).toBe(
      'drop_stale',
    );
    expect(dlqMessageAction({ type: 'refresh_minute' }, new Date(now), true, now)).toBe('park');
    expect(dlqMessageAction({ type: 'crawl_news', fromDlq: true }, new Date(now), true, now)).toBe('park');
    expect(dlqMessageAction({ type: 'crawl_news' }, new Date(now), true, now)).toBe('replay');
    expect(dlqMessageAction({ type: 'crawl_news' }, undefined, true, now)).toBe('park');
    expect(dlqMessageAction({ type: 'sync_leagues' }, new Date(Number.NaN), true, now)).toBe('park');
    expect(cappedQueueDelay(86_399)).toBe(86_399);
    expect(cappedQueueDelay(86_400)).toBe('park');
    expect(DLQ_PARK_TTL_SECONDS).toBe(345600);
    expect(dlqMessageAction({ type: 'recompute_wc2026_bulk' }, new Date(now), false, now)).toBe('park');
    expect(ingestDedupeKey({ type: 'refresh_minute', idempotencyKey: 'a' })).toBe('refresh_minute');
    expect(ingestDedupeKey({ type: 'refresh_minute', idempotencyKey: 'b' })).toBe('refresh_minute');
    expect(ingestDedupeKey({ type: 'refresh_minute', step: 'lineups', idempotencyKey: 'step-1' })).toBe(
      'refresh_minute:lineups:step-1',
    );
    expect(ingestDedupeKey({ type: 'crawl_news', idempotencyKey: 'news-1' })).toBe('crawl_news');
    expect(ingestDedupeKey({ type: 'crawl_news', idempotencyKey: 'news-2', feedCursor: 4 })).toBe('crawl_news:news-2');
    expect(REFRESH_MIN_GAP_MS).toBeLessThan(60_000);
    expect(refreshRunIsDue(null, now)).toBe(true);
    expect(refreshRunIsDue(now - 60_000, now)).toBe(true);
    expect(refreshRunIsDue(now - 30_000, now)).toBe(false);
    expect(estimateIngestDrainSeconds(0, 2)).toBe(0);
    expect(estimateIngestDrainSeconds(25, 2)).toBe(6);
    expect(drainPauseMs(3, false)).toBe(0);
    expect(drainPauseMs(4, true)).toBe(0);
    expect(drainPauseMs(4, false)).toBe(DRAIN_PAUSE_SECONDS * 1000);
    expect(DRAIN_REPLAY_GAP_SECONDS).toBe(30);
  });

  it('spaces DLQ replays from the last scheduled time', async () => {
    const env = createMockEnv();
    const now = Date.now();
    await expect(takeDlqReplayDelaySeconds(env, now)).resolves.toBe(0);
    await expect(takeDlqReplayDelaySeconds(env, now)).resolves.toBe(DRAIN_REPLAY_GAP_SECONDS);
    await expect(takeDlqReplayDelaySeconds(env, now + 5_000)).resolves.toBe(DRAIN_REPLAY_GAP_SECONDS * 2 - 5);
  });

  it('counts DLQ messages, drops stale refresh ticks, and replays an idempotent job once', async () => {
    const send = vi.fn(async () => undefined);
    const ackStale = vi.fn();
    const ackFreshRefresh = vi.fn();
    const ackOldNews = vi.fn();
    const ackReplay = vi.fn();
    const ackAgain = vi.fn();
    const ackHook = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });
    const now = Date.now();

    await handleDlqBatch(
      {
        queue: 'wc-ingest-dlq',
        messages: [
          {
            id: 'stale',
            attempts: 4,
            timestamp: new Date(now - 11 * 60_000),
            body: { type: 'refresh_minute', idempotencyKey: 'old' },
            ack: ackStale,
          },
          {
            id: 'fresh-refresh',
            attempts: 4,
            timestamp: new Date(now),
            body: { type: 'refresh_minute', idempotencyKey: 'fresh' },
            ack: ackFreshRefresh,
          },
          {
            id: 'old-news',
            attempts: 4,
            timestamp: new Date(now - 11 * 60_000),
            body: { type: 'crawl_news', idempotencyKey: 'old-news' },
            ack: ackOldNews,
          },
          {
            id: 'news',
            attempts: 4,
            timestamp: new Date(now),
            body: { type: 'crawl_news', idempotencyKey: 'news-1' },
            ack: ackReplay,
          },
          {
            id: 'again',
            attempts: 4,
            timestamp: new Date(now),
            body: { type: 'crawl_news', idempotencyKey: 'news-2', fromDlq: true },
            ack: ackAgain,
          },
          {
            id: 'hook',
            attempts: 4,
            timestamp: new Date(now),
            body: { type: 'webhook_deliver', idempotencyKey: 'wh', subscriptionId: 's', eventId: 1 },
            ack: ackHook,
          },
          {
            id: 'news-later',
            attempts: 4,
            timestamp: new Date(now),
            body: { type: 'sync_leagues', idempotencyKey: 'league-1' },
            ack: vi.fn(),
          },
        ],
      } as never,
      env,
    );

    expect(ackStale).toHaveBeenCalledTimes(1);
    expect(ackFreshRefresh).toHaveBeenCalledTimes(1);
    expect(ackOldNews).toHaveBeenCalledTimes(1);
    expect(ackReplay).toHaveBeenCalledTimes(1);
    expect(ackAgain).toHaveBeenCalledTimes(1);
    expect(ackHook).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, { type: 'crawl_news', idempotencyKey: 'news-1', fromDlq: true });
    expect(send).toHaveBeenNthCalledWith(
      2,
      { type: 'sync_leagues', idempotencyKey: 'league-1', fromDlq: true },
      { delaySeconds: DRAIN_REPLAY_GAP_SECONDS },
    );
    const logged = errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('refresh_minute');
    expect(logged).toContain('crawl_news');
    expect(logged).toContain('"replayed":2');
    const parkedKeys = vi.mocked(env.KV.put).mock.calls.map((call) => String(call[0]));
    expect(parkedKeys).toContain(dlqParkKey('wc-ingest-dlq', 'fresh-refresh'));
    expect(vi.mocked(env.KV.put)).toHaveBeenCalledWith(
      dlqParkKey('wc-ingest-dlq', 'fresh-refresh'),
      expect.any(String),
      { expirationTtl: 345600 },
    );
    expect(parkedKeys).toContain(dlqParkKey('wc-ingest-dlq', 'again'));
    expect(parkedKeys).toContain(dlqParkKey('wc-ingest-dlq', 'hook'));
    expect(parkedKeys).not.toContain(dlqParkKey('wc-ingest-dlq', 'stale'));
    expect(parkedKeys).not.toContain(dlqParkKey('wc-ingest-dlq', 'old-news'));
    expect(parkedKeys).not.toContain(DLQ_PARKED_COUNT_KEY);
    errorSpy.mockRestore();
  });

  it('parks a DLQ message when the replay send fails', async () => {
    const send = vi.fn(async () => {
      throw new Error('queue full');
    });
    const ack = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });

    await handleDlqBatch(
      {
        queue: 'wc-ingest-dlq',
        messages: [
          {
            id: 'news',
            attempts: 1,
            timestamp: new Date(),
            body: { type: 'crawl_news', idempotencyKey: 'news-1' },
            ack,
          },
        ],
      } as never,
      env,
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.KV.put).mock.calls.map((call) => String(call[0]))).toContain(
      dlqParkKey('wc-ingest-dlq', 'news'),
    );
    expect(errorSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('queue dlq replay failed');
    errorSpy.mockRestore();
  });

  it('retries a DLQ message when the replay and the park both fail', async () => {
    const send = vi.fn(async () => {
      throw new Error('queue full');
    });
    const ack = vi.fn();
    const retry = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });
    vi.mocked(env.KV.put).mockRejectedValue(new Error('kv down'));

    await handleDlqBatch(
      {
        queue: 'wc-ingest-dlq',
        messages: [
          {
            id: 'news',
            attempts: 1,
            timestamp: new Date(),
            body: { type: 'crawl_news', idempotencyKey: 'news-1' },
            ack,
            retry,
          },
        ],
      } as never,
      env,
    );

    expect(ack).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 10 });
    expect(errorSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('queue dlq park retry');
    errorSpy.mockRestore();
  });

  it('keeps 30s replay spacing when KV rejects every write', async () => {
    const env = createMockEnv();
    vi.mocked(env.KV.put).mockRejectedValue(new Error('kv 1/s'));
    const now = Date.now();
    const delays: Array<number | 'park'> = [];
    for (let i = 0; i < 10; i++) delays.push(await takeDlqReplayDelaySeconds(env, now));
    expect(delays).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270]);
  });

  it('parks a replay whose delay would reach 86400s and does not move the cursor', async () => {
    const now = 1_700_000_000_000;
    expect(replayDelayForCursor(now + QUEUE_DELAY_LIMIT_SECONDS * 1000, now)).toMatchObject({
      delaySeconds: QUEUE_DELAY_LIMIT_SECONDS,
    });
    expect(replayDelayForCursor(now + (QUEUE_DELAY_LIMIT_SECONDS + 1) * 1000, now)).toBe('park');

    const send = vi.fn(async () => undefined);
    const ack = vi.fn();
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });
    const cursor = Date.now() + 90_000_000;
    await saveReplayCursorMs(env, cursor);

    await handleDlqBatch(
      {
        queue: 'wc-ingest-dlq',
        messages: [
          {
            id: 'late',
            attempts: 1,
            timestamp: new Date(now),
            body: { type: 'source_ingest', sourceId: 'src-statsbomb', idempotencyKey: 'late' },
            ack,
          },
        ],
      } as never,
      env,
    );

    expect(send).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    await expect(loadReplayCursorMs(env)).resolves.toBe(cursor);
    expect(vi.mocked(env.KV.put).mock.calls.map((call) => String(call[0]))).toContain(
      dlqParkKey('wc-ingest-dlq', 'late'),
    );
  });

  it('does not advance the replay cursor when the send fails', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('queue full'))
      .mockResolvedValueOnce(undefined);
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });

    await handleDlqBatch(
      {
        queue: 'wc-ingest-dlq',
        messages: [
          {
            id: 'first',
            attempts: 1,
            timestamp: new Date(),
            body: { type: 'crawl_news', idempotencyKey: 'first' },
            ack: vi.fn(),
          },
          {
            id: 'second',
            attempts: 1,
            timestamp: new Date(),
            body: { type: 'sync_leagues', idempotencyKey: 'second' },
            ack: vi.fn(),
          },
        ],
      } as never,
      env,
    );

    expect(send).toHaveBeenNthCalledWith(1, {
      type: 'crawl_news',
      idempotencyKey: 'first',
      fromDlq: true,
    });
    expect(send).toHaveBeenNthCalledWith(2, {
      type: 'sync_leagues',
      idempotencyKey: 'second',
      fromDlq: true,
    });
    const delay = await takeDlqReplayDelaySeconds(env, Date.now(), false);
    expect(delay).toBeGreaterThan(DRAIN_REPLAY_GAP_SECONDS - 2);
    expect(delay).toBeLessThan(DRAIN_REPLAY_GAP_SECONDS + 2);
  });

  it('counts ten parks and ten stale drops when KV keeps only the first write', async () => {
    const store = new Map<string, string>();
    const seen = new Set<string>();
    const kv = {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        if (seen.has(key)) return;
        seen.add(key);
        store.set(key, value);
      }),
      delete: vi.fn(async () => undefined),
    };
    const env = createMockEnv({ KV: kv as never });
    const now = Date.now();
    const pause = vi.fn(async () => undefined);
    const parked = Array.from({ length: 10 }, (_, index) => ({
      id: `park-${index}`,
      attempts: 1,
      timestamp: new Date(now),
      body: { type: 'webhook_deliver', idempotencyKey: `wh-${index}`, subscriptionId: 's', eventId: index },
      ack: vi.fn(),
    }));
    const stale = Array.from({ length: 10 }, (_, index) => ({
      id: `stale-${index}`,
      attempts: 1,
      timestamp: new Date(now - REFRESH_STALE_MS - 1_000),
      body: { type: 'refresh_minute', idempotencyKey: `old-${index}` },
      ack: vi.fn(),
    }));

    await handleDlqBatch({ queue: 'wc-ingest-dlq', messages: parked } as never, env, { pause });
    await handleDlqBatch({ queue: 'wc-ingest-dlq', messages: stale } as never, env, { pause });

    await expect(readPipelineCounter(env, DLQ_PARKED_COUNT_KEY)).resolves.toBe(10);
    await expect(readPipelineCounter(env, INGEST_STALE_DROPS_KEY)).resolves.toBe(10);
    expect(store.get(DLQ_PARKED_COUNT_KEY)).toBeUndefined();
    expect(store.get(INGEST_STALE_DROPS_KEY)).toBeUndefined();
  });

  it('adds a D1 counter ten times when KV rejects the hot key', async () => {
    const rows = new Map<string, number>();
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('pipeline_counters.value +')) {
            const key = String(binds[0]);
            const insertValue = Number(binds[1]);
            const delta = Number(binds[2]);
            const existing = rows.get(key);
            const next = existing == null ? insertValue : existing + delta;
            rows.set(key, next);
            return { value: next };
          }
          if (sql.includes('SELECT value FROM pipeline_counters')) {
            const value = rows.get(String(binds[0]));
            return value == null ? null : { value };
          }
          return null;
        },
      }),
    });
    vi.mocked(env.KV.put).mockRejectedValue(new Error('kv 1/s'));
    for (let i = 0; i < 10; i++) await addPipelineCounter(env, DLQ_PARKED_COUNT_KEY, 1);
    await expect(readPipelineCounter(env, DLQ_PARKED_COUNT_KEY)).resolves.toBe(10);
  });

  it('counts a model DLQ batch and does not send it back to ingest', async () => {
    const send = vi.fn(async () => undefined);
    const ack = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });

    await handleDlqBatch(
      {
        queue: 'wc-model-dlq',
        messages: [
          {
            id: 'bulk',
            attempts: 4,
            timestamp: new Date(),
            body: { type: 'recompute_wc2026_bulk' },
            ack,
          },
        ],
      } as never,
      env,
    );

    expect(ack).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
    expect(vi.mocked(env.KV.put)).toHaveBeenCalledWith(
      dlqParkKey('wc-model-dlq', 'bulk'),
      expect.any(String),
      { expirationTtl: 345600 },
    );
    errorSpy.mockRestore();
  });

  it('parks an idempotent DLQ job that has no timestamp', async () => {
    const send = vi.fn(async () => undefined);
    const ack = vi.fn();
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });
    await handleDlqBatch(
      {
        queue: 'wc-ingest-dlq',
        messages: [
          {
            id: 'no-time',
            attempts: 4,
            body: { type: 'crawl_news', idempotencyKey: 'news-1' },
            ack,
          },
        ],
      } as never,
      env,
    );
    expect(send).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.KV.put)).toHaveBeenCalledWith(
      dlqParkKey('wc-ingest-dlq', 'no-time'),
      expect.any(String),
      { expirationTtl: 345600 },
    );
  });

  it('keeps the last good replay cursor when D1 is down', async () => {
    const rows = new Map<string, number>();
    const kvStore = new Map<string, string>();
    let dbDown = false;
    const kv = {
      get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        kvStore.set(key, value);
      }),
      delete: vi.fn(async () => undefined),
    };
    const db = createMockDb({
      first: (sql, binds) => {
        if (dbDown) throw new Error('d1 down');
        if (sql.includes('ON CONFLICT(key) DO UPDATE SET value = excluded.value')) {
          const key = String(binds[0]);
          const value = Number(binds[1]);
          const current = rows.get(key) ?? 0;
          if (!rows.has(key) || value > current) rows.set(key, value);
          return { value: rows.get(key) };
        }
        if (sql.includes('SELECT value FROM pipeline_counters')) {
          const value = rows.get(String(binds[0]));
          return value == null ? null : { value };
        }
        return null;
      },
    });
    const env = createMockEnv({ DB: db, KV: kv as never });
    const cursor = Date.now() + 60_000;
    await expect(saveReplayCursorMs(env, cursor)).resolves.toBe(true);
    expect(kvStore.get(DLQ_REPLAY_CURSOR_KV_KEY)).toBe(String(cursor));

    dbDown = true;
    await expect(loadReplayCursorMs(env)).resolves.toBe(cursor);
    await expect(saveReplayCursorMs(env, cursor + 90_000)).resolves.toBe(false);
    await expect(loadReplayCursorMs(env)).resolves.toBe(cursor + 90_000);
    expect(kvStore.get(DLQ_REPLAY_CURSOR_KV_KEY)).toBe(String(cursor));

    const fresh = createMockEnv({
      DB: createMockDb({
        first: () => {
          throw new Error('d1 down');
        },
      }),
      KV: kv as never,
    });
    await expect(loadReplayCursorMs(fresh)).resolves.toBe(cursor);
  });

  it('replays a recap sync onto the recap queue', async () => {
    const ingestSend = vi.fn(async () => undefined);
    const recapSend = vi.fn(async () => undefined);
    const env = createMockEnv({
      INGEST_QUEUE: { send: ingestSend } as never,
      RECAP_QUEUE: { send: recapSend } as never,
    });
    await handleDlqBatch(
      {
        queue: 'wc-ingest-dlq',
        messages: [
          {
            id: 'recap',
            attempts: 4,
            timestamp: new Date(),
            body: { type: 'sync_match_recap', matchRef: 'm-1', idempotencyKey: 'sync_match_recap:m-1' },
            ack: vi.fn(),
          },
        ],
      } as never,
      env,
    );
    expect(ingestSend).not.toHaveBeenCalled();
    expect(recapSend).toHaveBeenCalledWith({
      type: 'sync_match_recap',
      matchRef: 'm-1',
      idempotencyKey: 'sync_match_recap:m-1',
      fromDlq: true,
    });
  });

  it('spaces replays in memory when D1 rejects the cursor write', async () => {
    const persisted = String(Date.now() - 5_000);
    const kvStore = new Map<string, string>([[DLQ_REPLAY_CURSOR_KV_KEY, persisted]]);
    const kv = {
      get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        kvStore.set(key, value);
      }),
      delete: vi.fn(async () => undefined),
    };
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({
      INGEST_QUEUE: { send } as never,
      KV: kv as never,
      DB: createMockDb({
        first: () => {
          throw new Error('d1 down');
        },
      }),
    });

    await handleDlqBatch(
      {
        queue: 'wc-ingest-dlq',
        messages: [
          {
            id: 'one',
            attempts: 1,
            timestamp: new Date(),
            body: { type: 'crawl_news', idempotencyKey: 'news-1' },
            ack: vi.fn(),
          },
          {
            id: 'two',
            attempts: 1,
            timestamp: new Date(),
            body: { type: 'sync_leagues', idempotencyKey: 'league-1' },
            ack: vi.fn(),
          },
        ],
      } as never,
      env,
    );

    expect(send).toHaveBeenNthCalledWith(1, {
      type: 'crawl_news',
      idempotencyKey: 'news-1',
      fromDlq: true,
    });
    expect(send).toHaveBeenNthCalledWith(
      2,
      { type: 'sync_leagues', idempotencyKey: 'league-1', fromDlq: true },
      { delaySeconds: DRAIN_REPLAY_GAP_SECONDS },
    );
    expect(kvStore.get(DLQ_REPLAY_CURSOR_KV_KEY)).toBe(persisted);
    const fresh = createMockEnv({
      KV: kv as never,
      DB: createMockDb({
        first: () => {
          throw new Error('d1 down');
        },
      }),
    });
    await expect(loadReplayCursorMs(fresh)).resolves.toBe(Number(persisted));
  });
});
