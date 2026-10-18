import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { CLUB_LEAGUES } from '../constants/leagues';
import { buildMatchSlug } from '../utils/matchSlug';
import { SEO_PAGES, SEO_PAGE_PATHS } from './seoPages';

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
Llms-Txt: ${origin}/llms.txt
`;
}

type SitemapEntry = {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
};

const SITEMAP_STATIC_PATHS = ['/', '/matches', '/leagues', '/guide', '/news-intelligence'] as const;

/** Vietnamese SEO landing pages (mirror src/services/seoPages.ts) */
const SITEMAP_SEO_PATHS = SEO_PAGE_PATHS;

export async function buildSitemapXml(env: AppEnv, origin: string): Promise<string> {
  const now = new Date().toISOString().slice(0, 10);

  type MatchRow = {
    id: string;
    kickoff_utc: string;
    stage: string | null;
    group_code: string | null;
    home_name: string;
    away_name: string;
  };

  let matchesResult: { results?: MatchRow[] } = { results: [] };
  let teamsResult: { results?: { id: string }[] } = { results: [] };
  let newsResult: { results?: { id: string; published_at: string }[] } = { results: [] };

  try {
    [matchesResult, teamsResult, newsResult] = await Promise.all([
      env.DB.prepare(
        `SELECT m.id, m.kickoff_utc, m.stage, m.group_code, ht.name AS home_name, at.name AS away_name
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE m.tournament_id = ?
       ORDER BY m.kickoff_utc`,
      )
        .bind(WC2026_TOURNAMENT_ID)
        .all<MatchRow>(),
      env.DB.prepare(`SELECT id FROM teams WHERE id LIKE 'team-w26-%' ORDER BY name`).all<{
        id: string;
      }>(),
      env.DB.prepare(
        `SELECT id, published_at FROM source_documents ORDER BY published_at DESC LIMIT 1000`,
      ).all<{ id: string; published_at: string }>(),
    ]);
  } catch {
    // Static + SEO URLs still publish when D1 is unavailable (local dev / cold start).
  }

  const urls: SitemapEntry[] = [
    ...SITEMAP_STATIC_PATHS.map((path) => ({
      loc: `${origin}${path}`,
      lastmod: now,
      changefreq: path === '/' ? 'daily' : 'weekly',
      priority: path === '/' ? '1.0' : '0.8',
    })),
    ...SITEMAP_SEO_PATHS.map((path) => ({
      loc: `${origin}${path}`,
      lastmod: now,
      changefreq: 'weekly' as const,
      priority: '0.75',
    })),
    ...CLUB_LEAGUES.map((league) => ({
      loc: `${origin}/leagues/${league.slug}`,
      lastmod: now,
      changefreq: 'hourly' as const,
      priority: '0.85',
    })),
  ];

  for (const m of matchesResult.results ?? []) {
    const lastmod = m.kickoff_utc?.slice(0, 10) ?? now;
    const slug = buildMatchSlug({
      stage: m.stage,
      groupCode: m.group_code,
      homeName: m.home_name,
      awayName: m.away_name,
    });
    urls.push({
      loc: `${origin}/matches/${slug}`,
      lastmod,
      changefreq: 'weekly',
      priority: '0.7',
    });
    urls.push({
      loc: `${origin}/matches/${slug}/analysis`,
      lastmod,
      changefreq: 'weekly',
      priority: '0.6',
    });
    urls.push({
      loc: `${origin}/lineups/${slug}`,
      lastmod,
      changefreq: 'weekly',
      priority: '0.5',
    });
  }

  for (const team of teamsResult.results ?? []) {
    urls.push({
      loc: `${origin}/teams/${team.id}`,
      lastmod: now,
      changefreq: 'weekly',
      priority: '0.6',
    });
  }

  for (const article of newsResult.results ?? []) {
    const lastmod = article.published_at?.slice(0, 10) ?? now;
    urls.push({
      loc: `${origin}/news-intelligence/${article.id}`,
      lastmod,
      changefreq: 'monthly',
      priority: '0.5',
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
        'service-doc': [
          { href: `${origin}/docs/api`, type: 'text/html' },
          { href: `${origin}/docs/api.md`, type: 'text/markdown' },
        ],
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
      version: '1.1.0',
      description:
        'World Cup 2026 tactical probability (wc-prob-v5), live FIFA data, standings, and multi-source news intelligence.',
    },
    servers: [{ url: `${origin}/api` }, { url: `${origin}/api/v1`, description: 'Public API v1 (integrations)' }],
    paths: {
      '/v1/feed': {
        get: {
          summary: 'Delta event feed for third-party polling',
          operationId: 'getPublicFeed',
          parameters: [
            { name: 'cursor', in: 'query', schema: { type: 'integer', default: 0 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          ],
        },
      },
      '/v1/matches/{ref}/snapshot': {
        get: {
          summary: 'Combined match snapshot (score, stats, recap)',
          operationId: 'getMatchSnapshot',
          parameters: [{ name: 'ref', in: 'path', required: true, schema: { type: 'string' } }],
        },
      },
      '/v1/webhooks': {
        post: { summary: 'Register webhook (requires X-API-Key)', operationId: 'createWebhook' },
        get: { summary: 'List webhooks', operationId: 'listWebhooks' },
      },
      '/health': {
        get: { summary: 'Health and pipeline status', operationId: 'getHealth' },
      },
      '/home': {
        get: { summary: 'Homepage bundle (dashboard, schedule, standings, probabilities)', operationId: 'getHome' },
      },
      '/dashboard': {
        get: { summary: 'Featured match and tournament snapshot', operationId: 'getDashboard' },
      },
      '/schedule': {
        get: { summary: 'WC 2026 match schedule (104 fixtures)', operationId: 'getSchedule' },
      },
      '/tournaments/{year}/standings': {
        get: { summary: 'Group standings and third-place ranking', operationId: 'getStandings' },
        parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'integer' } }],
      },
      '/tournaments/{year}/bracket': {
        get: { summary: 'Knockout bracket', operationId: 'getBracket' },
        parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'integer' } }],
      },
      '/tournaments/{year}/match-probabilities': {
        get: {
          summary: 'Bulk match probabilities with automatic gap-fill',
          operationId: 'getMatchProbabilities',
        },
        parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'integer' } }],
      },
      '/tournaments/{year}/champion-odds': {
        get: { summary: 'Monte Carlo champion odds', operationId: 'getChampionOdds' },
        parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'integer' } }],
      },
      '/tournaments/{year}/prediction-accuracy': {
        get: { summary: 'Model accuracy on completed matches', operationId: 'getPredictionAccuracy' },
        parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'integer' } }],
      },
      '/matches/{matchId}': {
        get: { summary: 'Match detail (slug or legacy id)', operationId: 'getMatch' },
        parameters: [{ name: 'matchId', in: 'path', required: true, schema: { type: 'string' } }],
      },
      '/matches/{matchId}/stats': {
        get: { summary: 'Live match statistics', operationId: 'getMatchStats' },
        parameters: [{ name: 'matchId', in: 'path', required: true, schema: { type: 'string' } }],
      },
      '/matches/{matchId}/recap': {
        get: { summary: 'Match recap and commentary', operationId: 'getMatchRecap' },
        parameters: [{ name: 'matchId', in: 'path', required: true, schema: { type: 'string' } }],
      },
      '/matches/{matchId}/pitch-map': {
        get: { summary: 'Pitch map with player positions', operationId: 'getPitchMap' },
        parameters: [{ name: 'matchId', in: 'path', required: true, schema: { type: 'string' } }],
      },
      '/matches/{matchId}/probability': {
        get: { summary: 'Model probability snapshot (wc-prob-v5)', operationId: 'getMatchProbability' },
        parameters: [{ name: 'matchId', in: 'path', required: true, schema: { type: 'string' } }],
      },
      '/matches/{matchId}/history': {
        get: { summary: 'World Cup head-to-head history', operationId: 'getMatchHistory' },
        parameters: [{ name: 'matchId', in: 'path', required: true, schema: { type: 'string' } }],
      },
      '/news': {
        get: { summary: 'News articles (paginated, 24+ RSS sources)', operationId: 'listNews' },
      },
      '/news/{docId}': {
        get: { summary: 'Single news article', operationId: 'getNewsArticle' },
        parameters: [{ name: 'docId', in: 'path', required: true, schema: { type: 'string' } }],
      },
      '/teams': {
        get: { summary: 'WC 2026 team list', operationId: 'listTeams' },
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

Public **read-only** JSON endpoints. No authentication required unless noted.

**Probability engine:** \`wc-prob-v5\` (attack/defense split, H2H modifier, Dixon–Coles scoreline matrix).

## Public API v1 (third-party integrations)

Base: \`/api/v1\` — continuous match updates for external apps.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /v1 | API key (prod) | Platform overview + event types |
| GET | /v1/feed?cursor=0 | API key (prod) | Delta event feed (poll every 5–15s live) |
| GET | /v1/matches?since=&status= | API key (prod) | Match list with change filter |
| GET | /v1/matches/:ref/snapshot | API key (prod) | Full match state (score, stats, recap) |
| GET | /v1/stream?cursor=0 | API key (prod) | SSE live event stream |
| POST | /v1/webhooks | **API key** | Register webhook URL |
| GET | /v1/webhooks | **API key** | List your webhooks |
| DELETE | /v1/webhooks/:id | **API key** | Remove webhook |
| POST | /v1/webhooks/:id/test | **API key** | Send test delivery |

**API key:** \`X-API-Key: pi_live_...\` (provision via \`POST /api/admin/api-clients\` with \`X-Admin-Token\`).

**Webhook signature:** verify \`X-PitchIntel-Signature: sha256=<hmac>\` over raw JSON body using your webhook secret.

**Event types:** \`match.score_updated\`, \`match.status_changed\`, \`match.completed\`, \`match.stats_updated\`, \`match.commentary_updated\`, \`match.events_updated\`

## Core

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health, dependencies, pipeline timestamps |
| GET | /home | Homepage bundle (dashboard, schedule, standings, probabilities) |
| GET | /dashboard | Featured match, counts |
| GET | /schedule | WC 2026 schedule (104 matches) |
| GET | /matches/:ref | Match detail (\`:ref\` = SEO slug or legacy \`m-*\` id) |
| GET | /matches/:ref/stats | Live match statistics |
| GET | /matches/:ref/recap | Recap and commentary |
| GET | /matches/:ref/events | Goals, cards, substitutions |
| GET | /matches/:ref/staff | Managers and officials |
| GET | /matches/:ref/probability | Win/draw/loss probabilities (\`wc-prob-v5\`) |
| GET | /matches/:ref/pitch-map | Pitch map, ratings, movement vectors |
| GET | /matches/:ref/lineups | Official lineups |
| GET | /matches/:ref/history | Past World Cup meetings |
| GET | /matches/:ref/preview | AI match preview |
| GET | /matches/:ref/tactical-briefing | Tactical briefing |
| GET | /matches/:ref/scenario-predictions | Multi-scenario predictions |
| GET | /matches/:ref/probability-movement | Probability history |
| GET | /analysis/:ref | Multi-factor analysis |

## Tournament

| Method | Path | Description |
|--------|------|-------------|
| GET | /tournaments/2026/standings | 12 group tables + third-place ranking |
| GET | /tournaments/2026/bracket | Knockout bracket (R32 → Final) |
| GET | /tournaments/2026/match-probabilities | Bulk probabilities + gap-fill; meta \`{ total, withProbability, pending }\` |
| GET | /tournaments/2026/champion-odds | Monte Carlo champion probabilities |
| GET | /tournaments/2026/prediction-accuracy | Favorite hit rate, top-3 scoreline, Brier |
| GET | /tournaments/2026/upcoming-probability-verification | Upcoming fixtures missing snapshots (\`?refresh=1\`) |

## Teams & news

| Method | Path | Description |
|--------|------|-------------|
| GET | /teams | 48 WC 2026 teams |
| GET | /teams/:teamId | Team profile |
| GET | /teams/:teamId/wc-h2h | Team WC head-to-head |
| GET | /news | News list (24+ RSS + FIFA WC2026; paginated + hot strip) |
| GET | /news/:docId | Single article (VI translation on demand) |
| GET | /news/assets/:docId | Article thumbnail |

## Machine-readable

- OpenAPI: \`/.well-known/openapi.json\`
- API catalog (RFC 9727): \`/.well-known/api-catalog\`
- Interactive docs: \`/docs/api\`
- Agent skills: \`/.well-known/agent-skills/index.json\`

## Admin

\`/api/admin/*\` requires \`X-Admin-Token\` header unless noted. See \`/auth.md\`.

| Method | Path | Description |
|--------|------|-------------|
| POST | /admin/recompute-all | Recompute all 104 WC2026 matches |
| POST | /admin/recompute/:matchId | Recompute one match |
| POST | /admin/crawl-news | Trigger news crawl now |
| POST | /admin/refresh-champion-odds | Refresh champion simulation |
| POST | /admin/verify-upcoming-probabilities | Gap-fill upcoming fixtures |
| POST | /admin/lineups/sync-squads | Sync official squads → lineups |
| POST | /admin/matches/:matchId/lineup | Submit official XI |
| POST | /admin/api-clients | Create partner API key |
| GET | /admin/api-clients | List API clients |
| DELETE | /admin/api-clients/:id | Revoke API client |
| GET | /admin/sources | Source registry health (public) |
`;

