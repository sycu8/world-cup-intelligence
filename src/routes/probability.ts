import { Hono } from 'hono';
import type { AppEnv } from '../env';
import * as matchesRepo from '../db/repositories/matchesRepo';
import * as teamsRepo from '../db/repositories/teamsRepo';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import * as tournamentsRepo from '../db/repositories/tournamentsRepo';
import { computeProbability } from '../models/probability/engine';
import { buildMatchFeaturesWithForm } from '../services/matchFeatures';
import { generateTacticalBriefing } from '../ai/tacticalBriefing';
import { parseEnv } from '../env';

export const probabilityRoutes = new Hono<{ Bindings: AppEnv }>();

function parseDistributionJson(json: string | null): Record<string, number> | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Record<string, number>;
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseIntervalJson(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function snapshotIsComplete(snap: {
  scoreline_json: string | null;
  interval_json: string | null;
}): boolean {
  return parseDistributionJson(snap.scoreline_json) !== null && parseIntervalJson(snap.interval_json) !== null;
}

async function resolveProbability(c: { env: AppEnv }, matchId: string, recompute = false) {
  const match = await matchesRepo.getMatch(c.env.DB, matchId);
  if (!match) return null;
  if (!recompute) {
    const snap = await probabilityRepo.getLatestSnapshot(c.env.DB, matchId);
    if (snap && snapshotIsComplete(snap)) {
      return {
        fromSnapshot: true,
        data: {
          matchId,
          homeWinProb: snap.home_win_prob,
          drawProb: snap.draw_prob,
          awayWinProb: snap.away_win_prob,
          expectedHomeGoals: snap.expected_home_goals,
          expectedAwayGoals: snap.expected_away_goals,
          mostLikelyScore: snap.most_likely_score,
          scorelineDistribution: parseDistributionJson(snap.scoreline_json)!,
          intervalDistribution: parseIntervalJson(snap.interval_json)!,
          confidence: snap.confidence,
          modelVersion: snap.model_version,
        },
      };
    }
  }
  const home = await teamsRepo.getTeam(c.env.DB, match.home_team_id);
  const away = await teamsRepo.getTeam(c.env.DB, match.away_team_id);
  if (!home || !away) return null;
  const tournament = await c.env.DB
    .prepare('SELECT year FROM tournaments WHERE id = ?')
    .bind(match.tournament_id)
    .first<{ year: number }>();
  const features = await buildMatchFeaturesWithForm(c.env, match, home, away, tournament?.year ?? 2026);
  const result = await computeProbability(features);
  await probabilityRepo.saveSnapshot(c.env.DB, result);
  return { fromSnapshot: false, data: result };
}

probabilityRoutes.get('/:matchId/probability', async (c) => {
  const resolved = await resolveProbability(c, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  return c.json({ data: resolved.data });
});

probabilityRoutes.get('/:matchId/scoreline', async (c) => {
  const resolved = await resolveProbability(c, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const dist = 'scorelineDistribution' in resolved.data ? resolved.data.scorelineDistribution : resolved.data;
  return c.json({ data: dist });
});

probabilityRoutes.get('/:matchId/intervals', async (c) => {
  const resolved = await resolveProbability(c, c.req.param('matchId'));
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const intervals =
    'intervalDistribution' in resolved.data ? resolved.data.intervalDistribution : resolved.data;
  return c.json({ data: intervals });
});

probabilityRoutes.get('/:matchId/tactical-briefing', async (c) => {
  const matchId = c.req.param('matchId');
  const resolved = await resolveProbability(c, matchId);
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const config = parseEnv(c.env);
  const briefing = await generateTacticalBriefing(c.env, {
    matchId,
    probability: resolved.data,
    aiFallback: config.aiFallback,
  });
  return c.json({ data: briefing });
});
