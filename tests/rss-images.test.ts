import { describe, expect, it } from 'vitest';
import { extractImageUrl, parseRssItems } from '../src/ingestion/adapters/TrustedNewsRssAdapter';
import { computeHotScore, mediumThumbnailUrl } from '../src/services/newsScoring';
import { normalizeFeedImageUrl } from '../src/services/newsImageUrls';

describe('rss image extraction', () => {
  it('extracts media:content url', () => {
    const block = `<item><media:content url="https://cdn.example.com/photo.jpg" type="image/jpeg"/></item>`;
    expect(extractImageUrl(block, '')).toBe('https://cdn.example.com/photo.jpg');
  });

  it('extracts BBC media:thumbnail', () => {
    const block = `<item>
      <title>World Cup squads</title>
      <link>https://www.bbc.com/sport/football/articles/c89348x0x14o</link>
      <pubDate>Wed, 03 Jun 2026 18:00:57 GMT</pubDate>
      <media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/ace/standard/240/x.jpg"/>
    </item>`;
    expect(extractImageUrl(block, '')).toBe('https://ichef.bbci.co.uk/ace/standard/240/x.jpg');
  });

  it('extracts img from description', () => {
    const desc = '<p><img src="https://cdn.example.com/thumb.png" alt="x"/></p>';
    expect(extractImageUrl('<item></item>', desc)).toBe('https://cdn.example.com/thumb.png');
  });

  it('parseRssItems includes imageUrl', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>World Cup 2026 draw</title>
        <link>https://example.com/a</link>
        <description><![CDATA[<img src="https://cdn.example.com/wc.jpg"/> preview]]></description>
        <pubDate>Mon, 01 Jun 2026 12:00:00 GMT</pubDate>
      </item>
    </channel></rss>`;
    const items = parseRssItems(xml, 5);
    expect(items[0]?.imageUrl).toBe('https://cdn.example.com/wc.jpg');
  });
});

describe('newsScoring', () => {
  it('scores recent articles higher', () => {
    const recent = computeHotScore(new Date().toISOString(), 0.8);
    const old = computeHotScore('2020-01-01T00:00:00Z', 0.8);
    expect(recent).toBeGreaterThan(old);
  });

  it('upgrades BBC thumb to 976 width path', () => {
    const url = normalizeFeedImageUrl(
      'https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/x.jpg',
    );
    expect(url).toContain('/standard/240/');
  });

  it('adds guardian width for medium thumb', () => {
    const url = mediumThumbnailUrl('https://i.guim.co.uk/img.jpg');
    expect(url).toContain('width=460');
  });
});
