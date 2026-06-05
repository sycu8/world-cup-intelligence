/** Trusted RSS feeds — no HTML scraping of search results. */
export const WC_NEWS_FEEDS = [
  {
    id: 'rss-guardian-wc',
    name: 'The Guardian World Cup',
    publisher: 'The Guardian',
    url: 'https://www.theguardian.com/football/world-cup/rss',
    reliability: 0.82,
  },
  {
    id: 'rss-bbc-football',
    name: 'BBC Sport Football',
    publisher: 'BBC',
    url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
    reliability: 0.85,
  },
  {
    id: 'rss-fifa-news',
    name: 'FIFA News',
    publisher: 'FIFA',
    url: 'https://www.fifa.com/news/rss',
    reliability: 0.9,
  },
  {
    id: 'rss-ap-soccer',
    name: 'AP Soccer',
    publisher: 'Associated Press',
    url: 'https://apnews.com/hub/soccer?output=rss',
    reliability: 0.84,
  },
  {
    id: 'rss-sky-football',
    name: 'Sky Sports Football',
    publisher: 'Sky Sports',
    url: 'https://www.skysports.com/rss/12040',
    reliability: 0.8,
  },
  {
    id: 'rss-reuters-soccer',
    name: 'Reuters Soccer',
    publisher: 'Reuters',
    url: 'https://www.reuters.com/sports/soccer/rss',
    reliability: 0.86,
  },
] as const;

export type NewsFeed = (typeof WC_NEWS_FEEDS)[number];

export function newsFeedSourceId(feedId: string): string {
  return `src-${feedId}`;
}

export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  imageUrl: string | null;
};

export function parseRssItems(xml: string, maxItems = 15): RssItem[] {
  const items: RssItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks.slice(0, maxItems)) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description') || extractTag(block, 'summary');
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published');
    if (title && link) {
      items.push({
        title: decodeEntities(stripHtml(title)),
        link: link.trim(),
        description: decodeEntities(stripHtml(description)),
        pubDate: pubDate || new Date().toISOString(),
        imageUrl: extractImageUrl(block, description),
      });
    }
  }
  return items;
}

function extractTag(block: string, tag: string): string {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(block);
  if (cdata) return cdata[1].trim();
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
  return plain ? plain[1].trim() : '';
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

export function extractImageUrl(block: string, description: string): string | null {
  const fromAttr = (tag: string, attr = 'url') => {
    const after = new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["']`, 'i').exec(block)?.[1]?.trim();
    if (after) return after;
    const before = new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["'][^>]*/?>`, 'i').exec(block)?.[1]?.trim();
    return before ?? null;
  };
  const mediaUrl =
    /<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i.exec(block)?.[1]?.trim() ?? null;
  const enclosure = /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i.exec(block);
  const encoded = extractTag(block, 'content:encoded') || extractTag(block, 'content');
  const imgInEncoded = encoded ? /<img[^>]+src=["']([^"']+)["']/i.exec(encoded) : null;
  const imgInDesc = /<img[^>]+src=["']([^"']+)["']/i.exec(description);
  return (
    fromAttr('media:content') ||
    fromAttr('media:thumbnail') ||
    mediaUrl ||
    enclosure?.[1]?.trim() ||
    imgInEncoded?.[1]?.trim() ||
    imgInDesc?.[1]?.trim() ||
    null
  );
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function isWorldCupRelated(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  const keywords = [
    'world cup',
    'fifa',
    '2026',
    'qatar 2022',
    'messi',
    'mbappé',
    'mbappe',
    'argentina',
    'france',
    'semi-final',
    'quarter-final',
  ];
  return keywords.some((k) => text.includes(k));
}
