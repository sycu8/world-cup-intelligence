import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { listMatchesWithSlug } from '../services/matchRef';
import { publicApiKeyRequired, resolveApiKey, type ApiKeyAuth } from '../services/publicApi/apiKey';
import { checkRateLimit } from '../services/publicApi/rateLimit';
import { queryFeed } from '../services/publicApi/feed';
import { getMatchSnapshot } from '../services/publicApi/snapshot';
import {
  createWebhook,
  listWebhooks,
  deleteWebhook,
  deliverWebhook,
} from '../services/publicApi/webhooks';
import { appendFeedEvent } from '../services/publicApi/feed';
import { PUBLIC_API_EVENT_TYPES } from '../services/publicApi/types';

type PublicApiVars = {
  apiAuth: ApiKeyAuth | null;
};

export const publicApiRoutes = new Hono<{ Bindings: AppEnv; Variables: PublicApiVars }>();

publicApiRoutes.use('*', async (c, next) => {
  const apiKey = c.req.header('X-API-Key') ?? c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  const auth = apiKey ? await resolveApiKey(c.env, apiKey) : null;
  c.set('apiAuth', auth);

  if (publicApiKeyRequired(c.env) && !auth) {
    return c.json({ error: 'API key required', hint: 'Send X-API-Key: pi_live_...' }, 401);
  }

  const subject = auth?.client.id ?? c.req.header('CF-Connecting-IP') ?? 'anon';
  const rl = await checkRateLimit(c.env, subject, !!auth);
  if (!rl.allowed) {
    return c.json({ error: 'Rate limit exceeded', retryAfterSec: rl.resetSec }, 429);
  }

  await next();
});

publicApiRoutes.get('/', (c) =>
  c.json({
    version: 'v1',
    description: 'PitchIntel Public API — live match updates for third-party integrations',
    docs: '/docs/api#public-api-v1',
    integration: {
      polling: 'GET /api/v1/feed?cursor=0 — poll every 5–15s for live matches',
      webhooks: 'POST /api/v1/webhooks — register URL (requires API key)',
      sse: 'GET /api/v1/stream?cursor=0 — Server-Sent Events stream',
      snapshot: 'GET /api/v1/matches/:ref/snapshot — full match state in one call',
    },
    events: PUBLIC_API_EVENT_TYPES,
  }),
);

publicApiRoutes.get('/feed', async (c) => {
  const cursor = Number(c.req.query('cursor') ?? '0') || 0;
  const limit = Number(c.req.query('limit') ?? '50');
  const matchId = c.req.query('matchId') ?? undefined;
  const types = c.req.query('types')?.split(',').filter(Boolean);

  const { events, nextCursor } = await queryFeed(c.env, { cursor, limit, matchId, types });
  return c.json({
    data: events,
    meta: {
      cursor,
      nextCursor,
      count: events.length,
      pollHintSec: 10,
    },
  });
});

publicApiRoutes.get('/matches', async (c) => {
  const since = c.req.query('since');
  const statusFilter = c.req.query('status')?.split(',').filter(Boolean);
  let matches = await listMatchesWithSlug(c.env.DB);

  if (statusFilter?.length) {
    matches = matches.filter((m) => statusFilter.includes(m.status));
  }
  if (since) {
    const sinceMs = new Date(since).getTime();
    matches = matches.filter((m) => m.updated_at && new Date(m.updated_at).getTime() >= sinceMs);
  }

  return c.json({
    data: matches.map((m) => ({
      matchId: m.id,
      slug: m.slug,
      status: m.status,
      minute: m.minute ?? null,
      homeScore: m.home_score,
      awayScore: m.away_score,
      homeName: m.home_name,
      awayName: m.away_name,
      kickoffUtc: m.kickoff_utc,
      fifaMatchId: m.fifa_match_id ?? null,
      updatedAt: m.updated_at,
    })),
    meta: { count: matches.length },
  });
});

publicApiRoutes.get('/matches/:ref/snapshot', async (c) => {
  const snapshot = await getMatchSnapshot(c.env, c.req.param('ref'), {
    waitUntil: (promise) => c.executionCtx.waitUntil(promise),
  });
  if (!snapshot) return c.json({ error: 'Not found' }, 404);
  return c.json({ data: snapshot });
});

publicApiRoutes.get('/stream', async (c) => {
  const initialCursor = Number(c.req.query('cursor') ?? '0') || 0;
  const matchId = c.req.query('matchId') ?? undefined;
  const encoder = new TextEncoder();
  let cursor = initialCursor;
  let closed = false;

  const stream = new ReadableStream({
    async pull(controller) {
      if (closed) return;
      try {
        const { events, nextCursor } = await queryFeed(c.env, {
          cursor,
          limit: 20,
          matchId,
        });
        if (events.length) {
          for (const event of events) {
            controller.enqueue(
              encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
            );
            cursor = event.id;
          }
        } else if (nextCursor) {
          cursor = nextCursor;
        }
        await new Promise((r) => setTimeout(r, events.length ? 1000 : 5000));
      } catch {
        controller.enqueue(encoder.encode(`event: error\ndata: {"message":"stream error"}\n\n`));
        await new Promise((r) => setTimeout(r, 5000));
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).optional(),
});

publicApiRoutes.post('/webhooks', async (c) => {
  const auth = c.get('apiAuth');
  if (!auth) return c.json({ error: 'API key required for webhooks' }, 401);

  const body = webhookSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'Invalid payload', details: body.error.flatten() }, 400);

  const { subscription, secret } = await createWebhook(
    c.env,
    auth.client.id,
    body.data.url,
    body.data.events ?? ['*'],
  );

  return c.json({
    data: subscription,
    secret,
    note: 'Store secret securely — shown once. Verify X-PitchIntel-Signature on delivery.',
  });
});

publicApiRoutes.get('/webhooks', async (c) => {
  const auth = c.get('apiAuth');
  if (!auth) return c.json({ error: 'API key required' }, 401);
  const subs = await listWebhooks(c.env, auth.client.id);
  return c.json({ data: subs });
});

publicApiRoutes.delete('/webhooks/:id', async (c) => {
  const auth = c.get('apiAuth');
  if (!auth) return c.json({ error: 'API key required' }, 401);
  const ok = await deleteWebhook(c.env, auth.client.id, c.req.param('id'));
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

publicApiRoutes.post('/webhooks/:id/test', async (c) => {
  const auth = c.get('apiAuth');
  if (!auth) return c.json({ error: 'API key required' }, 401);

  const subs = await listWebhooks(c.env, auth.client.id);
  const sub = subs.find((s) => s.id === c.req.param('id'));
  if (!sub) return c.json({ error: 'Not found' }, 404);

  const testEvent = await appendFeedEvent(c.env, 'match.score_updated', null, {
    test: true,
    message: 'PitchIntel webhook test delivery',
    clientId: auth.client.id,
  });
  if (!testEvent) return c.json({ error: 'Failed to create test event' }, 500);

  const result = await deliverWebhook(c.env, sub.id, testEvent.id);
  return c.json({ ok: result.ok, status: result.status, eventId: testEvent.id });
});
