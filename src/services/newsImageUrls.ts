import { mediumThumbnailUrl } from './newsScoring';

/** Normalize article links for RSS ↔ DB matching (strip tracking params). */
export function normalizeArticleLink(link: string): string {
  try {
    const u = new URL(link.replace(/&amp;/g, '&'));
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return link.split('?')[0]?.split('#')[0] ?? link;
  }
}

/** Higher-res BBC / Guardian thumbs when feed only exposes small sizes. */
export function normalizeFeedImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  let out = url.trim();
  try {
    const u = new URL(out);
    if (u.hostname.includes('ichef.bbci.co.uk')) {
      out = out.replace(/\/standard\/\d+\//, '/standard/240/');
    }
  } catch {
    /* keep original */
  }
  return mediumThumbnailUrl(out) ?? out;
}