export const AUTH_MD = `# PitchIntel auth.md

Agent and API access for **PitchIntel** (World Cup tactical intelligence).

## Public API

All \`GET /api/*\` routes listed in [\`/docs/api\`](/docs/api) are **public** and require **no authentication**.

Use standard HTTPS \`GET\` requests with \`Accept: application/json\`.

## Admin API {#admin-api-key}

Routes under \`/api/admin/*\` require a static API key header:

\`\`\`
X-Admin-Token: <secret>
\`\`\`

Tokens are **provisioned out-of-band** (not self-service). See [agent registration](#agent-registration).

## Agent registration {#agent-registration}

PitchIntel supports **anonymous agent registration** for admin API access:

| Field | Value |
|-------|-------|
| Register URI | \`/auth.md#agent-registration\` |
| Credential type | \`api_key\` (header \`X-Admin-Token\`) |
| Identity | Anonymous — request provisioning via GitHub issue or contact below |
| OAuth PRM | \`/.well-known/oauth-protected-resource\` |
| OAuth AS | \`/.well-known/oauth-authorization-server\` |

Agents should read OAuth Protected Resource Metadata and Authorization Server metadata before calling protected routes.

## Agent discovery

| Resource | URL |
|----------|-----|
| API catalog | \`/.well-known/api-catalog\` |
| OpenAPI | \`/.well-known/openapi.json\` |
| Protected resource metadata | \`/.well-known/oauth-protected-resource\` |
| Authorization server | \`/.well-known/oauth-authorization-server\` |
| OpenID configuration | \`/.well-known/openid-configuration\` |
| MCP server card | \`/.well-known/mcp/server-card.json\` |
| Agent skills index | \`/.well-known/agent-skills/index.json\` |
| DNS-AID template | \`/.well-known/dns-aid.json\` |

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

1. \`GET /api/v1/feed?cursor=0\` — poll live match events (5–15s; \`X-API-Key\` on production)
2. \`GET /api/v1/matches/{slug}/snapshot\` — full match state
3. \`POST /api/v1/webhooks\` — push updates to your server (requires \`X-API-Key\`)
4. \`GET /api/home\` — homepage bundle (schedule, standings, probabilities)
5. \`GET /api/tournaments/2026/match-probabilities\` — bulk probabilities with gap-fill
6. \`GET /api/matches/{id}/probability\` — single-match model odds (\`wc-prob-v5\`)

Partner API keys: provision via admin \`POST /api/admin/api-clients\` with \`X-Admin-Token\`.
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
    resource: `${origin}/api/admin`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    scopes_supported: ['admin'],
    resource_documentation: `${origin}/auth.md`,
  };
}

export function buildOAuthAuthorizationServer(origin: string): object {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    registration_endpoint: `${origin}/api/admin/agents/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['client_credentials', 'authorization_code'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    scopes_supported: ['admin'],
    agent_auth: {
      skill: 'https://workos.com/auth-md',
      register_uri: `${origin}/auth.md#agent-registration`,
      identity_types_supported: ['anonymous'],
      anonymous: {
        credential_types_supported: ['api_key'],
        claim_uri: `${origin}/auth.md#admin-api-key`,
      },
    },
  };
}

