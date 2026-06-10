import { describe, expect, it } from 'vitest';
import {
  buildRobotsTxt,
  buildSitemapXml,
  buildApiCatalog,
  buildLinkHeaderValue,
  buildOAuthProtectedResource,
  buildOAuthAuthorizationServer,
  buildOpenIdConfiguration,
  buildDnsAidManifest,
  AUTH_MD,
  API_DOC_MD,
} from '../src/services/siteDiscovery';
import { WC2026_TOURNAMENT_ID } from '../src/constants/tournament';

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
    expect(link).toContain('rel="oauth-protected-resource"');
  });

  it('oauth protected resource references authorization server', () => {
    const prm = buildOAuthProtectedResource(ORIGIN) as {
      resource: string;
      authorization_servers: string[];
    };
    expect(prm.resource).toBe(`${ORIGIN}/api/admin`);
    expect(prm.authorization_servers).toContain(ORIGIN);
  });

  it('oauth authorization server includes agent_auth and OIDC fields', () => {
    const as = buildOAuthAuthorizationServer(ORIGIN) as {
      issuer: string;
      jwks_uri: string;
      grant_types_supported: string[];
      agent_auth: { register_uri: string };
    };
    expect(as.issuer).toBe(ORIGIN);
    expect(as.jwks_uri).toContain('/.well-known/jwks.json');
    expect(as.grant_types_supported.length).toBeGreaterThan(0);
    expect(as.agent_auth.register_uri).toContain('/auth.md#agent-registration');

    const oidc = buildOpenIdConfiguration(ORIGIN) as { subject_types_supported: string[] };
    expect(oidc.subject_types_supported).toContain('public');
  });

  it('dns-aid manifest lists SVCB records for operators', () => {
    const manifest = buildDnsAidManifest(ORIGIN) as { records: { name: string }[] };
    expect(manifest.records.some((r) => r.name.includes('_agents.'))).toBe(true);
  });

  it('auth.md and api docs are markdown', () => {
    expect(AUTH_MD).toMatch(/# .*auth\.md/i);
    expect(AUTH_MD).toContain('agent-registration');
    expect(API_DOC_MD).toContain('| GET | /health |');
  });

  it('sitemap.xml lists static pages, match slugs, lineups, teams, and news', async () => {
    const queryResults = async (sql: string, args: unknown[]) => {
      if (sql.includes('FROM matches') && args[0] === WC2026_TOURNAMENT_ID) {
        return {
          results: [
            {
              id: 'm-w26-ga-1v2',
              kickoff_utc: '2026-06-11T19:00:00Z',
              stage: 'Group',
              group_code: 'A',
              home_name: 'United States',
              away_name: 'Mexico',
            },
          ],
        };
      }
      if (sql.includes("LIKE 'team-w26-%'")) {
        return { results: [{ id: 'team-w26-a1' }] };
      }
      if (sql.includes('FROM source_documents')) {
        return {
          results: [{ id: 'doc-1', published_at: '2026-06-01T12:00:00Z' }],
        };
      }
      return { results: [] };
    };

    const env = {
      DB: {
        prepare: (sql: string) => {
          const stmt = {
            bind: (...args: unknown[]) => ({
              all: async () => queryResults(sql, args),
            }),
            all: async () => queryResults(sql, []),
          };
          return stmt;
        },
      } as unknown as D1Database,
    } as import('../src/env').AppEnv;

    const xml = await buildSitemapXml(env, ORIGIN);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(`<loc>${ORIGIN}/matches</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/guide</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/news-intelligence</loc>`);
    expect(xml).not.toContain('/tournaments');
    expect(xml).toContain(
      `<loc>${ORIGIN}/matches/vong-bang-a-united-states-vs-mexico</loc>`,
    );
    expect(xml).toContain(
      `<loc>${ORIGIN}/matches/vong-bang-a-united-states-vs-mexico/analysis</loc>`,
    );
    expect(xml).toContain(`<loc>${ORIGIN}/lineups/vong-bang-a-united-states-vs-mexico</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/teams/team-w26-a1</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/news-intelligence/doc-1</loc>`);
    expect(xml).toContain('<lastmod>2026-06-11</lastmod>');
    expect(xml).toContain('<lastmod>2026-06-01</lastmod>');
  });
});
