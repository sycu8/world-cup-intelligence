import { Hono } from 'hono';
import type { AppEnv } from '../env';
import {
  siteOrigin,
  buildRobotsTxt,
  buildSitemapXml,
  buildApiCatalog,
  buildOpenApiSpec,
  API_DOC_MD,
  AUTH_MD,
  WC_API_SKILL_MD,
  buildAgentSkillsIndex,
  buildMcpServerCard,
  buildOAuthProtectedResource,
  buildOAuthAuthorizationServer,
  buildOpenIdConfiguration,
  buildJwksDocument,
  buildDnsAidManifest,
  buildLinkHeaderValue,
} from '../services/siteDiscovery';

export const discoveryRoutes = new Hono<{ Bindings: AppEnv }>();

discoveryRoutes.get('/robots.txt', (c) => {
  const origin = siteOrigin(c.req.url);
  return c.text(buildRobotsTxt(origin), 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

discoveryRoutes.get('/sitemap.xml', async (c) => {
  const origin = siteOrigin(c.req.url);
  const xml = await buildSitemapXml(c.env, origin);
  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

discoveryRoutes.get('/.well-known/api-catalog', (c) => {
  const origin = siteOrigin(c.req.url);
  return c.json(buildApiCatalog(origin), 200, {
    'Content-Type': 'application/linkset+json',
    'Cache-Control': 'public, max-age=86400',
  });
});

discoveryRoutes.get('/.well-known/openapi.json', (c) => {
  const origin = siteOrigin(c.req.url);
  return c.json(buildOpenApiSpec(origin), 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=86400',
  });
});

discoveryRoutes.get('/docs/api', (c) => {
  return c.text(API_DOC_MD, 200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
  });
});

discoveryRoutes.get('/auth.md', (c) => {
  return c.text(AUTH_MD, 200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
  });
});

discoveryRoutes.get('/.well-known/oauth-protected-resource', (c) => {
  const origin = siteOrigin(c.req.url);
  return c.json(buildOAuthProtectedResource(origin), 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=86400',
  });
});

discoveryRoutes.get('/.well-known/oauth-authorization-server', (c) => {
  const origin = siteOrigin(c.req.url);
  return c.json(buildOAuthAuthorizationServer(origin), 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=86400',
  });
});

discoveryRoutes.get('/.well-known/openid-configuration', (c) => {
  const origin = siteOrigin(c.req.url);
  return c.json(buildOpenIdConfiguration(origin), 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=86400',
  });
});

discoveryRoutes.get('/.well-known/jwks.json', (c) => {
  return c.json(buildJwksDocument(), 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=86400',
  });
});

discoveryRoutes.get('/.well-known/dns-aid.json', (c) => {
  const origin = siteOrigin(c.req.url);
  return c.json(buildDnsAidManifest(origin), 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=86400',
  });
});

discoveryRoutes.get('/oauth/authorize', (c) => {
  return c.json(
    {
      error: 'unsupported_grant',
      message:
        'Interactive OAuth is not enabled. Public GET /api/* requires no auth. See /auth.md for admin API key provisioning.',
      documentation: `${siteOrigin(c.req.url)}/auth.md`,
    },
    501,
  );
});

discoveryRoutes.post('/oauth/token', (c) => {
  return c.json(
    {
      error: 'unsupported_grant',
      message:
        'Token endpoint is reserved for future use. Admin access uses X-Admin-Token per /auth.md.',
      documentation: `${siteOrigin(c.req.url)}/auth.md`,
    },
    501,
  );
});

discoveryRoutes.get('/api/admin/agents/register', (c) => {
  const origin = siteOrigin(c.req.url);
  return c.json(
    {
      register_uri: `${origin}/auth.md#agent-registration`,
      credential_types_supported: ['api_key'],
      header_name: 'X-Admin-Token',
      provisioning: 'out_of_band',
      contact: 'https://github.com/sycu8/world-cup-intelligence/issues',
      authorization_server: `${origin}/.well-known/oauth-authorization-server`,
      protected_resource: `${origin}/.well-known/oauth-protected-resource`,
    },
    200,
    { 'Cache-Control': 'public, max-age=86400' },
  );
});

discoveryRoutes.post('/api/admin/agents/register', (c) => {
  return c.json(
    {
      error: 'registration_not_automated',
      message:
        'Agent API keys are provisioned out-of-band. Read GET /api/admin/agents/register and /auth.md.',
    },
    501,
  );
});

discoveryRoutes.get('/.well-known/mcp/server-card.json', (c) => {
  const origin = siteOrigin(c.req.url);
  return c.json(buildMcpServerCard(origin), 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=86400',
  });
});

discoveryRoutes.get('/.well-known/agent-skills/pitchintel-wc-api/SKILL.md', (c) => {
  return c.text(WC_API_SKILL_MD, 200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
  });
});

discoveryRoutes.get('/.well-known/agent-skills/index.json', async (c) => {
  const origin = siteOrigin(c.req.url);
  const index = await buildAgentSkillsIndex(origin, WC_API_SKILL_MD);
  return c.json(index, 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  });
});
