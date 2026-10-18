import type { MatchWithSlug } from './matchRef';
import { matchOgImagePublicPath, MATCH_THUMB_HEIGHT, MATCH_THUMB_WIDTH } from './matchThumbnail';
import {
  applyPageMetaBundle,
  escapeHtml,
  injectJsonLd,
  injectNoscriptAnswer,
} from './spaHtmlMeta';

export function injectMatchPageHtml(html: string, match: MatchWithSlug, origin: string): string {
  const slug = match.slug;
  const pageUrl = `${origin}/matches/${slug}`;
  const thumbUrl = `${origin}${matchOgImagePublicPath(slug)}`;
  const title = `${match.home_name} vs ${match.away_name} | PitchIntel`;
  const description = `Phân tích ${match.home_name} gặp ${match.away_name} — xác suất mô hình, thống kê và chiến thuật World Cup 2026.`;
  const answer = `${match.home_name} gặp ${match.away_name} tại World Cup 2026. PitchIntel cung cấp xác suất thắng/hòa/thua, thống kê trận, đội hình và kịch bản dự đoán cho trận này.`;

  let out = applyPageMetaBundle(html, {
    title,
    description,
    url: pageUrl,
    image: thumbUrl,
    imageWidth: MATCH_THUMB_WIDTH,
    imageHeight: MATCH_THUMB_HEIGHT,
    imageType: 'image/png',
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SportsEvent',
        name: `${match.home_name} vs ${match.away_name}`,
        description,
        startDate: match.kickoff_utc,
        eventStatus: 'https://schema.org/EventScheduled',
        sport: 'Soccer',
        url: pageUrl,
        homeTeam: { '@type': 'SportsTeam', name: match.home_name },
        awayTeam: { '@type': 'SportsTeam', name: match.away_name },
        organizer: { '@type': 'Organization', name: 'FIFA World Cup 2026' },
        location: { '@type': 'Place', name: 'World Cup 2026' },
      },
      {
        '@type': 'WebPage',
        name: title,
        description,
        url: pageUrl,
        isPartOf: { '@type': 'WebSite', name: 'PitchIntel', url: origin },
      },
    ],
  };

  out = injectJsonLd(out, jsonLd);
  out = injectNoscriptAnswer(
    out,
    `<article><h1>${escapeHtml(title)}</h1><p>${escapeHtml(answer)}</p><p><a href="${escapeHtml(pageUrl)}">Xem phân tích trận</a></p></article>`,
  );

  return out;
}
