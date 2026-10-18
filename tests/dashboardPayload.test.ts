import { describe, expect, it } from 'vitest';
import { WC2026_TOURNAMENT_ID } from '../src/constants/tournament';
import { buildDashboardPayload } from '../src/services/dashboardPayload';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';

const featured = {
  id: 'm-live',
  kickoff_utc: '2026-06-15T18:00:00.000Z',
  status: 'live',
  stage: 'Group',
  group_code: 'A',
  home_name: 'United States',
  away_name: 'Mexico',
  home_short: 'USA',
  away_short: 'MEX',
  home_country_code: 'US',
  away_country_code: 'MX',
  slug: 'vong-bang-a-united-states-vs-mexico',
  probability: null,
};

describe('buildDashboardPayload', () => {
  it('aggregates featured match, counts, pipeline metadata, and status breakdown', async () => {
    const env = createMockEnv({
      KV: createMockKv({
        'meta:last_data_refresh': '2026-06-01T00:00:00.000Z',
        'meta:last_news_crawl': '2026-06-01T00:15:00.000Z',
      }),
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('COUNT(*) AS n FROM matches')) return { n: 104 };
          if (sql.includes('COUNT(DISTINCT group_code)')) return { n: 12 };
          if (sql.includes("m.status = 'live'")) return featured;
          return null;
        },
        all: () => ({
          results: [
            { status: 'scheduled', n: 90 },
            { status: 'live', n: 2 },
            { status: 'finished', n: 12 },
          ],
        }),
      }),
    });

    const payload = await buildDashboardPayload(env);

    expect(payload.featuredMatch?.id).toBe('m-live');
    expect(payload.matchCount).toBe(104);
    expect(payload.lastDataRefresh).toBe('2026-06-01T00:00:00.000Z');
    expect(payload.lastNewsCrawl).toBe('2026-06-01T00:15:00.000Z');
    expect(payload.refreshIntervalSec).toBe(60);
    expect(payload.newsCrawlIntervalSec).toBe(900);
    expect(payload.expectedMatches).toBe(104);
    expect(payload.hostCountries).toEqual(['United States', 'Mexico', 'Canada']);
    expect(payload.teamsCount).toBe(48);
    expect(payload.groupCount).toBe(12);
    expect(payload.statusCounts).toEqual({ scheduled: 90, live: 2, finished: 12 });
  });

  it('defaults counts when queries return null', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: () => ({ results: undefined }),
      }),
    });

    const payload = await buildDashboardPayload(env);

    expect(payload.featuredMatch).toBeNull();
    expect(payload.matchCount).toBe(0);
    expect(payload.groupCount).toBe(12);
    expect(payload.statusCounts).toEqual({});
  });
});
