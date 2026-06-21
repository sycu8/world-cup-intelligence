import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildProbabilityHints } from '../src/services/matchHints';
import { getGroupContextForMatch } from '../src/services/matchGroupContext';
import { getProjectedLineupForMatch } from '../src/services/matchLineupProjection';
import {
  backfillNewsSources,
  registerNewsFeedSource,
} from '../src/services/newsSourceBackfill';
import {
  backfillNewsThumbnails,
  imageUrlFromRaw,
  recompressNewsThumbnails,
  resolveNewsThumbSourceUrl,
} from '../src/services/newsThumbnailBackfill';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { WC2026_TOURNAMENT_ID } from '../src/constants/tournament';

vi.mock('../src/services/newsImagePipeline', () => ({
  compressAndStoreNewsImage: vi.fn(async () => 'news/thumbs/doc-1.webp'),
  newsAssetPublicPath: vi.fn((id: string) => `/api/news/assets/${id}`),
  thumbNeedsRecompress: vi.fn((contentType?: string, size?: number) => {
    if (contentType === 'image/jpeg') return true;
    return (size ?? 0) > 40_000;
  }),
}));

vi.mock('../src/ingestion/adapters/TrustedNewsRssAdapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ingestion/adapters/TrustedNewsRssAdapter')>();
  return {
    ...actual,
    parseRssItems: vi.fn(() => [
      {
        link: 'https://www.theguardian.com/football/article',
        imageUrl: 'https://cdn.example.com/guardian.jpg',
      },
    ]),
  };
});

describe('matchHints', () => {
  const base = {
    homeName: 'Mexico',
    awayName: 'South Africa',
    homeWin: 0.42,
    draw: 0.28,
    awayWin: 0.3,
    xgHome: 1.5,
    xgAway: 1.1,
  };

  it('prefers home favourite hint', () => {
    const hints = buildProbabilityHints({ ...base, homeWin: 0.45, draw: 0.25, awayWin: 0.3 });
    expect(hints[0]?.id).toBe('fav-home');
  });

  it('prefers away favourite hint', () => {
    const hints = buildProbabilityHints({ ...base, homeWin: 0.2, draw: 0.25, awayWin: 0.45 });
    expect(hints[0]?.id).toBe('fav-away');
  });

  it('prefers draw hint when draw is highest', () => {
    const hints = buildProbabilityHints({ ...base, homeWin: 0.3, draw: 0.4, awayWin: 0.3 });
    expect(hints[0]?.id).toBe('fav-draw');
  });

  it('includes score, confidence tiers, and head-to-head', () => {
    const hints = buildProbabilityHints({
      ...base,
      mostLikelyScore: '2-1',
      confidence: 0.66,
      h2h: { homeWins: 2, awayWins: 1, draws: 0, total: 3 },
    });
    expect(hints.some((h) => h.id === 'score')).toBe(true);
    expect(hints.some((h) => h.en.includes('medium'))).toBe(true);
    expect(hints.some((h) => h.id === 'h2h')).toBe(true);
  });

  it('uses low confidence label below 0.65', () => {
    const hints = buildProbabilityHints({ ...base, confidence: 0.5 });
    expect(hints.some((h) => h.en.includes('low'))).toBe(true);
  });
});

describe('matchGroupContext', () => {
  it('returns empty fixtures without group code', async () => {
    const env = createMockEnv();
    expect(await getGroupContextForMatch(env, 'm-1', null)).toEqual({
      fixtures: [],
      groupCode: null,
    });
  });

  it('loads sibling group fixtures from D1', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'm-2',
              kickoff_utc: '2026-06-12T18:00:00Z',
              home_short: 'MEX',
              home_name: 'Mexico',
              away_short: null,
              away_name: 'Canada',
            },
          ],
        }),
      }),
    });
    const ctx = await getGroupContextForMatch(env, 'm-1', 'A');
    expect(ctx.groupCode).toBe('A');
    expect(ctx.fixtures[0]?.home).toBe('MEX');
    expect(ctx.fixtures[0]?.away).toBe('Canada');
  });
});