export function buildOpenIdConfiguration(origin: string): object {
  const as = buildOAuthAuthorizationServer(origin);
  return {
    ...as,
    userinfo_endpoint: `${origin}/oauth/userinfo`,
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    claims_supported: ['sub', 'iss'],
  };
}

export function buildJwksDocument(): object {
  return { keys: [] };
}

/** Operator template for DNS-AID SVCB/HTTPS records (publish in public DNS + DNSSEC). */
export function buildDnsAidManifest(origin: string): object {
  const host = new URL(origin).hostname;
  return {
    $schema: 'https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/',
    domain: host,
    note: 'Publish these records in authoritative DNS for the hostname. Enable DNSSEC on the zone.',
    records: [
      {
        name: `_index._agents.${host}.`,
        type: 'HTTPS',
        priority: 1,
        target: `${host}.`,
        params: { alpn: 'h3,h2', port: 443 },
      },
      {
        name: `_a2a._agents.${host}.`,
        type: 'SVCB',
        priority: 1,
        target: `${host}.`,
        params: { alpn: 'h2', port: 443, mandatory: 'alpn,port' },
      },
    ],
    discovery: {
      apiCatalog: `${origin}/.well-known/api-catalog`,
      authMd: `${origin}/auth.md`,
    },
  };
}

