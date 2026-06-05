import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { parseEnv } from '../env';
import * as sourcesRepo from '../db/repositories/sourcesRepo';
import { runBacktest } from '../models/backtesting/backtestRunner';
import { z } from 'zod';
import {
  ingestManualMarketInput,
  ingestMatchMarkets,
} from '../market/services/marketIngestionService';
import { recomputeMatchProbability, recomputeAllWc2026Matches } from '../services/recomputeMatch';
import {
  applyOfficialLineupToMatch,
  syncOfficialLineupsToMatches,
} from '../services/officialLineupSync';

const marketSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source_type: z.enum([
    'licensed_odds_api',
    'partner_feed',
    'manual_analyst_input',
    'compliant_public_api',
  ]),
  base_url: z.string().url().optional().nullable(),
  reliability_score: z.number().min(0).max(1).optional(),
  allowed_usage: z.string().optional(),
  license_notes: z.string().optional(),
});

const manualMarketSchema = z.object({
  home: z.number().gt(1),
  draw: z.number().gt(1),
  away: z.number().gt(1),
});

const sourceRegistrySchema = z.object({
  id: z.string().min(1),
  source_name: z.string().min(1),
  source_type: z.string().min(1),
});

const sourcePatchSchema = z.object({
  health_status: z.string().optional(),
});

const officialLineupSchema = z.object({
  teamId: z.string().min(1),
  formation: z.string().min(1),
  players: z
    .array(
      z.object({
        playerId: z.string().min(1),
        isStarter: z.boolean().optional(),
        positionSlot: z.string().optional().nullable(),
        shirtNumber: z.number().int().optional().nullable(),
      }),
    )
    .min(7)
    .max(23),
  sourceId: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1).optional(),
});

export const adminRoutes = new Hono<{ Bindings: AppEnv }>();

function requireAdmin(c: { req: { header: (n: string) => string | undefined }; env: AppEnv }) {
  const config = parseEnv(c.env);
  const token = c.req.header('X-Admin-Token');
  if (!config.adminToken || token !== config.adminToken) {
    return false;
  }
  return true;
}

adminRoutes.use('*', async (c, next) => {
  const config = parseEnv(c.env);
  // Read-only admin dashboard endpoints (e.g. source health) are public
  if (c.req.method === 'GET') {
    return next();
  }
  if (config.environment === 'development' && !config.adminToken) {
    return next();
  }
  if (!requireAdmin(c)) return c.json({ error: 'Unauthorized' }, 401);
  return next();
});

adminRoutes.post('/ingest', async (c) => {
  if (c.env.INGEST_QUEUE) {
    await c.env.INGEST_QUEUE.send({ type: 'bulk_ingest', idempotencyKey: crypto.randomUUID() });
  }
  return c.json({ status: 'queued' });
});

adminRoutes.post('/ingest/source/:sourceId', async (c) => {
  const sourceId = c.req.param('sourceId');
  if (c.env.INGEST_QUEUE) {
    await c.env.INGEST_QUEUE.send({ type: 'source_ingest', sourceId, idempotencyKey: crypto.randomUUID() });
  }
  return c.json({ status: 'queued', sourceId });
});

adminRoutes.post('/recompute/:matchId', async (c) => {
  if (c.env.MODEL_QUEUE) {
    await c.env.MODEL_QUEUE.send({ type: 'recompute', matchId: c.req.param('matchId') });
  }
  return c.json({ status: 'queued', matchId: c.req.param('matchId') });
});

adminRoutes.post('/recompute-all', async (c) => {
  const data = await recomputeAllWc2026Matches(c.env);
  return c.json({ data });
});

adminRoutes.post('/backtest', async (c) => {
  const summary = await runBacktest(c.env.DB);
  return c.json({ data: summary });
});

adminRoutes.get('/sources', async (c) => {
  const data = await sourcesRepo.listSources(c.env.DB);
  return c.json({ data });
});

adminRoutes.post('/sources', async (c) => {
  const body = sourceRegistrySchema.parse(await c.req.json());
  await c.env.DB
    .prepare(
      'INSERT INTO source_registry (id, source_name, source_type, health_status) VALUES (?, ?, ?, ?)',
    )
    .bind(body.id, body.source_name, body.source_type, 'unknown')
    .run();
  return c.json({ status: 'created' }, 201);
});

adminRoutes.post('/market-sources', async (c) => {
  const body = marketSourceSchema.parse(await c.req.json());
  await c.env.DB.prepare(
    `INSERT INTO market_sources (id, name, source_type, base_url, reliability_score, allowed_usage, license_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      body.id,
      body.name,
      body.source_type,
      body.base_url ?? null,
      body.reliability_score ?? 0.5,
      body.allowed_usage ?? 'analytical_context_only',
      body.license_notes ?? null,
    )
    .run();
  return c.json({ status: 'created' }, 201);
});

adminRoutes.patch('/market-sources/:sourceId', async (c) => {
  const body = marketSourceSchema.partial().parse(await c.req.json());
  if (body.reliability_score != null) {
    await c.env.DB.prepare(
      'UPDATE market_sources SET reliability_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    )
      .bind(body.reliability_score, c.req.param('sourceId'))
      .run();
  }
  return c.json({ status: 'updated' });
});

adminRoutes.post('/market-ingest/:matchId', async (c) => {
  const n = await ingestMatchMarkets(c.env, c.req.param('matchId'));
  return c.json({ status: 'ok', stored: n });
});

adminRoutes.post('/manual-market-input/:matchId', async (c) => {
  const odds = manualMarketSchema.parse(await c.req.json());
  const n = await ingestManualMarketInput(c.env, c.req.param('matchId'), odds);
  await recomputeMatchProbability(c.env, c.req.param('matchId'));
  return c.json({ status: 'ok', stored: n });
});

adminRoutes.post('/recompute-scenarios/:matchId', async (c) => {
  await recomputeMatchProbability(c.env, c.req.param('matchId'));
  return c.json({ status: 'ok', matchId: c.req.param('matchId') });
});

adminRoutes.post('/recompute-team-system/:matchId', async (c) => {
  await recomputeMatchProbability(c.env, c.req.param('matchId'));
  return c.json({ status: 'ok', matchId: c.req.param('matchId') });
});

adminRoutes.post('/matches/:matchId/lineup', async (c) => {
  const body = officialLineupSchema.parse(await c.req.json());
  const result = await applyOfficialLineupToMatch(c.env, {
    matchId: c.req.param('matchId'),
    teamId: body.teamId,
    formation: body.formation,
    players: body.players,
    sourceId: body.sourceId,
    confidence: body.confidence,
  });
  if (result.updated) {
    await recomputeMatchProbability(c.env, c.req.param('matchId'));
  }
  return c.json({ status: 'ok', ...result });
});

adminRoutes.post('/lineups/sync-squads', async (c) => {
  const data = await syncOfficialLineupsToMatches(c.env, { recompute: true });
  return c.json({ data });
});

adminRoutes.patch('/sources/:sourceId', async (c) => {
  const body = sourcePatchSchema.parse(await c.req.json());
  if (body.health_status) {
    await c.env.DB
      .prepare('UPDATE source_registry SET health_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(body.health_status, c.req.param('sourceId'))
      .run();
  }
  return c.json({ status: 'updated' });
});
