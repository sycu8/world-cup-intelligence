import { describe, expect, it } from 'vitest';
import {
  buildRobotsTxt,
  buildApiCatalog,
  buildLinkHeaderValue,
  buildOAuthProtectedResource,
  buildOAuthAuthorizationServer,
  buildOpenIdConfiguration,
  buildDnsAidManifest,
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
});
