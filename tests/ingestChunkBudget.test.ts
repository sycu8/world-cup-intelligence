import { describe, expect, it } from 'vitest';
import { crawlWorldCupNewsChunk } from '../src/ingestion/newsCrawler';
import { ingestStatsbombWorldCup } from '../src/ingestion/statsbombIngest';
import { syncAllClubLeagues } from '../src/ingestion/leagues/syncLeagues';
import {
  CONSUMER_BATCH_DEADLINE_MS,
  INGEST_LONG_JOB_TIMEOUT_MS,
  MODEL_MESSAGE_TIMEOUT_MS,
  ingestMessageTimeoutMs,
} from '../src/queues/modelJobLane';
import type { AppEnv } from '../src/env';

describe('long ingest jobs stay off the 90s restart loop', () => {
  it('gives crawl, statsbomb, league sync, and bulk ingest a deadline above 90s and under the batch cap', () => {
    for (const type of ['crawl_news', 'source_ingest', 'sync_leagues', 'bulk_ingest']) {
      const timeout = ingestMessageTimeoutMs(type);
      expect(timeout).toBe(INGEST_LONG_JOB_TIMEOUT_MS);
      expect(timeout).toBeGreaterThan(MODEL_MESSAGE_TIMEOUT_MS);
      expect(timeout).toBeLessThan(CONSUMER_BATCH_DEADLINE_MS);
    }
  });

  it('a news crawl with no time left returns the same feed cursor', async () => {
    const chunk = await crawlWorldCupNewsChunk({} as AppEnv, { budgetMs: 0, now: () => 1_000 });
    expect(chunk).toEqual({ inserted: 0, done: false, feedCursor: 0 });
  });

  it('a statsbomb crawl with no time left returns the same season cursor', async () => {
    const result = await ingestStatsbombWorldCup({} as AppEnv, {
      seasonCursor: 2,
      budgetMs: 0,
      now: () => 5_000,
    });
    expect(result.done).toBe(false);
    expect(result.seasonCursor).toBe(2);
    expect(result.seasonsProcessed).toBe(0);
  });

  it('a league sync past the last league does not start another league', async () => {
    const results = await syncAllClubLeagues({} as AppEnv, { leagueCursor: 99, budgetMs: 1 });
    expect(results).toHaveLength(0);
    expect(results.done).toBe(true);
  });
});
