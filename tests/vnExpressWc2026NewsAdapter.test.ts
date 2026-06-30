import { describe, expect, it } from 'vitest';
import {
  extractVnExpressArticleLinks,
  VNEXPRESS_WC2026_LISTING,
} from '../src/ingestion/adapters/VnExpressWc2026NewsAdapter';

describe('VnExpressWc2026NewsAdapter', () => {
  it('extracts article links from listing HTML', () => {
    const html = `
      <a href="https://vnexpress.net/messi-moi-thu-that-ngoan-muc-5088685.html#box_comment_vne">Messi</a>
      <a href="https://vnexpress.net/rooney-yamal-co-iq-bong-da-kiet-xuat-5088384.html">Rooney</a>
    `;
    const links = extractVnExpressArticleLinks(html, 5);
    expect(links).toEqual([
      'https://vnexpress.net/messi-moi-thu-that-ngoan-muc-5088685.html',
      'https://vnexpress.net/rooney-yamal-co-iq-bong-da-kiet-xuat-5088384.html',
    ]);
  });

  it('uses WC2026 listing URL constant', () => {
    expect(VNEXPRESS_WC2026_LISTING).toBe(
      'https://vnexpress.net/the-thao/world-cup-2026/tin-tuc',
    );
  });
});
