import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleScheduledCron } from '../src/scheduled/cron';
import { createMockEnv } from './helpers/mockEnv';

vi.mock('../src/ingestion/newsCrawler', () => ({
  crawlWorldCupNews: vi.fn(async () => 3),
}));

vi.mock('../src/services/bulkRecomputeRunner', () => ({
  runBulkRecomputeIfPending: vi.fn(async () => false),
}));

vi.mock('../src/services/cacheWarm', () => ({
  warmPayloadCaches: vi.fn(async () => undefined),
}));

describe('handleScheduledCron', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues minute refresh and warms caches with waitUntil', async () => {
    const send = vi.fn(async () => undefined);
    const waitUntil = vi.fn();
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleScheduledCron(env, '* * * * *', { waitUntil } as ExecutionContext);

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'refresh_minute' }));
    expect(waitUntil).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('awaits cache warm when no execution context is provided', async () => {
    const { warmPayloadCaches } = await import('../src/services/cacheWarm');
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleScheduledCron(env, 'every-minute');

    expect(warmPayloadCaches).toHaveBeenCalledWith(env);
  });

  it('enqueues news crawl on 15-minute schedule when queue is bound', async () => {
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleScheduledCron(env, '*/15 * * * *');

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'crawl_news' }));
    logSpy.mockRestore();
  });

  it('runs inline news crawl when ingest queue is missing', async () => {
    const { crawlWorldCupNews } = await import('../src/ingestion/newsCrawler');
    const env = createMockEnv({ INGEST_QUEUE: undefined });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleScheduledCron(env, 'every-15-min');

    expect(crawlWorldCupNews).toHaveBeenCalledWith(env);
  });

  it('uses waitUntil for inline news crawl when context exists', async () => {
    const waitUntil = vi.fn();
    const env = createMockEnv({ INGEST_QUEUE: undefined });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleScheduledCron(env, 'every-15-min', { waitUntil } as ExecutionContext);

    expect(waitUntil).toHaveBeenCalled();
  });

  it('skips statsbomb enqueue when bulk recompute is pending', async () => {
    const { runBulkRecomputeIfPending } = await import('../src/services/bulkRecomputeRunner');
    vi.mocked(runBulkRecomputeIfPending).mockResolvedValueOnce(true);
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });

    await handleScheduledCron(env, '0 3 * * 1');

    expect(send).not.toHaveBeenCalled();
  });

  it('enqueues statsbomb ingest on weekly cron', async () => {
    const send = vi.fn(async () => undefined);
    const env = createMockEnv({ INGEST_QUEUE: { send } as never });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await handleScheduledCron(env, 'weekly-statsbomb');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'source_ingest', sourceId: 'src-statsbomb' }),
    );
    logSpy.mockRestore();
  });
});
