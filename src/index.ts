import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from './env';
import { parseEnv } from './env';
import { healthRoutes } from './routes/health';
import { tournamentRoutes } from './routes/tournaments';
import { teamRoutes } from './routes/teams';
import { playerRoutes } from './routes/players';
import { matchRoutes } from './routes/matches';
import { matchIntelligenceRoutes } from './routes/matchIntelligence';
import { scenarioPredictionRoutes } from './routes/scenarioPredictions';
import { probabilityRoutes } from './routes/probability';
import { searchRoutes } from './routes/search';
import { adminRoutes } from './routes/admin';
import { homeRoutes } from './routes/home';
import { dashboardRoutes } from './routes/dashboard';
import { scheduleRoutes } from './routes/schedule';
import { newsRoutes } from './routes/news';
import { analysisRoutes } from './routes/analysis';
import { handleIngestBatch } from './queues/ingestConsumer';
import { handleModelBatch } from './queues/modelConsumer';
import type { IngestJob } from './queues/types';
import type { ModelJob } from './queues/types';
import { MatchRoom } from './durable-objects/MatchRoom';
import { handleScheduledCron } from './scheduled/cron';
import { discoveryRoutes } from './routes/discovery';
import { buildLinkHeaderValue, siteOrigin } from './services/siteDiscovery';
import { withStaticAssetCacheHeaders } from './services/staticAssetCache';
import { parseMatchPageSlug } from './utils/matchPath';
import { resolveMatchRef } from './services/matchRef';
import { injectMatchPageHtml } from './services/spaMatchMeta';

const app = new Hono<{ Bindings: AppEnv }>();

app.use('/api/*', async (c, next) => {
  const config = parseEnv(c.env);
  if (config.corsOrigins.length) {
    const origin =
      config.corsOrigins.includes('*') ? '*' : config.corsOrigins;
    return cors({
      origin,
      allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Admin-Token'],
    })(c, next);
  }
  return next();
});

app.route('/api/health', healthRoutes);
app.route('/api/tournaments', tournamentRoutes);
app.route('/api/teams', teamRoutes);
app.route('/api/players', playerRoutes);
app.route('/api/matches', matchIntelligenceRoutes);
app.route('/api/matches', scenarioPredictionRoutes);
app.route('/api/matches', matchRoutes);
app.route('/api/matches', probabilityRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/home', homeRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/schedule', scheduleRoutes);
app.route('/api/news', newsRoutes);
app.route('/api/analysis', analysisRoutes);
app.route('/api/admin', adminRoutes);

app.route('/', discoveryRoutes);

app.get('/', async (c) => {
  const origin = siteOrigin(c.req.url);
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  const cached = withStaticAssetCacheHeaders(c.req.raw, asset);
  const headers = new Headers(cached.headers);
  headers.set('Link', buildLinkHeaderValue(origin));
  return new Response(cached.body, { status: cached.status, headers });
});

app.all('*', async (c) => {
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  if (asset.status !== 404) {
    return withStaticAssetCacheHeaders(c.req.raw, asset);
  }
  const fallback = await c.env.ASSETS.fetch(
    new Request(new URL('/index.html', c.req.url)),
  );
  const cached = withStaticAssetCacheHeaders(c.req.raw, fallback, true);
  const headers = new Headers(cached.headers);
  const origin = siteOrigin(c.req.url);
  headers.set('Link', buildLinkHeaderValue(origin));

  const slug = parseMatchPageSlug(new URL(c.req.url).pathname);
  if (slug) {
    const match = await resolveMatchRef(c.env.DB, slug);
    if (match) {
      const html = injectMatchPageHtml(await cached.text(), match, origin);
      headers.set('Content-Type', 'text/html; charset=utf-8');
      return new Response(html, { status: cached.status, headers });
    }
  }

  return new Response(cached.body, { status: cached.status, headers });
});

function isIngestJob(body: unknown): body is IngestJob {
  return typeof body === 'object' && body !== null && 'idempotencyKey' in body;
}

export default {
  fetch: app.fetch,
  async scheduled(
    controller: ScheduledController,
    env: AppEnv,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await handleScheduledCron(env, controller.cron);
  },
  async queue(batch: MessageBatch<IngestJob | ModelJob>, env: AppEnv): Promise<void> {
    const first = batch.messages[0]?.body;
    if (isIngestJob(first)) {
      await handleIngestBatch(batch as MessageBatch<IngestJob>, env);
    } else {
      await handleModelBatch(batch as MessageBatch<ModelJob>, env);
    }
  },
};

export { MatchRoom };
