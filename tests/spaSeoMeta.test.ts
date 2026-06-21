import { describe, expect, it } from 'vitest';
import { injectMatchPageHtml } from '../src/services/spaMatchMeta';
import { injectHomeHtml, injectSeoLandingHtml } from '../src/services/spaSeoMeta';
import { findSeoPageByPath } from '../src/services/seoPages';
import { buildLlmsTxt, buildRobotsTxt } from '../src/services/siteDiscovery';

const ORIGIN = 'https://wc.example.com';
const SHELL = `<!DOCTYPE html><html><head><title>Default</title></head><body><div id="root"></div></body></html>`;

describe('spaSeoMeta', () => {
  it('injects canonical, JSON-LD, and answer block on home', () => {
    const html = injectHomeHtml(SHELL, ORIGIN);
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('WebSite');
    expect(html).toContain('id="seo-answer"');
  });

  it('injects FAQPage schema on SEO landing pages', () => {
    const page = findSeoPageByPath('/lich-thi-dau-world-cup-2026');
    expect(page).toBeDefined();
    const html = injectSeoLandingHtml(SHELL, page!, ORIGIN);
    expect(html).toContain('FAQPage');
    expect(html).toContain('Lịch thi đấu World Cup 2026');
    expect(html).toContain(`${ORIGIN}/matches`);
  });

  it('injects SportsEvent schema on match pages', () => {
    const html = injectMatchPageHtml(
      SHELL,
      {
        id: 'm1',
        slug: 'group-a-united-states-vs-mexico',
        home_name: 'United States',
        away_name: 'Mexico',
        kickoff_utc: '2026-06-11T19:00:00Z',
      } as import('../src/services/matchRef').MatchWithSlug,
      ORIGIN,
    );
    expect(html).toContain('SportsEvent');
    expect(html).toContain('rel="canonical"');
  });
});

describe('buildLlmsTxt', () => {
  it('lists priority pages and sources', () => {
    const txt = buildLlmsTxt(ORIGIN);
    expect(txt).toContain('/lich-thi-dau-world-cup-2026');
    expect(txt).toContain('FIFA');
  });

  it('robots.txt references llms.txt', () => {
    const robots = buildRobotsTxt(ORIGIN);
    expect(robots).toContain('Llms-Txt:');
  });
});
