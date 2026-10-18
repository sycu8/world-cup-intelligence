import { describe, expect, it, vi } from 'vitest';
import { ensureNewsCrawlFresh, ensurePipelineFresh } from '../src/services/pipelineBootstrap';

vi.mock('../src/ingestion/newsCrawler', () => ({
  crawlWorldCupNews: vi.fn(async () => undefined),
}));

function mockEnv(opts: {
  lastCrawl?: string | null;
  lock?: string | null;
  queue?: boolean;
  lastRefresh?: string | null;
  refreshLock?: string | null;
}) {
  const kv = new Map<string, string>();
  if (opts.lastCrawl) kv.set('meta:last_news_crawl', opts.lastCrawl);
  if (opts.lock) kv.set('meta:news_crawl_lock', opts.lock);
  if (opts.lastRefresh) kv.set('meta:last_data_refresh', opts.lastRefresh);
  if (opts.refreshLock) kv.set('meta:refresh_lock', opts.refreshLock);

  const send = vi.fn(async () => undefined);
  return {
    env: {
      KV: {
        get: vi.fn(async (k: string) => kv.get(k) ?? null),
        put: vi.fn(async (k: string, v: string) => {
          kv.set(k, v);
        }),
      },
      INGEST_QUEUE: opts.queue === false ? undefined : { send },
    } as never,
    send,
  };
}

describe('ensureNewsCrawlFresh', () => {
  it('skips when last crawl is recent', async () => {
    const { env, send } = mockEnv({
      lastCrawl: new Date(Date.now() - 5 * 60_000).toISOString(),
      queue: true,
    });
    await ensureNewsCrawlFresh(env);
    expect(send).not.toHaveBeenCalled();
  });

  it('enqueues crawl when stale', async () => {
    const { env, send } = mockEnv({
      lastCrawl: new Date(Date.now() - 20 * 60_000).toISOString(),
      queue: true,
    });
    await ensureNewsCrawlFresh(env);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'crawl_news' }),
    );
  });

  it('runs inline crawl when queue unavailable', async () => {
    const { crawlWorldCupNews } = await import('../src/ingestion/newsCrawler');
    const { env } = mockEnv({
      lastCrawl: new Date(Date.now() - 20 * 60_000).toISOString(),
      queue: false,
    });
    await ensureNewsCrawlFresh(env);
    expect(crawlWorldCupNews).toHaveBeenCalled();
  });

  it('skips when crawl lock is present', async () => {
    const { env, send } = mockEnv({
      lastCrawl: new Date(Date.now() - 20 * 60_000).toISOString(),
      lock: '1',
      queue: true,
    });
    await ensureNewsCrawlFresh(env);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('ensurePipelineFresh', () => {
  it('skips when refresh is recent', async () => {
    const { env, send } = mockEnv({
      lastRefresh: new Date().toISOString(),
      queue: true,
    });
    await ensurePipelineFresh(env);
    expect(send).not.toHaveBeenCalled();
  });

  it('enqueues minute refresh when stale', async () => {
    const { env, send } = mockEnv({
      lastRefresh: new Date(Date.now() - 120_000).toISOString(),
      queue: true,
    });
    await ensurePipelineFresh(env);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'refresh_minute' }));
  });

  it('respects refresh lock', async () => {
    const { env, send } = mockEnv({
      lastRefresh: new Date(Date.now() - 120_000).toISOString(),
      refreshLock: '1',
      queue: true,
    });
    await ensurePipelineFresh(env);
    expect(send).not.toHaveBeenCalled();
  });
});
