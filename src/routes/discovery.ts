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
