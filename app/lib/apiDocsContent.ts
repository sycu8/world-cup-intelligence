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
      'Partner integrations: [GitHub repository](https://github.com/sycu8/world-cup-intelligence) for source and webhooks.',
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
    id: 'probability-model',
    title: 'Probability model',
    description:
      'Pre-match probabilities use engine **wc-prob-v5**: attack/defense ratings, H2H modifier, Dixon–Coles scoreline matrix, and calibrated parameters from WC 2018/2022 holdout.',
    content: [
      'Responses include `modelVersion` (e.g. `wc-prob-v5`), `homeWinProb`, `drawProb`, `awayWinProb`, `expectedHomeGoals`, `expectedAwayGoals`, and `scorelineDistribution`.',
      'W + D + L should sum to ~1.0 per snapshot.',
      'Bulk gap-fill: `GET /api/tournaments/2026/match-probabilities` persists missing snapshots under a 3s budget, then async full recompute.',
      'Force full refresh: `POST /api/admin/recompute-all` (admin token).',
    ],
  },
  {
    id: 'core-api',
    title: 'Core API',
    description: 'Public read-only JSON. No authentication. `:ref` accepts SEO slug or legacy `m-*` id.',
    endpoints: [
      { method: 'GET', path: '/api/health', title: 'Health & pipeline', description: 'Dependencies, `environment`, last FIFA sync, refresh intervals.', auth: 'none' },
      { method: 'GET', path: '/api/home', title: 'Homepage bundle', description: 'Dashboard, schedule, standings, and match probabilities in one response (KV-cached).', auth: 'none' },
      { method: 'GET', path: '/api/schedule', title: 'Full schedule', description: '104 WC2026 fixtures with slugs and country codes.', auth: 'none' },
      { method: 'GET', path: '/api/dashboard', title: 'Dashboard snapshot', description: 'Featured match and tournament counts.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref', title: 'Match detail', description: 'Status, minute, scores, team names. Triggers FIFA sync when live.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/stats', title: 'Live stats', description: 'Possession, shots, passes, xG — FIFA Match Centre.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/recap', title: 'Recap & commentary', description: 'Summary and live blog lines.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/events', title: 'Match events', description: 'Goals, cards, substitutions timeline.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/staff', title: 'Staff & officials', description: 'Managers and match officials.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/probability', title: 'Model probabilities', description: 'Win/draw/loss, xG, scoreline distribution (`wc-prob-v5`).', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/pitch-map', title: 'Pitch map', description: 'Player positions, ratings, movement vectors.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/lineups', title: 'Lineups', description: 'Official formations and starters.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/history', title: 'World Cup H2H', description: 'Past WC meetings between the two teams.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/preview', title: 'Match preview', description: 'Pre-match analysis: form, standings, lineup hints.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/tactical-briefing', title: 'Tactical briefing', description: 'AI-generated tactical summary.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/scenario-predictions', title: 'Scenario predictions', description: 'Baseline + alternative scenarios with model confidence.', auth: 'none' },
      { method: 'GET', path: '/api/matches/:ref/probability-movement', title: 'Probability movement', description: 'Historical probability snapshots over time.', auth: 'none' },
      { method: 'GET', path: '/api/analysis/:ref', title: 'Multi-factor analysis', description: 'Deep-dive analysis page data.', auth: 'none' },
    ],
  },
  {
    id: 'tournament-api',
    title: 'Tournament API',
    description: 'Aggregates for WC 2026 standings, bracket, champion odds, and bulk probabilities.',
    endpoints: [
      { method: 'GET', path: '/api/tournaments/2026/standings', title: 'Group standings', description: '12 groups A–L plus third-place ranking.', auth: 'none' },
      { method: 'GET', path: '/api/tournaments/2026/bracket', title: 'Knockout bracket', description: 'R32 through final with match refs.', auth: 'none' },
      { method: 'GET', path: '/api/tournaments/2026/match-probabilities', title: 'Bulk match probabilities', description: 'All 104 matches with gap-fill; meta `{ total, withProbability, pending }`.', auth: 'none' },
      { method: 'GET', path: '/api/tournaments/2026/champion-odds', title: 'Champion odds', description: 'Monte Carlo tournament winner probabilities.', auth: 'none' },
      { method: 'GET', path: '/api/tournaments/2026/prediction-accuracy', title: 'Prediction accuracy', description: 'Favorite hit rate, top-3 scoreline, Brier score on completed matches.', auth: 'none' },
      {
        method: 'GET',
        path: '/api/tournaments/2026/upcoming-probability-verification',
        title: 'Upcoming probability check',
        description: 'Lists upcoming fixtures missing probability snapshots. `?refresh=1` triggers gap-fill.',
        auth: 'none',
      },
      { method: 'GET', path: '/api/leagues', title: 'League catalog', description: 'World Cup 2026 plus V.League 1, J1 League, La Liga, and CAF Champions League, grouped by region.', auth: 'none' },
      { method: 'GET', path: '/api/leagues/:slug', title: 'League hub', description: 'Standings, live scores, fixtures, results, W/D/L probabilities, news, and top scorers for one league.', auth: 'none' },
    ],
  },
  {
    id: 'teams-news',
    title: 'Teams & news',
    description: 'Team directory, World Cup head-to-head, and multi-source news intelligence.',
    endpoints: [
      { method: 'GET', path: '/api/teams', title: 'Team list', description: '48 WC2026 teams with codes and confederation.', auth: 'none' },
      { method: 'GET', path: '/api/teams/:teamId', title: 'Team profile', description: 'Team metadata and tournament context.', auth: 'none' },
      { method: 'GET', path: '/api/teams/:teamId/wc-h2h', title: 'Team WC H2H', description: 'Historical WC results by opponent.', auth: 'none' },
      { method: 'GET', path: '/api/news', title: 'News feed', description: 'Paginated articles from 24+ RSS sources + FIFA WC2026; hot strip + `meta.total`.', auth: 'none' },
      { method: 'GET', path: '/api/news/:docId', title: 'News article', description: 'Single article with Vietnamese translation on demand.', auth: 'none' },
      { method: 'GET', path: '/api/news/assets/:docId', title: 'News thumbnail', description: 'Proxied or R2-hosted article image.', auth: 'none' },
    ],
  },
  {
    id: 'admin-api',
    title: 'Admin API',
    description: 'Operations routes. Requires `X-Admin-Token` header (see `/auth.md`).',
    endpoints: [
      { method: 'POST', path: '/api/admin/recompute-all', title: 'Recompute all matches', description: 'Bulk recompute 104 WC2026 matches (`wc-prob-v5`).', auth: 'admin' },
      { method: 'POST', path: '/api/admin/recompute/:matchId', title: 'Recompute one match', description: 'Queue probability recompute for a single match.', auth: 'admin' },
      { method: 'POST', path: '/api/admin/crawl-news', title: 'Crawl news now', description: 'Trigger RSS + FIFA WC2026 news crawl immediately.', auth: 'admin' },
      { method: 'POST', path: '/api/admin/refresh-champion-odds', title: 'Refresh champion odds', description: 'Re-run Monte Carlo champion simulation.', auth: 'admin' },
      { method: 'POST', path: '/api/admin/verify-upcoming-probabilities', title: 'Verify upcoming probabilities', description: 'Gap-fill missing snapshots for upcoming fixtures.', auth: 'admin' },
      { method: 'POST', path: '/api/admin/lineups/sync-squads', title: 'Sync squads to lineups', description: 'Copy official squads into upcoming match lineups.', auth: 'admin' },
      { method: 'POST', path: '/api/admin/matches/:matchId/lineup', title: 'Set match lineup', description: 'Submit official XI (≥ 7 players).', auth: 'admin' },
      { method: 'POST', path: '/api/admin/api-clients', title: 'Create API client', description: 'Provision partner `pi_live_…` key (shown once).', auth: 'admin' },
      { method: 'GET', path: '/api/admin/api-clients', title: 'List API clients', description: 'Partner integrations registered on this deployment.', auth: 'admin' },
      { method: 'DELETE', path: '/api/admin/api-clients/:id', title: 'Revoke API client', description: 'Disable a partner API key.', auth: 'admin' },
      { method: 'GET', path: '/api/admin/sources', title: 'Source health', description: 'Ingestion source registry status (public GET).', auth: 'none' },
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
