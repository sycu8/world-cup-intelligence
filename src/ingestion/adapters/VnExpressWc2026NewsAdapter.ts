import type { RssItem } from './TrustedNewsRssAdapter';

export const VNEXPRESS_WC2026_LISTING =
  'https://vnexpress.net/the-thao/world-cup-2026/tin-tuc';

const VNE_HEADERS = {
  Accept: 'text/html,application/xhtml+xml',
  'User-Agent': 'wc-tactical-platform/1.0 (VnExpress WC2026 news reader)',
};

/** Article URLs: https://vnexpress.net/slug-5088685.html */
const ARTICLE_URL_RE =
  /https:\/\/vnexpress\.net\/[a-z0-9-]+-\d+\.html/gi;

function normalizeArticleUrl(raw: string): string {
  return raw.split('#')[0]!.split('?')[0]!.trim();
}

export function extractVnExpressArticleLinks(html: string, maxItems = 20): string[] {
  const seen = new Set<string>();
  const links: string[] = [];
  for (const match of html.matchAll(ARTICLE_URL_RE)) {
    const url = normalizeArticleUrl(match[0]!);
    if (seen.has(url)) continue;
    seen.add(url);
    links.push(url);
    if (links.length >= maxItems) break;
  }
  return links;
}

async function fetchArticleMeta(url: string): Promise<RssItem | null> {
  try {
    const res = await fetch(url, { headers: VNE_HEADERS, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const html = await res.text();
    const title =
      /<meta property="og:title" content="([^"]+)"/i.exec(html)?.[1] ??
      /<title>([^<|]+)/i.exec(html)?.[1]?.trim() ??
      '';
    const description =
      /<meta property="og:description" content="([^"]+)"/i.exec(html)?.[1] ??
      /<meta name="description" content="([^"]+)"/i.exec(html)?.[1] ??
      title;
    const imageUrl = /<meta property="og:image" content="([^"]+)"/i.exec(html)?.[1] ?? null;
    const pubDate =
      /<meta property="article:published_time" content="([^"]+)"/i.exec(html)?.[1] ??
      /<meta property="og:updated_time" content="([^"]+)"/i.exec(html)?.[1] ??
      new Date().toISOString();
    if (!title.trim()) return null;
    return {
      title: title.trim(),
      link: url,
      description: description.trim().slice(0, 800),
      pubDate,
      imageUrl,
    };
  } catch {
    return null;
  }
}

export async function fetchVnExpressWc2026NewsItems(maxItems = 12): Promise<RssItem[]> {
  try {
    const res = await fetch(VNEXPRESS_WC2026_LISTING, {
      headers: VNE_HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const links = extractVnExpressArticleLinks(html, maxItems);
    const metas = await Promise.all(links.map((url) => fetchArticleMeta(url)));
    return metas.filter((x): x is RssItem => x != null);
  } catch {
    return [];
  }
}
