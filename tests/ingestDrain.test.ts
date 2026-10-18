import { describe, expect, it, vi } from 'vitest';
import { handleDlqBatch } from '../src/queues/dlqConsumer';
import {
  REFRESH_MIN_GAP_MS,
  REFRESH_STALE_MS,
  estimateIngestDrainSeconds,
  ingestDedupeKey,
  isStaleIngestTick,
  isStaleRefreshMinute,
  refreshRunIsDue,
} from '../src/queues/ingestDrain';
import { createMockEnv } from './helpers/mockEnv';

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
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'crawl_news', idempotencyKey: 'news-1', fromDlq: true });
    const logged = errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('refresh_minute');
    expect(logged).toContain('crawl_news');
    expect(logged).toContain('"replayed":1');
    errorSpy.mockRestore();
  });

  it('does not ack a DLQ message when the replay send fails', async () => {
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
    expect(ack).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('queue dlq replay failed');
    errorSpy.mockRestore();
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
    errorSpy.mockRestore();
  });
});
