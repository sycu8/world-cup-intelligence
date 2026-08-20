import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WC_NEWS_FEEDS,
  newsFeedSourceId,
  parseRssItems,
  extractImageUrl,
  isWorldCupRelated,
  isSoccerRelated,
  shouldKeepSoccerNews,
} from '../src/ingestion/adapters/TrustedNewsRssAdapter';
import { fetchFifaWc2026NewsItems } from '../src/ingestion/adapters/FifaWc2026NewsAdapter';
import { SOURCE_IDS, getIngestHandler } from '../src/ingestion/sourceRegistry';
import {
  STATSBOMB_WC_SEASONS,
  filterWorldCupSeasons,
  competitionsUrl,
  discoverStatsbombWcSeasons,
  parseStatsbombMatches,
  statsbombMatchUrl,
  mapStatsbombStage,
  estimateXgFromGoals,
} from '../src/ingestion/adapters/statsbombOpenData';

describe('ingestion TrustedNewsRssAdapter', () => {
  it('defines feeds and source id helper', () => {
    expect(WC_NEWS_FEEDS.length).toBeGreaterThan(5);
    expect(newsFeedSourceId('rss-guardian-wc')).toBe('src-rss-guardian-wc');
  });

  it('parseRssItems extracts CDATA and plain tags', () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title><![CDATA[Mexico World Cup 2026 squad]]></title>
          <link>https://example.com/a</link>
          <description><![CDATA[FIFA 2026 preview]]></description>
          <pubDate>Mon, 01 Jun 2026 12:00:00 GMT</pubDate>
          <media:content url="https://img.example.com/a.jpg"/>
        </item>
        <item>
          <title>Local news</title>
          <link>https://example.com/b</link>
          <summary>Nothing here</summary>
        </item>
      </channel></rss>`;
    const items = parseRssItems(xml, 10);
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toContain('Mexico World Cup');
    expect(items[0]?.imageUrl).toBe('https://img.example.com/a.jpg');
  });

  it('extractImageUrl checks multiple RSS image sources', () => {
    const block = `<item>
      <enclosure url="https://img.example.com/e.jpg" type="image/jpeg"/>
      <content:encoded><img src="https://img.example.com/c.jpg"/></content:encoded>
    </item>`;
    expect(extractImageUrl(block, '<img src="https://img.example.com/d.jpg"/>')).toBe(
      'https://img.example.com/e.jpg',
    );
    expect(extractImageUrl('<item></item>', '')).toBeNull();
    expect(
      extractImageUrl('<item><media:thumbnail url="https://img.example.com/t.jpg"/></item>', ''),
    ).toBe('https://img.example.com/t.jpg');
  });

  it('isWorldCupRelated matches keywords', () => {
    expect(isWorldCupRelated('Mexico lineup', 'World Cup 2026')).toBe(true);
    expect(isWorldCupRelated('USMNT roster', 'Concacaf qualifier in Atlanta')).toBe(true);
    expect(isWorldCupRelated('Mundial 2026', 'Selección mexicana en Monterrey')).toBe(true);
    expect(isWorldCupRelated('Vinicius injury', 'Brazil squad for Copa del Mundo')).toBe(true);
    expect(isWorldCupRelated('Local cricket', 'County championship')).toBe(false);
  });

  it('isSoccerRelated keeps global club football and drops non-soccer noise', () => {
    expect(isSoccerRelated('Premier League transfer window', 'Arsenal sign striker')).toBe(true);
    expect(isSoccerRelated('La Liga round-up', 'Real Madrid win El Clasico')).toBe(true);
    expect(isSoccerRelated('V.League 1 preview', 'Hà Nội FC vs CAHN')).toBe(true);
    expect(shouldKeepSoccerNews('Champions League draw', 'UEFA group stage')).toBe(true);
    expect(isSoccerRelated('NBA finals preview', 'Basketball playoffs')).toBe(false);
    expect(isSoccerRelated('County cricket championship', 'Test match')).toBe(false);
  });

  it('includes diverse regional news feeds', () => {
    const ids = WC_NEWS_FEEDS.map((f) => f.id);
    expect(ids).toContain('rss-uefa-news');
    expect(ids).toContain('rss-ussoccer');
    expect(ids).toContain('rss-marca-futbol');
    expect(ids).toContain('rss-ole-argentina');
    expect(ids).toContain('rss-guardian-football');
    expect(ids).toContain('rss-vnexpress-thethao');
    expect(WC_NEWS_FEEDS.length).toBeGreaterThanOrEqual(20);
  });
});

describe('ingestion FifaWc2026NewsAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns articles from nested JSON payload keys', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            items: [
              {
                headline: 'Nested WC2026 item',
                link: 'https://www.fifa.com/en/articles/nested-item',
                summary: 'World Cup',
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const items = await fetchFifaWc2026NewsItems(5);
    expect(items[0]?.title).toBe('Nested WC2026 item');
  });

  it('uses fallback article fields from the second JSON API candidate', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1;
      if (call === 1) return new Response('{}', { status: 404 });
      return new Response(
        JSON.stringify({
          news: [
            {
              headline: 'Thumbnail-only article',
              url: 'https://www.fifa.com/en/articles/thumb-only?utm=1',
              publishedAt: '2026-02-02T00:00:00Z',
              thumbnail: { url: 'https://img.fifa.com/thumb.jpg' },
            },
          ],
        }),
        { status: 200 },
      );
    });
    const items = await fetchFifaWc2026NewsItems(5);
    expect(items[0]?.title).toBe('Thumbnail-only article');
    expect(items[0]?.link).toBe('https://www.fifa.com/en/articles/thumb-only');
    expect(items[0]?.description).toBe('Thumbnail-only article');
    expect(items[0]?.imageUrl).toBe('https://img.fifa.com/thumb.jpg');
  });

  it('fetchArticleMeta uses title tag and description fallbacks', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      call += 1;
      const url = String(input);
      if (url.includes('/api/v3/')) return new Response('{}', { status: 404 });
      if (url.includes('canadamexicousa2026/news')) {
        return new Response('<a href="/en/articles/meta-fallback">Meta</a>', { status: 200 });
      }
      return new Response('<html><title>Title tag only</title></html>', { status: 200 });
    });
    const items = await fetchFifaWc2026NewsItems(3);
    expect(items[0]?.title).toBe('Title tag only');
  });

  it('fetchArticleMeta returns null when HTML has no title', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      call += 1;
      const url = String(input);
      if (url.includes('/api/v3/')) return new Response('{}', { status: 404 });
      if (url.includes('canadamexicousa2026/news')) {
        return new Response('<a href="/en/articles/no-title">No title</a>', { status: 200 });
      }
      return new Response('<html></html>', { status: 200 });
    });
    expect(await fetchFifaWc2026NewsItems(3)).toEqual([]);
  });

  it('fetchArticleMeta returns null on fetch failure', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      call += 1;
      const url = String(input);
      if (url.includes('/api/v3/')) return new Response('{}', { status: 404 });
      if (url.includes('canadamexicousa2026/news')) {
        return new Response('<a href="/en/articles/broken">Broken</a>', { status: 200 });
      }
      throw new Error('article fetch failed');
    });
    const items = await fetchFifaWc2026NewsItems(3);
    expect(items).toEqual([]);
  });

  it('extractNextDataArticles returns empty array on invalid JSON', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1;
      if (call <= 2) return new Response('{}', { status: 404 });
      return new Response('<script id="__NEXT_DATA__" type="application/json">{bad</script>', {
        status: 200,
      });
    });
    expect(await fetchFifaWc2026NewsItems(3)).toEqual([]);
  });

  it('returns articles from JSON API candidate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              title: 'WC2026 draw',
              slug: '/en/articles/wc2026-draw',
              teaser: 'Draw details',
              publishDate: '2026-01-01',
              image: { url: 'https://img.fifa.com/a.jpg' },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const items = await fetchFifaWc2026NewsItems(5);
    expect(items).toHaveLength(1);
    expect(items[0]?.link).toContain('fifa.com/en/articles/wc2026-draw');
  });

  it('falls back to __NEXT_DATA__ HTML parsing', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1;
      if (call <= 2) return new Response('{}', { status: 404 });
      const html = `<html><script id="__NEXT_DATA__" type="application/json">{
        "props":{"pageProps":{"news":{
          "items":[{"title":"Host cities","slug":"/en/articles/host-cities","summary":"USA"}]
        }}}
      }</script></html>`;
      return new Response(html, { status: 200 });
    });
    const items = await fetchFifaWc2026NewsItems(5);
    expect(items.some((i) => i.title === 'Host cities')).toBe(true);
  });

  it('filters duplicate and non-article next-data links while supporting path-based URLs', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1;
      if (call <= 2) return new Response('{}', { status: 404 });
      const html = `<html><script id="__NEXT_DATA__" type="application/json">{
        "props":{"pageProps":{"news":{
          "items":[
            {"title":"Kept one","path":"/en/articles/kept-one","summary":"World Cup"},
            {"title":"Kept one duplicate","path":"/en/articles/kept-one","summary":"Dup"},
            {"title":"Drop me","url":"https://www.fifa.com/en/other/drop-me","summary":"Other"}
          ]
        }}}
      }</script></html>`;
      return new Response(html, { status: 200 });
    });
    const items = await fetchFifaWc2026NewsItems(5);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Kept one');
  });

  it('normalizes relative slugs, nested items, and missing description metadata', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              title: 'Relative slug article',
              slug: 'en/articles/relative-slug',
              date: '2026-03-03T00:00:00Z',
            },
          ],
          data: {
            items: [
              {
                headline: 'Ignored duplicate structure',
                link: 'https://www.fifa.com/en/articles/ignored-duplicate',
                summary: 'Nested',
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const items = await fetchFifaWc2026NewsItems(5);
    expect(items[0]?.link).toBe('https://www.fifa.com/en/articles/relative-slug');
    expect(items[0]?.description).toBe('Relative slug article');
  });

  it('skips JSON articles with missing titles or links and returns [] for primitive payloads', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return new Response(
          JSON.stringify({
            items: [
              { slug: '/en/articles/no-title' },
              { title: 'No link article' },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify('not-an-object'), { status: 200 });
    });
    expect(await fetchFifaWc2026NewsItems(5)).toEqual([]);
  });

  it('returns no scraped article metadata when article responses are non-ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/v3/')) return new Response('{}', { status: 404 });
      if (url.includes('canadamexicousa2026/news')) {
        return new Response('<a href="/en/articles/non-ok-meta">Broken meta</a>', { status: 200 });
      }
      return new Response('down', { status: 503 });
    });
    expect(await fetchFifaWc2026NewsItems(3)).toEqual([]);
  });

  it('uses publishedAt from next-data items and meta name description from article pages', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      call += 1;
      const url = String(input);
      if (url.includes('/api/v3/')) return new Response('{}', { status: 404 });
      if (url.includes('canadamexicousa2026/news')) {
        const html = `<html><script id="__NEXT_DATA__" type="application/json">{
          "props":{"pageProps":{"news":{"items":[
            {"title":"Published-at item","path":"/en/articles/published-at-item","publishedAt":"2026-04-04T00:00:00Z"}
          ]}}}
        }</script></html>`;
        return new Response(html, { status: 200 });
      }
      return new Response(
        `<html><head>
          <title>Meta description title</title>
          <meta name="description" content="Fallback meta description"/>
        </head></html>`,
        { status: 200 },
      );
    });
    const items = await fetchFifaWc2026NewsItems(3);
    expect(items[0]?.pubDate).toBe('2026-04-04T00:00:00Z');

    call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/v3/')) return new Response('{}', { status: 404 });
      if (url.includes('canadamexicousa2026/news')) {
        return new Response('<a href="/en/articles/meta-name-desc">Meta desc</a>', { status: 200 });
      }
      return new Response(
        `<html><head>
          <title>Meta description title</title>
          <meta name="description" content="Fallback meta description"/>
        </head></html>`,
        { status: 200 },
      );
    });
    const scraped = await fetchFifaWc2026NewsItems(3);
    expect(scraped[0]?.description).toBe('Fallback meta description');
  });

  it('scrapes article links when JSON and Next data empty', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      call += 1;
      const url = String(input);
      if (url.includes('/api/v3/')) return new Response('{}', { status: 404 });
      if (url.includes('canadamexicousa2026/news')) {
        return new Response('<a href="/en/articles/wc-hosts">Hosts</a>', { status: 200 });
      }
      return new Response(
        `<html><head>
          <meta property="og:title" content="Hosts announced"/>
          <meta property="og:description" content="FIFA update"/>
          <meta property="og:image" content="https://img.fifa.com/h.jpg"/>
          <meta property="article:published_time" content="2026-02-01"/>
        </head></html>`,
        { status: 200 },
      );
    });
    const items = await fetchFifaWc2026NewsItems(3);
    expect(items[0]?.title).toBe('Hosts announced');
  });

  it('returns empty array on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    expect(await fetchFifaWc2026NewsItems()).toEqual([]);
  });

  it('returns empty array when the HTML page itself is not ok', async () => {
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1;
      if (call <= 2) return new Response('{}', { status: 404 });
      return new Response('down', { status: 503 });
    });
    expect(await fetchFifaWc2026NewsItems()).toEqual([]);
  });
});

describe('ingestion statsbombOpenData', () => {
  it('filterWorldCupSeasons keeps male senior WC seasons', () => {
    const rows = filterWorldCupSeasons([
      {
        competition_id: 43,
        season_id: 106,
        competition_name: 'FIFA World Cup',
        competition_gender: 'male',
        competition_youth: false,
        season_name: '2022',
        match_available: '2022-12-18',
      },
      {
        competition_id: 43,
        season_id: 1,
        competition_name: 'FIFA World Cup',
        competition_gender: 'female',
        competition_youth: false,
        season_name: '2023',
        match_available: '2023-01-01',
      },
    ]);
    expect(rows).toEqual([{ seasonId: 106, year: 2022, tournamentId: 't-2022' }]);
  });

  it('competitionsUrl and statsbombMatchUrl build raw GitHub paths', () => {
    expect(competitionsUrl()).toContain('competitions.json');
    expect(statsbombMatchUrl(43, 106)).toContain('/matches/43/106.json');
  });

  it('parseStatsbombMatches filters invalid rows', () => {
    const valid = parseStatsbombMatches([
      {
        match_id: 1,
        match_date: '2022-11-20',
        kick_off: '19:00:00.000',
        home_team: { home_team_name: 'Qatar' },
        away_team: { away_team_name: 'Ecuador' },
        home_score: 0,
        away_score: 2,
      },
      { match_id: 'bad' },
    ]);
    expect(valid).toHaveLength(1);
    expect(parseStatsbombMatches(null)).toEqual([]);
  });

  it('mapStatsbombStage and estimateXgFromGoals', () => {
    expect(mapStatsbombStage(undefined)).toBe('Group');
    expect(mapStatsbombStage('Quarter-Final')).toBe('QF');
    expect(mapStatsbombStage('Semi-Final')).toBe('SF');
    expect(mapStatsbombStage('Final')).toBe('Final');
    expect(mapStatsbombStage('Round of 16')).toBe('R16');
    expect(mapStatsbombStage('Match for third place')).toBe('3rd Place');
    expect(estimateXgFromGoals(0)).toBeGreaterThan(0);
    expect(estimateXgFromGoals(3)).toBeCloseTo(2.9, 1);
  });

  it('discoverStatsbombWcSeasons uses fallback on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('fail', { status: 500 }));
    expect(await discoverStatsbombWcSeasons(2006)).toEqual(STATSBOMB_WC_SEASONS);
  });

  it('discoverStatsbombWcSeasons falls back when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    expect(await discoverStatsbombWcSeasons(2006)).toEqual(STATSBOMB_WC_SEASONS);
  });

  it('discoverStatsbombWcSeasons falls back when filtered list is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            competition_id: 43,
            season_id: 1,
            competition_name: 'FIFA World Cup',
            competition_gender: 'female',
            competition_youth: false,
            season_name: '2022',
            match_available: '2022-12-18',
          },
        ]),
        { status: 200 },
      ),
    );
    expect(await discoverStatsbombWcSeasons(2006)).toEqual(STATSBOMB_WC_SEASONS);
  });

  it('discoverStatsbombWcSeasons parses competitions.json', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            competition_id: 43,
            season_id: 106,
            competition_name: 'FIFA World Cup',
            competition_gender: 'male',
            competition_youth: false,
            season_name: '2022',
            match_available: '2022-12-18',
          },
        ]),
        { status: 200 },
      ),
    );
    const seasons = await discoverStatsbombWcSeasons(2020);
    expect(seasons[0]?.year).toBe(2022);
  });
});

describe('ingestion sourceRegistry', () => {
  it('maps source ids to ingest handlers', () => {
    expect(getIngestHandler(SOURCE_IDS.statsbomb)).toBe('statsbomb');
    expect(getIngestHandler(SOURCE_IDS.footballData)).toBe('football-data');
    expect(getIngestHandler('unknown')).toBeNull();
  });
});
