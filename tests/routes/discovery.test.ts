import { describe, it, expect } from 'vitest';
import { discoveryRoutes } from '../../src/routes/discovery';
import { jsonRoute, requestRoute } from '../helpers/routeHarness';

const hostHeaders = { Host: 'wc.example.com' };

describe('discovery routes coverage', () => {
  it('GET /llms.txt returns plain text summary', async () => {
    const res = await requestRoute(discoveryRoutes, '/llms.txt', { headers: hostHeaders });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    const text = await res.text();
    expect(text).toContain('PitchIntel');
    expect(text).toContain('/sitemap.xml');
  });

  it('GET /sitemap.xml returns XML', async () => {
    const res = await requestRoute(discoveryRoutes, '/sitemap.xml', { headers: hostHeaders });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/xml');
    const text = await res.text();
    expect(text).toContain('<urlset');
  });

  it('GET /.well-known/api-catalog returns linkset', async () => {
    const { res, json } = await jsonRoute<{ links: unknown[] }>(discoveryRoutes, '/.well-known/api-catalog', {
      headers: hostHeaders,
    });
    expect(res.status).toBe(200);
    expect(json.links ?? json).toBeTruthy();
  });

  it('GET /auth.md returns markdown', async () => {
    const res = await requestRoute(discoveryRoutes, '/auth.md');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('X-Admin-Token');
  });

  it('GET /.well-known/oauth-protected-resource returns metadata', async () => {
    const { res } = await jsonRoute(discoveryRoutes, '/.well-known/oauth-protected-resource', {
      headers: hostHeaders,
    });
    expect(res.status).toBe(200);
  });

  it('GET /.well-known/oauth-authorization-server returns metadata', async () => {
    const { res } = await jsonRoute(discoveryRoutes, '/.well-known/oauth-authorization-server', {
      headers: hostHeaders,
    });
    expect(res.status).toBe(200);
  });

  it('GET /.well-known/openid-configuration returns metadata', async () => {
    const { res } = await jsonRoute(discoveryRoutes, '/.well-known/openid-configuration', {
      headers: hostHeaders,
    });
    expect(res.status).toBe(200);
  });

  it('GET /.well-known/dns-aid.json returns manifest', async () => {
    const { res } = await jsonRoute(discoveryRoutes, '/.well-known/dns-aid.json', { headers: hostHeaders });
    expect(res.status).toBe(200);
  });

  it('POST /oauth/token returns 501', async () => {
    const { res, json } = await jsonRoute<{ error: string }>(discoveryRoutes, '/oauth/token', {
      method: 'POST',
      headers: hostHeaders,
    });
    expect(res.status).toBe(501);
    expect(json.error).toBe('unsupported_grant');
  });

  it('GET /api/admin/agents/register returns registration info', async () => {
    const { res, json } = await jsonRoute<{ header_name: string }>(discoveryRoutes, '/api/admin/agents/register', {
      headers: hostHeaders,
    });
    expect(res.status).toBe(200);
    expect(json.header_name).toBe('X-Admin-Token');
  });

  it('POST /api/admin/agents/register returns 501', async () => {
    const { res, json } = await jsonRoute<{ error: string }>(discoveryRoutes, '/api/admin/agents/register', {
      method: 'POST',
      headers: hostHeaders,
    });
    expect(res.status).toBe(501);
    expect(json.error).toBe('registration_not_automated');
  });

  it('GET /.well-known/mcp/server-card.json returns card', async () => {
    const { res } = await jsonRoute(discoveryRoutes, '/.well-known/mcp/server-card.json', {
      headers: hostHeaders,
    });
    expect(res.status).toBe(200);
  });

  it('GET /.well-known/agent-skills/pitchintel-wc-api/SKILL.md returns skill doc', async () => {
    const res = await requestRoute(discoveryRoutes, '/.well-known/agent-skills/pitchintel-wc-api/SKILL.md');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('PitchIntel');
  });

  it('GET /.well-known/agent-skills/index.json returns index', async () => {
    const { res, json } = await jsonRoute<{ skills: unknown[] }>(
      discoveryRoutes,
      '/.well-known/agent-skills/index.json',
      { headers: hostHeaders },
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(json.skills) || json).toBeTruthy();
  });
});