describe('matchLineupProjection', () => {
  it('returns official lineup when starters exist', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ id: 'lu-1', formation: '4-3-3', is_official: 1 }),
        all: () => ({ results: [{ name: 'Starter One' }, { name: 'Starter Two' }] }),
      }),
    });
    const lineup = await getProjectedLineupForMatch(env, 'm-1', 'team-usa', 'USA');
    expect(lineup.source).toBe('official');
    expect(lineup.players).toHaveLength(2);
  });

  it('falls back to squad roster when lineup missing', async () => {
    const squadPlayers = Array.from({ length: 8 }, (_, i) => ({
      name: `Squad ${i}`,
      position: i === 0 ? 'GK' : 'MF',
      listed_position: i === 0 ? 'GK' : 'MF',
    }));
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: (sql, binds) => {
          if (sql.includes('squad_players')) return { results: squadPlayers };
          return { results: [] };
        },
      }),
    });
    const lineup = await getProjectedLineupForMatch(env, 'm-1', 'team-usa', 'USA');
    expect(lineup.source).toBe('squad');
    expect(lineup.players).toHaveLength(8);
  });

  it('uses club players when squad is thin', async () => {
    const clubPlayers = Array.from({ length: 6 }, (_, i) => ({
      name: `Club ${i}`,
      position: 'FW',
    }));
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: (sql) => {
          if (sql.includes('squad_players')) return { results: [] };
          if (sql.includes('primary_team_id')) return { results: clubPlayers };
          return { results: [] };
        },
      }),
    });
    const lineup = await getProjectedLineupForMatch(env, 'm-1', 'team-usa', 'United States');
    expect(lineup.source).toBe('projected');
    expect(lineup.players).toHaveLength(6);
  });

  it('synthesizes roster labels when no players found', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => null,
        all: () => ({ results: [] }),
      }),
    });
    const lineup = await getProjectedLineupForMatch(env, 'm-1', 'team-usa', 'United States');
    expect(lineup.source).toBe('projected');
    expect(lineup.players).toHaveLength(11);
    expect(lineup.players[0]).toContain('United States');
  });
});

describe('newsSourceBackfill', () => {
  it('backfillNewsSources upserts feeds and updates legacy rows', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        run: () => ({ success: true, meta: { changes: 2 } }),
      }),
    });
    const updated = await backfillNewsSources(env);
    expect(updated).toBeGreaterThan(0);
  });

  it('registerNewsFeedSource marks registry healthy', async () => {
    const runCalls: string[] = [];
    const env = createMockEnv({
      DB: createMockDb({
        run: (sql) => {
          runCalls.push(sql);
          return { success: true };
        },
      }),
    });
    const id = await registerNewsFeedSource(env, {
      id: 'guardian-wc',
      publisher: 'The Guardian',
      url: 'https://www.theguardian.com/football/rss',
      reliability: 0.9,
    });
    expect(id).toContain('guardian-wc');
    expect(runCalls.some((sql) => sql.includes("health_status = 'healthy'"))).toBe(true);
  });
});

