import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { resolveMatchRef } from '../services/matchRef';
import * as matchPredictionScenarioRepo from '../db/repositories/matchPredictionScenarioRepo';
import {
  generateMatchScenarios,
  getMatchScenarioSet,
} from '../services/matchScenarioService';
import { explainScenarioComparison } from '../ai/explainScenarioComparison';
import { explainScenarioPrediction } from '../ai/explainScenarioPrediction';

export const scenarioPredictionRoutes = new Hono<{ Bindings: AppEnv }>();

scenarioPredictionRoutes.get('/:matchId/scenario-predictions', async (c) => {
  const resolved = await resolveMatchRef(c.env.DB, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const data = await getMatchScenarioSet(c.env, resolved.id);
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json({ data });
});

scenarioPredictionRoutes.get('/:matchId/scenario-predictions/:scenarioId', async (c) => {
  const resolved = await resolveMatchRef(c.env.DB, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const matchId = resolved.id;
  const scenarioId = c.req.param('scenarioId');
  const scenario = await matchPredictionScenarioRepo.getScenarioById(c.env.DB, scenarioId);
  if (!scenario || scenario.matchId !== matchId) return c.json({ error: 'Not found' }, 404);
  const ai = await explainScenarioPrediction(c.env, matchId, scenario).catch(() => null);
  return c.json({ data: scenario, ai });
});

scenarioPredictionRoutes.get('/:matchId/scenario-comparison', async (c) => {
  const resolved = await resolveMatchRef(c.env.DB, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const data = await getMatchScenarioSet(c.env, resolved.id);
  if (!data) return c.json({ error: 'Not found' }, 404);
  const ai = await explainScenarioComparison(c.env, data).catch(() => null);
  return c.json({
    data: {
      matchId: data.matchId,
      scenarios: data.scenarios.map((s) => ({
        id: s.id,
        name: s.scenarioName,
        scenarioProbability: s.scenarioProbability,
        homeWinProb: s.homeWinProb,
        drawProb: s.drawProb,
        awayWinProb: s.awayWinProb,
        mostLikelyScore: s.mostLikelyScore,
      })),
      comparison: data.comparison,
    },
    ai,
  });
});

scenarioPredictionRoutes.post('/:matchId/scenario-predictions/regenerate', async (c) => {
  const resolved = await resolveMatchRef(c.env.DB, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const data = await generateMatchScenarios(c.env, resolved.id);
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json({ data });
});
