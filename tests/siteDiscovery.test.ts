import { describe, expect, it } from 'vitest';
import {
  buildRobotsTxt,
  buildApiCatalog,
  buildLinkHeaderValue,
  AUTH_MD,
  API_DOC_MD,
} from '../src/services/siteDiscovery';

const ORIGIN = 'https://wc.example.com';

describe('siteDiscovery', () => {
  it('robots.txt includes sitemap, AI bots, and content signals', () => {
    const txt = buildRobotsTxt(ORIGIN);
    expect(txt).toContain('Sitemap: https://wc.example.com/sitemap.xml');
    expect(txt).toContain('User-agent: GPTBot');
    expect(txt).toContain('User-agent: Claude-Web');
    expect(txt).toContain('Content-Signal: ai-train=no, search=yes, ai-input=yes');
    expect(txt).toContain('Disallow: /api/admin/');
  });

  it('api-catalog is linkset+json shape', () => {
    const catalog = buildApiCatalog(ORIGIN) as { linkset: { anchor: string; service: unknown[] }[] };
    expect(catalog.linkset[0].anchor).toBe(`${ORIGIN}/api`);
    expect(catalog.linkset[0]['service-desc']).toBeDefined();
    expect(catalog.linkset[0]['service-doc']).toBeDefined();
  });

  it('link header advertises discovery resources', () => {
    const link = buildLinkHeaderValue(ORIGIN);
    expect(link).toContain('rel="api-catalog"');
    expect(link).toContain('rel="service-doc"');
    expect(link).toContain('rel="service-desc"');
  });

  it('auth.md and api docs are markdown', () => {
    expect(AUTH_MD).toMatch(/# .*auth\.md/i);
    expect(API_DOC_MD).toContain('| GET | /health |');
  });
});