describe('newsThumbnailBackfill', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<rss><channel></channel></rss>', {
          status: 200,
          headers: { 'content-type': 'application/rss+xml' },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('imageUrlFromRaw reads imageUrl from R2 raw payload', async () => {
    const env = createMockEnv({
      R2_RAW: {
        get: vi.fn(async () => ({
          text: async () => JSON.stringify({ imageUrl: 'https://cdn.example.com/a.jpg' }),
        })),
      } as never,
    });
    expect(await imageUrlFromRaw(env, 'news/raw/doc.json')).toContain('cdn.example.com');
    expect(await imageUrlFromRaw(env, null)).toBeNull();
  });

  it('imageUrlFromRaw handles invalid JSON', async () => {
    const env = createMockEnv({
      R2_RAW: { get: vi.fn(async () => ({ text: async () => 'not-json' })) } as never,
    });
    expect(await imageUrlFromRaw(env, 'raw/key')).toBeNull();
  });

  it('resolveNewsThumbSourceUrl prefers raw payload over RSS index', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({
          source_url: 'https://www.theguardian.com/football/article',
          content_r2_key: 'news/guardian/doc.json',
        }),
      }),
      R2_RAW: {
        get: vi.fn(async () => ({
          text: async () => JSON.stringify({ imageUrl: 'https://cdn.example.com/raw.jpg' }),
        })),
      } as never,
    });
    expect(await resolveNewsThumbSourceUrl(env, 'doc-1')).toContain('raw.jpg');
  });

  it('resolveNewsThumbSourceUrl returns null when document missing', async () => {
    const env = createMockEnv({ DB: createMockDb({ first: () => null }) });
    expect(await resolveNewsThumbSourceUrl(env, 'missing')).toBeNull();
  });

  it('backfillNewsThumbnails returns zero when no rows', async () => {
    const env = createMockEnv({ DB: createMockDb({ all: () => ({ results: [] }) }) });
    expect(await backfillNewsThumbnails(env)).toBe(0);
  });

  it('backfillNewsThumbnails stores compressed thumb when image found', async () => {
    const { compressAndStoreNewsImage } = await import('../src/services/newsImagePipeline');
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'doc-1',
              source_url: 'https://www.theguardian.com/football/article',
              content_r2_key: null,
            },
          ],
        }),
        run: () => ({ success: true }),
      }),
    });
    const updated = await backfillNewsThumbnails(env, 5);
    expect(updated).toBe(1);
    expect(compressAndStoreNewsImage).toHaveBeenCalled();
  });

  it('backfillNewsThumbnails falls back to remote url when compress fails', async () => {
    const { compressAndStoreNewsImage } = await import('../src/services/newsImagePipeline');
    vi.mocked(compressAndStoreNewsImage).mockResolvedValueOnce(null);
    const runCalls: string[] = [];
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'doc-2',
              source_url: 'https://www.theguardian.com/football/article',
              content_r2_key: null,
            },
          ],
        }),
        run: (sql) => {
          runCalls.push(sql);
          return { success: true };
        },
      }),
    });
    expect(await backfillNewsThumbnails(env, 5)).toBe(1);
    expect(runCalls.some((sql) => sql.includes('thumbnail_url = ?'))).toBe(true);
  });

  it('backfillNewsThumbnails tolerates RSS feed failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'doc-rss-fail',
              source_url: 'https://unknown.example/article',
              content_r2_key: 'news/raw/doc.json',
            },
          ],
        }),
      }),
      R2_RAW: {
        get: vi.fn(async () => ({
          text: async () => JSON.stringify({ imageUrl: 'https://cdn.example.com/fallback.jpg' }),
        })),
      } as never,
    });
    expect(await backfillNewsThumbnails(env, 5)).toBe(1);
  });

  it('recompressNewsThumbnails re-encodes legacy thumbs', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'doc-3',
              source_url: 'https://www.theguardian.com/football/article',
              content_r2_key: null,
              thumbnail_r2_key: 'news/thumbs/doc-3.webp',
            },
          ],
        }),
        run: () => ({ success: true }),
      }),
      R2_ARTIFACTS: {
        head: vi.fn(async () => ({
          httpMetadata: { contentType: 'image/jpeg' },
          size: 90_000,
        })),
      } as never,
    });
    expect(await recompressNewsThumbnails(env, 5)).toBe(1);
  });

  it('resolveNewsThumbSourceUrl falls back to RSS index when raw missing image', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({
          source_url: 'https://www.theguardian.com/football/article',
          content_r2_key: 'news/guardian/doc.json',
        }),
      }),
      R2_RAW: {
        get: vi.fn(async () => ({
          text: async () => JSON.stringify({ imageUrl: null }),
        })),
      } as never,
    });
    expect(await resolveNewsThumbSourceUrl(env, 'doc-rss')).toContain('guardian.jpg');
  });

  it('recompressNewsThumbnails uses raw payload when RSS misses', async () => {
    const { compressAndStoreNewsImage } = await import('../src/services/newsImagePipeline');
    vi.mocked(compressAndStoreNewsImage).mockResolvedValueOnce('news/thumbs/doc-raw.webp');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'doc-raw',
              source_url: 'https://unknown.example/article',
              content_r2_key: 'news/raw/doc.json',
              thumbnail_r2_key: 'news/thumbs/doc-raw.jpg',
            },
          ],
        }),
        run: () => ({ success: true }),
      }),
      R2_ARTIFACTS: {
        head: vi.fn(async () => ({
          httpMetadata: { contentType: 'image/jpeg' },
          size: 90_000,
        })),
      } as never,
      R2_RAW: {
        get: vi.fn(async () => ({
          text: async () => JSON.stringify({ imageUrl: 'https://cdn.example.com/from-raw.jpg' }),
        })),
      } as never,
    });
    expect(await recompressNewsThumbnails(env, 5)).toBe(1);
  });

  it('backfillNewsThumbnails tolerates RSS feed fetch exceptions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('rss down');
    }));
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            {
              id: 'doc-rss-throw',
              source_url: 'https://unknown.example/article',
              content_r2_key: 'news/raw/doc.json',
            },
          ],
        }),
      }),
      R2_RAW: {
        get: vi.fn(async () => ({
          text: async () => JSON.stringify({ imageUrl: 'https://cdn.example.com/fallback.jpg' }),
        })),
      } as never,
    });
    expect(await backfillNewsThumbnails(env, 5)).toBe(1);
  });
});
