import { useEffect } from 'react';

type PageMeta = {
  title: string;
  description: string;
  image?: string;
  url?: string;
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

const DEFAULT_TITLE = 'PitchIntel — Tình báo chiến thuật World Cup';
const DEFAULT_DESCRIPTION =
  'Phân tích trận, xác suất mô hình, kịch bản và tin World Cup 2026 — miễn phí, ưu tiên tiếng Việt.';
const DEFAULT_IMAGE = '/og-cover.jpg';

export function usePageMeta(meta: PageMeta | null) {
  useEffect(() => {
    if (!meta) return;

    document.title = meta.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);

    if (meta.url) {
      upsertMeta('property', 'og:url', meta.url);
    }
    if (meta.image) {
      const absolute =
        meta.image.startsWith('http') || meta.image.startsWith('data:')
          ? meta.image
          : `${window.location.origin}${meta.image}`;
      upsertMeta('property', 'og:image', absolute);
      upsertMeta('name', 'twitter:image', absolute);
    }

    return () => {
      document.title = DEFAULT_TITLE;
      upsertMeta('name', 'description', DEFAULT_DESCRIPTION);
      upsertMeta('property', 'og:title', DEFAULT_TITLE);
      upsertMeta('property', 'og:description', DEFAULT_DESCRIPTION);
      upsertMeta('property', 'og:image', `${window.location.origin}${DEFAULT_IMAGE}`);
      upsertMeta('name', 'twitter:title', DEFAULT_TITLE);
      upsertMeta('name', 'twitter:description', DEFAULT_DESCRIPTION);
      upsertMeta('name', 'twitter:image', `${window.location.origin}${DEFAULT_IMAGE}`);
    };
  }, [meta?.title, meta?.description, meta?.image, meta?.url]);
}