export function buildLlmsTxt(origin: string): string {
  const lines = [
    '# PitchIntel',
    '',
    '> World Cup 2026 tactical probability, schedule, standings, and news intelligence — Vietnamese-first.',
    '',
    'PitchIntel answers questions about WC 2026 fixtures, live scores, standings, predictions, and sourced news analysis.',
    '',
    '## Canonical pages',
    '',
    `- Home: ${origin}/`,
    `- Match schedule: ${origin}/matches`,
    `- Probability guide: ${origin}/guide`,
    `- News intelligence: ${origin}/news-intelligence`,
    '',
    '## Vietnamese query landing pages',
    '',
    ...SEO_PAGES.map(
      (p) => `- ${p.titleVi}: ${origin}${p.path} — ${p.answerVi}`,
    ),
    '',
    '## Machine-readable',
    '',
    `- Sitemap: ${origin}/sitemap.xml`,
    `- Robots: ${origin}/robots.txt`,
    `- OpenAPI: ${origin}/.well-known/openapi.json`,
    `- API catalog: ${origin}/.well-known/api-catalog`,
    `- Agent auth: ${origin}/auth.md`,
    `- Agent skills: ${origin}/.well-known/agent-skills/index.json`,
    '',
    '## Data sources',
    '',
    '- Match schedule and results: FIFA official data',
    '- Probabilities: PitchIntel internal model (see /guide)',
    '- News: RSS and FIFA sources with publisher attribution on each article',
    '',
    '## Contact',
    '',
    '- GitHub: https://github.com/sycu8/world-cup-intelligence',
  ];
  return `${lines.join('\n')}\n`;
}

export function buildLinkHeaderValue(origin: string): string {
  return [
    `<${origin}/.well-known/api-catalog>; rel="api-catalog"`,
    `<${origin}/.well-known/openapi.json>; rel="service-desc"; type="application/json"`,
    `<${origin}/docs/api>; rel="service-doc"; type="text/html"`,
    `<${origin}/docs/api.md>; rel="service-doc"; type="text/markdown"`,
    `<${origin}/auth.md>; rel="describedby"; type="text/markdown"`,
    `<${origin}/llms.txt>; rel="describedby"; type="text/plain"`,
    `<${origin}/.well-known/oauth-protected-resource>; rel="oauth-protected-resource"; type="application/json"`,
    `<${origin}/sitemap.xml>; rel="sitemap"; type="application/xml"`,
    `<${origin}/.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"`,
  ].join(', ');
}
