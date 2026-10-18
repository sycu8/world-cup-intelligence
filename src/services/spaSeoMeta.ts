import type { SeoPageDef } from './seoPages';
import {
  applyPageMetaBundle,
  escapeHtml,
  injectJsonLd,
  injectNoscriptAnswer,
} from './spaHtmlMeta';

function buildRelatedLinks(origin: string, page: SeoPageDef): string {
  const links = [page.ctaPath, ...page.relatedPaths]
    .filter((path, index, all) => all.indexOf(path) === index)
    .slice(0, 6);
  return links
    .map((path) => `<li><a href="${escapeHtml(`${origin}${path}`)}">${escapeHtml(path)}</a></li>`)
    .join('');
}

export function injectSeoLandingHtml(html: string, page: SeoPageDef, origin: string): string {
  const pageUrl = `${origin}${page.path}`;
  const title = `${page.titleVi} | PitchIntel`;
  const description = page.descriptionVi;
  const answer = page.answerVi;

  let out = applyPageMetaBundle(html, {
    title,
    description,
    url: pageUrl,
    image: `${origin}/og-cover.jpg`,
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: page.titleVi,
        description,
        url: pageUrl,
        inLanguage: 'vi',
        isPartOf: { '@type': 'WebSite', name: 'PitchIntel', url: origin },
        about: { '@type': 'SportsEvent', name: 'FIFA World Cup 2026' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: page.titleVi,
            acceptedAnswer: {
              '@type': 'Answer',
              text: answer,
            },
          },
        ],
      },
    ],
  };

  out = injectJsonLd(out, jsonLd);
  out = injectNoscriptAnswer(
    out,
    `<article><h1>${escapeHtml(page.titleVi)}</h1><p>${escapeHtml(answer)}</p><p><a href="${escapeHtml(`${origin}${page.ctaPath}`)}">${escapeHtml(page.ctaLabelVi)}</a></p><nav aria-label="Related"><ul>${buildRelatedLinks(origin, page)}</ul></nav><p>Nguồn: PitchIntel — dữ liệu trận đấu từ FIFA và mô hình xác suất nội bộ.</p></article>`,
  );

  return out;
}

