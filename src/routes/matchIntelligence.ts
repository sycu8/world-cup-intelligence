import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { resolveMatchRef } from '../services/matchRef';
import {
  getTeamSystemPayload,
  getScenariosPayload,
  getMarketSignalsPayload,
  buildModelVsMarket,
  getProbabilityMovement,
} from '../services/matchIntelligence';
import { explainModelVsMarket } from '../ai/explainModelVsMarket';
import { explainScenarioLikelihood } from '../ai/explainScenarioLikelihood';
import { explainTeamSystemStrength } from '../ai/explainTeamSystemStrength';

export const matchIntelligenceRoutes = new Hono<{ Bindings: AppEnv }>();

matchIntelligenceRoutes.get('/:matchId/team-system', async (c) => {
  const resolved = await resolveMatchRef(c.env.DB, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const data = await getTeamSystemPayload(c.env, resolved.id);
  const ai = await explainTeamSystemStrength(c.env, data).catch(() => null);
  return c.json({ data, ai });
});

matchIntelligenceRoutes.get('/:matchId/scenarios', async (c) => {
  const resolved = await resolveMatchRef(c.env.DB, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const data = await getScenariosPayload(c.env, resolved.id);
  const ai = await explainScenarioLikelihood(c.env, data).catch(() => null);
  return c.json({ data, ai });
});

matchIntelligenceRoutes.get('/:matchId/market-signals', async (c) => {
  const resolved = await resolveMatchRef(c.env.DB, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const data = await getMarketSignalsPayload(c.env, resolved.id);
  return c.json({ data });
});

matchIntelligenceRoutes.get('/:matchId/model-vs-market', async (c) => {
  const resolved = await resolveMatchRef(c.env.DB, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const comparison = await buildModelVsMarket(c.env, resolved.id);
  if (!comparison) {
    return c.json({
      data: null,
      meta: { message: 'No market-implied probability on file. Use admin manual market input.' },
    });
  }
  const ai = await explainModelVsMarket(c.env, comparison).catch(() => null);
  return c.json({ data: comparison, ai });
});

matchIntelligenceRoutes.get('/:matchId/probability-movement', async (c) => {
  const resolved = await resolveMatchRef(c.env.DB, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const data = await getProbabilityMovement(c.env, resolved.id);
  return c.json({ data });
});
