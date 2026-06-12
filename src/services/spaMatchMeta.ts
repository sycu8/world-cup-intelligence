import type { MatchWithSlug } from './matchRef';
import { matchThumbnailPublicPath } from './matchThumbnail';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function upsertMeta(html: string, attr: string, key: string, content: string): string {
  const escaped = escapeHtml(content);
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace('</head>', `  ${tag}\n  </head>`);
}

export function injectMatchPageHtml(html: string, match: MatchWithSlug, origin: string): string {
  const slug = match.slug;
  const pageUrl = `${origin}/matches/${slug}`;
  const thumbUrl = `${origin}${matchThumbnailPublicPath(slug)}`;
  const title = `${match.home_name} vs ${match.away_name} | PitchIntel`;
  const description = `Phân tích ${match.home_name} gặp ${match.away_name} — xác suất mô hình, thống kê và chiến thuật World Cup 2026.`;

  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = upsertMeta(out, 'name', 'description', description);
  out = upsertMeta(out, 'property', 'og:type', 'website');
  out = upsertMeta(out, 'property', 'og:title', title);
  out = upsertMeta(out, 'property', 'og:description', description);
  out = upsertMeta(out, 'property', 'og:url', pageUrl);
  out = upsertMeta(out, 'property', 'og:image', thumbUrl);
  out = upsertMeta(out, 'name', 'twitter:card', 'summary_large_image');
  out = upsertMeta(out, 'name', 'twitter:title', title);
  out = upsertMeta(out, 'name', 'twitter:description', description);
  out = upsertMeta(out, 'name', 'twitter:image', thumbUrl);
  return out;
}