export function injectHomeHtml(html: string, origin: string): string {
  const pageUrl = `${origin}/`;
  const title = 'PitchIntel — Tình báo chiến thuật World Cup';
  const description =
    'Phân tích trận, xác suất mô hình, kịch bản và tin World Cup 2026 — miễn phí, ưu tiên tiếng Việt.';
  const answer =
    'PitchIntel là nền tảng tình báo chiến thuật World Cup 2026: lịch 104 trận, xác suất thắng/hòa/thua, bảng xếp hạng, tin có nguồn và phân tích đa kịch bản — ưu tiên tiếng Việt.';

  let out = applyPageMetaBundle(html, {
    title,
    description,
    url: pageUrl,
    image: `${origin}/og-cover.jpg`,
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'PitchIntel',
        url: origin,
        description,
        inLanguage: ['vi', 'en'],
        potentialAction: {
          '@type': 'SearchAction',
          target: `${origin}/matches?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        name: 'PitchIntel',
        url: origin,
        description: 'World Cup 2026 tactical probability and news intelligence platform.',
      },
    ],
  };

  out = injectJsonLd(out, jsonLd);
  out = injectNoscriptAnswer(
    out,
    `<article><h1>${escapeHtml(title)}</h1><p>${escapeHtml(answer)}</p><nav aria-label="Primary"><ul><li><a href="${origin}/matches">Lịch thi đấu</a></li><li><a href="${origin}/guide">Hướng dẫn xác suất</a></li><li><a href="${origin}/news-intelligence">Tin tình báo</a></li></ul></nav></article>`,
  );

  return out;
}

type HubPageSpec = {
  path: string;
  title: string;
  description: string;
  answer: string;
  links: { href: string; label: string }[];
  schemaType: 'CollectionPage' | 'WebPage';
};

const HUB_PAGES: Record<string, HubPageSpec> = {
  '/matches': {
    path: '/matches',
    title: 'Lịch thi đấu World Cup 2026 | PitchIntel',
    description:
      'Lịch đầy đủ 104 trận World Cup 2026, bảng xếp hạng 12 bảng A–L và nhánh knockout với xác suất mô hình.',
    answer:
      'Trang lịch thi đấu PitchIntel liệt kê toàn bộ 104 trận World Cup 2026, bảng xếp hạng và nhánh knockout, kèm liên kết tới phân tích xác suất từng trận.',
    links: [
      { href: '/lich-thi-dau-world-cup-2026', label: 'Lịch thi đấu SEO' },
      { href: '/bang-xep-hang-world-cup-2026', label: 'Bảng xếp hạng' },
      { href: '/guide', label: 'Hướng dẫn xác suất' },
    ],
    schemaType: 'CollectionPage',
  },
  '/guide': {
    path: '/guide',
    title: 'Hướng dẫn đọc xác suất World Cup 2026 | PitchIntel',
    description:
      'Cách đọc xác suất thắng/hòa/thua, tỉ số dự đoán, độ tin cậy mô hình và kịch bản trận đấu PitchIntel.',
    answer:
      'Hướng dẫn PitchIntel giải thích cách đọc xác suất thắng/hòa/thua, tỉ số có khả năng cao, độ tin cậy mô hình và các kịch bản dự đoán cho World Cup 2026.',
    links: [
      { href: '/du-doan-world-cup-2026', label: 'Dự đoán World Cup 2026' },
      { href: '/matches', label: 'Lịch thi đấu' },
      { href: '/', label: 'Trang chủ' },
    ],
    schemaType: 'WebPage',
  },
  '/news-intelligence': {
    path: '/news-intelligence',
    title: 'Tin tình báo World Cup 2026 | PitchIntel',
    description:
      'Tin World Cup 2026 có nguồn, điểm tin cậy nhà xuất bản và liên kết tác động tới trận đấu.',
    answer:
      'Tin tình báo PitchIntel tổng hợp bài viết World Cup 2026 kèm nguồn gốc, điểm tin cậy và liên kết tới các trận bị ảnh hưởng.',
    links: [
      { href: '/phan-tich-world-cup-2026', label: 'Phân tích World Cup 2026' },
      { href: '/matches', label: 'Lịch thi đấu' },
      { href: '/guide', label: 'Hướng dẫn xác suất' },
    ],
    schemaType: 'CollectionPage',
  },
};

export function findHubPageSpec(pathname: string): HubPageSpec | undefined {
  return HUB_PAGES[pathname];
}

export function injectHubPageHtml(html: string, spec: HubPageSpec, origin: string): string {
  const pageUrl = `${origin}${spec.path}`;
  let out = applyPageMetaBundle(html, {
    title: spec.title,
    description: spec.description,
    url: pageUrl,
    image: `${origin}/og-cover.jpg`,
  });

  const linkItems = spec.links
    .map(
      (l) =>
        `<li><a href="${escapeHtml(`${origin}${l.href}`)}">${escapeHtml(l.label)}</a></li>`,
    )
    .join('');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': spec.schemaType,
        name: spec.title,
        description: spec.description,
        url: pageUrl,
        inLanguage: 'vi',
        isPartOf: { '@type': 'WebSite', name: 'PitchIntel', url: origin },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: spec.title.replace(' | PitchIntel', ''),
            acceptedAnswer: { '@type': 'Answer', text: spec.answer },
          },
        ],
      },
    ],
  };

  out = injectJsonLd(out, jsonLd);
  out = injectNoscriptAnswer(
    out,
    `<article><h1>${escapeHtml(spec.title.replace(' | PitchIntel', ''))}</h1><p>${escapeHtml(spec.answer)}</p><nav aria-label="Related"><ul>${linkItems}</ul></nav></article>`,
  );

  return out;
}
