export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function upsertMeta(html: string, attr: string, key: string, content: string): string {
  const escaped = escapeHtml(content);
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace('</head>', `  ${tag}\n  </head>`);
}

export function upsertTitle(html: string, title: string): string {
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

export function upsertLink(html: string, rel: string, href: string): string {
  const escaped = escapeHtml(href);
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, 'i');
  const tag = `<link rel="${rel}" href="${escaped}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace('</head>', `  ${tag}\n  </head>`);
}

export function injectJsonLd(html: string, data: object | object[]): string {
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  const tag = `<script type="application/ld+json">${payload}</script>`;
  if (html.includes('type="application/ld+json"')) {
    return html.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
      tag,
    );
  }
  return html.replace('</head>', `  ${tag}\n  </head>`);
}

export function injectNoscriptAnswer(
  html: string,
  articleHtml: string,
): string {
  const block = `<noscript id="seo-answer">${articleHtml}</noscript>`;
  if (html.includes('id="seo-answer"')) {
    return html.replace(/<noscript id="seo-answer">[\s\S]*?<\/noscript>/i, block);
  }
  return html.replace('<div id="root"></div>', `${block}\n    <div id="root"></div>`);
}

export type PageMetaBundle = {
  title: string;
  description: string;
  url: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageType?: string;
};

export function applyPageMetaBundle(html: string, meta: PageMetaBundle): string {
  let out = upsertTitle(html, meta.title);
  out = upsertMeta(out, 'name', 'description', meta.description);
  out = upsertLink(out, 'canonical', meta.url);
  out = upsertMeta(out, 'property', 'og:type', 'website');
  out = upsertMeta(out, 'property', 'og:title', meta.title);
  out = upsertMeta(out, 'property', 'og:description', meta.description);
  out = upsertMeta(out, 'property', 'og:url', meta.url);
  out = upsertMeta(out, 'name', 'twitter:card', 'summary_large_image');
  out = upsertMeta(out, 'name', 'twitter:title', meta.title);
  out = upsertMeta(out, 'name', 'twitter:description', meta.description);

  if (meta.image) {
    out = upsertMeta(out, 'property', 'og:image', meta.image);
    out = upsertMeta(out, 'name', 'twitter:image', meta.image);
    if (meta.imageWidth) {
      out = upsertMeta(out, 'property', 'og:image:width', String(meta.imageWidth));
    }
    if (meta.imageHeight) {
      out = upsertMeta(out, 'property', 'og:image:height', String(meta.imageHeight));
    }
    if (meta.imageType) {
      out = upsertMeta(out, 'property', 'og:image:type', meta.imageType);
    }
  }

  return out;
}
