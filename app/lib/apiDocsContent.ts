export type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'PATCH';

export type ApiEndpoint = {
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  auth?: 'none' | 'optional' | 'api-key' | 'admin';
  params?: { name: string; type: string; desc: string }[];
  example?: string;
  response?: string;
};

export type ApiDocSection = {
  id: string;
  title: string;
  description?: string;
  endpoints?: ApiEndpoint[];
  content?: string[];
  code?: string;
};

export const API_EVENT_TYPES = [
  'match.score_updated',
  'match.status_changed',
  'match.completed',
  'match.stats_updated',
  'match.commentary_updated',
  'match.events_updated',
] as const;

export const API_DOC_SECTIONS: ApiDocSection[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    description:
      'PitchIntel exposes a public REST API for World Cup 2026 live scores, tactical probabilities, stats, and third-party integrations. All responses are JSON over HTTPS.',
    content: [
      'Base URL: `{origin}/api` — replace `{origin}` with your deployment host.',
      'Human-readable docs: this page. Machine-readable: OpenAPI, API catalog, and raw Markdown.',
      'No authentication required for public read endpoints. Partner integrations use API keys and webhooks.',
    ],
  },
  {
    id: 'quick-start',
    title: 'Quick start',
    description: 'Fetch live match data in under a minute.',
    code: `// 1. Check platform health
const health = await fetch('{origin}/api/health').then((r) => r.json());

// 2. List matches
const schedule = await fetch('{origin}/api/schedule').then((r) => r.json());

// 3. Poll live updates (Public API v1 — X-API-Key required on production)
let cursor = 0;
const feed = await fetch(\`{origin}/api/v1/feed?cursor=\${cursor}\`, {
  headers: { 'X-API-Key': 'pi_live_...' },
}).then((r) => r.json());
console.log(feed.data);`,
  },
  {
    id: 'authentication',
    title: 'Authentication',
    description: 'Three access levels depending on your use case.',
    content: [
      '**Public read** — `GET /api/*` (schedule, matches, stats, probability). No headers required.',
      '**Partner API key** — `X-API-Key: pi_live_...` required for `GET /api/v1/*` on production (webhooks, SSE, feed polling). UAT may allow anonymous access.',
      '**Admin** — `X-Admin-Token` for `POST /api/admin/*` and `GET /api/admin/api-clients`.',
    ],
    code: `# Create a partner API key (admin only)
curl -X POST {origin}/api/admin/api-clients \\
  -H "X-Admin-Token: $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My Integration"}'`,
  },
  {
    id: 'public-api-v1',
    title: 'Public API v1',
    description:
      'Built for third-party apps that need continuous match updates — polling, SSE, or webhooks. **Production requires `X-API-Key`** on all routes below.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1',
        title: 'Platform overview',
        description: 'Integration modes, event types, and version metadata.',
        auth: 'api-key',
      },
      {
        method: 'GET',
        path: '/api/v1/feed',
        title: 'Delta event feed',
        description: 'Poll every 5–15s during live matches. Use `cursor` from `meta.nextCursor`.',
        auth: 'api-key',
        params: [
          { name: 'cursor', type: 'integer', desc: 'Last seen event id (default 0)' },
          { name: 'limit', type: 'integer', desc: 'Max events per page (1–200, default 50)' },
          { name: 'matchId', type: 'string', desc: 'Filter to one internal match id' },
          { name: 'types', type: 'string', desc: 'Comma-separated event types' },
        ],
        example: `let cursor = 0;
setInterval(async () => {
  const res = await fetch(\`{origin}/api/v1/feed?cursor=\${cursor}\`, {
    headers: { 'X-API-Key': 'pi_live_...' },
  });
  const { data, meta } = await res.json();
  for (const evt of data) {
    if (evt.type === 'match.score_updated') handleScore(evt.data);
  }
  if (meta.nextCursor) cursor = meta.nextCursor;
}, 10_000);`,
      },
      {
        method: 'GET',
        path: '/api/v1/matches',
        title: 'Match list (filterable)',
        description: 'All WC2026 matches with slug, scores, and `updatedAt`.',
        auth: 'api-key',
        params: [
          { name: 'since', type: 'ISO8601', desc: 'Only matches updated after timestamp' },
          { name: 'status', type: 'string', desc: 'e.g. `live,completed`' },
        ],
      },
      {
        method: 'GET',
        path: '/api/v1/matches/:ref/snapshot',
        title: 'Match snapshot',
        description: 'Score, stats, recap summary, and event count in one request. `:ref` = SEO slug or legacy id.',
        auth: 'api-key',
      },
      {
        method: 'GET',
        path: '/api/v1/stream',
        title: 'SSE event stream',
        description: 'Server-Sent Events for firewalled clients. Same events as `/feed`.',
        auth: 'api-key',
        params: [{ name: 'cursor', type: 'integer', desc: 'Starting event id' }],
      },
      {
        method: 'POST',
        path: '/api/v1/webhooks',
        title: 'Register webhook',
        description: 'Push events to your HTTPS endpoint. Secret shown once for HMAC verification.',
        auth: 'api-key',
        example: `curl -X POST {origin}/api/v1/webhooks \\
  -H "X-API-Key: pi_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your.app/hooks/pitchintel","events":["*"]}'`,
      },
      {
        method: 'GET',
        path: '/api/v1/webhooks',
        title: 'List webhooks',
        description: 'Subscriptions for the authenticated API client.',
        auth: 'api-key',
      },
      {
        method: 'DELETE',
        path: '/api/v1/webhooks/:id',
        title: 'Remove webhook',
        description: 'Deletes a webhook subscription by id.',
        auth: 'api-key',
      },
      {
        method: 'POST',
        path: '/api/v1/webhooks/:id/test',
        title: 'Test delivery',
        description: 'Sends a signed test payload to your webhook URL.',
        auth: 'api-key',
      },
    ],
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    description: 'Signed POST deliveries when match data changes (FIFA sync pipeline).',
    content: [
      'Headers: `X-PitchIntel-Event`, `X-PitchIntel-Delivery-Id`, `X-PitchIntel-Timestamp`, `X-PitchIntel-Signature`.',
      'Verify signature: HMAC-SHA256 of the **raw JSON body** using your webhook secret → `sha256=<hex>`.',
      'Delivery is async via queue; respond with 2xx within 15s.',
    ],
    code: `// Node.js verification example
import crypto from 'crypto';

function verify(secret, rawBody, signatureHeader) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader),
  );
}`,
  },
  {
    id: 'core-api',
    title: 'Core API',
    description: 'Match intelligence endpoints used by the PitchIntel web app.',
    endpoints: [
      { method: 'GET', path: '/api/health', title: 'Health & pipeline', description: 'Dependencies, last FIFA sync, refresh intervals.', auth: 'none' },
      { method: 'GET', path: '/api/schedule', title: 'Full schedule', description: '104 WC2026 fixtures with slugs.', auth: 'none' },
      { method: 'GET', path: '/api/dashboard', title: 'Dashboard snapshot', description: 'Featured match and tournament counts.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref', title: 'Match detail', description: 'Status, minute, scores, team names. Triggers FIFA sync when live.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/stats', title: 'Live stats', description: 'Possession, shots, passes, xG — FIFA Match Centre.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/recap', title: 'Recap & commentary', description: 'Summary and live blog lines.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/events', title: 'Match events', description: 'Goals, cards, substitutions timeline.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/probability', title: 'Model probabilities', description: 'Win/draw/loss, xG, scoreline distribution.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/pitch-map', title: 'Pitch map', description: 'Player positions, ratings, movement vectors.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/lineups', title: 'Lineups', description: 'Official formations and starters.', auth: 'none' },
      { method: 'GET', path: '/api/news', title: 'News feed', description: 'Paginated intelligence articles.', auth: 'none' },
    ],
  },
  {
    id: 'rate-limits',
    title: 'Rate limits',
    description: 'Per-minute limits on `/api/v1/*` (rolling 60s window).',
    content: [
      '**Anonymous** — 60 requests / minute (by IP)',
      '**With API key** — 600 requests / minute (by client id)',
      'HTTP 429 includes `retryAfterSec` when exceeded.',
    ],
  },
  {
    id: 'discovery',
    title: 'Machine-readable',
    description: 'Standards-based discovery for agents, MCP, and OpenAPI tooling.',
    content: [
      '[OpenAPI 3.1]({origin}/.well-known/openapi.json)',
      '[API catalog RFC 9727]({origin}/.well-known/api-catalog)',
      '[Raw Markdown]({origin}/docs/api.md)',
      '[Auth policy]({origin}/auth.md)',
      '[MCP server card]({origin}/.well-known/mcp/server-card.json)',
      '[Agent skills]({origin}/.well-known/agent-skills/index.json)',
    ],
  },
];

export const API_DOC_NAV = API_DOC_SECTIONS.map((s) => ({ id: s.id, title: s.title }));
