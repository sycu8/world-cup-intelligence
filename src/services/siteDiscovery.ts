import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';

export function siteOrigin(url: string): string {
  return new URL(url).origin;
}

const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'Claude-Web',
  'Google-Extended',
  'Amazonbot',
  'anthropic-ai',
  'Bytespider',
  'CCBot',
  'Applebot-Extended',
] as const;

const CONTENT_SIGNAL = 'Content-Signal: ai-train=no, search=yes, ai-input=yes';

function aiBotBlock(disallowAdmin: string): string {
  return AI_BOTS.map(
    (bot) => `User-agent: ${bot}
Allow: /
${disallowAdmin}
${CONTENT_SIGNAL}`,
  ).join('\n\n');
}

export function buildRobotsTxt(origin: string): string {
  const disallowAdmin = 'Disallow: /api/admin/';
  return `# PitchIntel — World Cup tactical intelligence
# ${origin}
# RFC 9309 — https://www.rfc-editor.org/rfc/rfc9309

${CONTENT_SIGNAL}

User-agent: *
Allow: /
${disallowAdmin}
Disallow: /admin

${aiBotBlock(disallowAdmin)}

Sitemap: ${origin}/sitemap.xml
`;
}

export async function buildSitemapXml(env: AppEnv, origin: string): Promise<string> {
  const staticPaths = ['/', '/matches', '/guide', '/news-intelligence', '/tournaments'];
  const now = new Date().toISOString().slice(0, 10);

  const { results } = await env.DB.prepare(
    `SELECT id, kickoff_utc FROM matches WHERE tournament_id = ? ORDER BY kickoff_utc`,
  )
    .bind(WC2026_TOURNAMENT_ID)
    .all<{ id: string; kickoff_utc: string }>();

  const urls: { loc: string; lastmod: string; changefreq: string; priority: string }[] =
    staticPaths.map((path) => ({
      loc: `${origin}${path}`,
      lastmod: now,
      changefreq: path === '/' ? 'daily' : 'weekly',
      priority: path === '/' ? '1.0' : '0.8',
    }));

  for (const m of results ?? []) {
    const lastmod = m.kickoff_utc?.slice(0, 10) ?? now;
    urls.push({
      loc: `${origin}/matches/${m.id}`,
      lastmod,
      changefreq: 'weekly',
      priority: '0.7',
    });
    urls.push({
      loc: `${origin}/matches/${m.id}/analysis`,
      lastmod,
      changefreq: 'weekly',
      priority: '0.6',
    });
  }

  const body = urls
    .map(
      (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildApiCatalog(origin: string): object {
  const api = `${origin}/api`;
  return {
    linkset: [
      {
        anchor: api,
        'service-desc': [
          { href: `${origin}/.well-known/openapi.json`, type: 'application/json' },
        ],
        'service-doc': [{ href: `${origin}/docs/api`, type: 'text/markdown' }],
        status: [{ href: `${api}/health`, type: 'application/json' }],
      },
    ],
  };
}

export function buildOpenApiSpec(origin: string): object {
  return {
    openapi: '3.1.0',
    info: {
      title: 'PitchIntel API',
      version: '1.0.0',
      description: 'World Cup 2026 tactical probability and news intelligence API.',
    },
    servers: [{ url: `${origin}/api` }],
    paths: {
      '/health': {
        get: { summary: 'Health and pipeline status', operationId: 'getHealth' },
      },
      '/dashboard': {
        get: { summary: 'Featured match and tournament snapshot', operationId: 'getDashboard' },
      },
      '/schedule': {
        get: { summary: 'WC 2026 match schedule', operationId: 'getSchedule' },
      },
      '/matches/{matchId}': {
        get: { summary: 'Match detail', operationId: 'getMatch' },
        parameters: [{ name: 'matchId', in: 'path', required: true, schema: { type: 'string' } }],
      },
      '/matches/{matchId}/probability': {
        get: { summary: 'Model probability snapshot', operationId: 'getMatchProbability' },
        parameters: [{ name: 'matchId', in: 'path', required: true, schema: { type: 'string' } }],
      },
      '/matches/{matchId}/history': {
        get: { summary: 'World Cup head-to-head history', operationId: 'getMatchHistory' },
        parameters: [{ name: 'matchId', in: 'path', required: true, schema: { type: 'string' } }],
      },
      '/news': {
        get: { summary: 'News articles (paginated)', operationId: 'listNews' },
      },
      '/teams/{teamId}/wc-h2h': {
        get: { summary: 'Team World Cup H2H by opponent', operationId: 'getTeamWcH2h' },
        parameters: [{ name: 'teamId', in: 'path', required: true, schema: { type: 'string' } }],
      },
    },
  };
}

export const API_DOC_MD = `# PitchIntel API

Base URL: \`/api\`

Public **read-only** JSON endpoints. No authentication required for listed routes.

## Core

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health, dependencies, pipeline timestamps |
| GET | /dashboard | Featured match, counts |
| GET | /schedule | WC 2026 schedule (104 matches) |
| GET | /matches/:matchId | Match detail |
| GET | /matches/:matchId/probability | Win/draw/loss probabilities |
| GET | /matches/:matchId/history | Past World Cup meetings |
| GET | /matches/:matchId/preview | AI match preview |
| GET | /news | News list |
| GET | /teams/:teamId/wc-h2h | Team WC head-to-head |

## Machine-readable

- OpenAPI: \`/.well-known/openapi.json\`
- API catalog (RFC 9727): \`/.well-known/api-catalog\`
- Agent skills: \`/.well-known/agent-skills/index.json\`

## Admin

\`/api/admin/*\` requires \`X-Admin-Token\` header. See \`/auth.md\`.
`;

export const AUTH_MD = `# PitchIntel auth.md

Agent and API access for **PitchIntel** (World Cup tactical intelligence).

## Public API

All \`GET /api/*\` routes listed in [\`/docs/api\`](/docs/api) are **public** and require **no authentication**.

Use standard HTTPS \`GET\` requests with \`Accept: application/json\`.

## Admin API

Routes under \`/api/admin/*\` require a static bearer token:

\`\`\`
X-Admin-Token: <secret>
\`\`\`

There is no OAuth/OIDC user login or agent registration flow for public data.

## Agent discovery

| Resource | URL |
|----------|-----|
| API catalog | \`/.well-known/api-catalog\` |
| OpenAPI | \`/.well-known/openapi.json\` |
| Protected resource metadata | \`/.well-known/oauth-protected-resource\` |
| MCP server card | \`/.well-known/mcp/server-card.json\` |
| Agent skills index | \`/.well-known/agent-skills/index.json\` |

## Contact

Built by Cuong Le Sy — [LinkedIn](https://www.linkedin.com/in/sycule/) · [GitHub](https://github.com/sycu8/)
`;

export const WC_API_SKILL_MD = `---
name: pitchintel-wc-api
description: Query PitchIntel World Cup 2026 probabilities, schedule, news, and head-to-head history via the public REST API.
---

# PitchIntel WC API

Use the public JSON API at \`/api\` (see \`/.well-known/openapi.json\`).

## Typical flow

1. \`GET /api/schedule\` — list matches
2. \`GET /api/matches/{id}/probability\` — model odds
3. \`GET /api/matches/{id}/history\` — World Cup H2H
4. \`GET /api/news\` — latest articles

No auth for read endpoints.
`;

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

export async function buildAgentSkillsIndex(origin: string, skillBody: string): Promise<object> {
  const digest = await sha256Hex(skillBody);
  return {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: 'pitchintel-wc-api',
        type: 'skill-md',
        description:
          'Query WC 2026 match probabilities, schedule, news, and World Cup head-to-head via REST.',
        url: `${origin}/.well-known/agent-skills/pitchintel-wc-api/SKILL.md`,
        digest,
      },
    ],
  };
}

export function buildMcpServerCard(origin: string): object {
  return {
    $schema: 'https://modelcontextprotocol.io/schemas/server-card/v1',
    serverInfo: {
      name: 'pitchintel',
      version: '1.0.0',
      description: 'World Cup 2026 tactical probability platform (REST-first; MCP transport not exposed).',
    },
    transport: {
      type: 'streamable-http',
      endpoint: `${origin}/api`,
    },
    capabilities: {
      tools: false,
      resources: true,
      prompts: false,
    },
    links: {
      apiCatalog: `${origin}/.well-known/api-catalog`,
      openApi: `${origin}/.well-known/openapi.json`,
      documentation: `${origin}/docs/api`,
    },
  };
}

export function buildOAuthProtectedResource(origin: string): object {
  return {
    resource: `${origin}/api`,
    authorization_servers: [],
    bearer_methods_supported: ['header'],
    scopes_supported: [],
    resource_documentation: `${origin}/auth.md`,
    note: 'Public GET endpoints require no token. Admin routes use X-Admin-Token.',
  };
}

export function buildLinkHeaderValue(origin: string): string {
  return [
    `<${origin}/.well-known/api-catalog>; rel="api-catalog"`,
    `<${origin}/.well-known/openapi.json>; rel="service-desc"`,
    `<${origin}/docs/api>; rel="service-doc"`,
    `<${origin}/sitemap.xml>; rel="sitemap"; type="application/xml"`,
    `<${origin}/.well-known/agent-skills/index.json>; rel="describedby"`,
  ].join(', ');
}
