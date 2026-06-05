import { z } from 'zod';
import type { AppEnv } from '../env';
import { gatewayChatJson, isGatewayConfigured } from './gatewayClient';
import { SYSTEM_NO_INVENT_NUMBERS, multiVariableSynthesisPrompt } from './prompts';
import { nowIso } from '../utils/time';
import * as matchesRepo from '../db/repositories/matchesRepo';
import * as teamsRepo from '../db/repositories/teamsRepo';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import * as eventsRepo from '../db/repositories/eventsRepo';
import { buildMatchFeaturesWithForm } from '../services/matchFeatures';
import { buildExplanationFactors } from '../models/probability/explainFactors';

export const MultiVariableAnalysisSchema = z.object({
  matchId: z.string(),
  generatedAt: z.string(),
  executiveSummary: z.string(),
  variableInsights: z.array(
    z.object({
      variable: z.string(),
      impact: z.enum(['high', 'medium', 'low']),
      direction: z.string(),
      explanation: z.string(),
    }),
  ),
  tacticalRecommendations: z.array(z.string()),
  riskFactors: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  modelsUsed: z.array(z.string()).optional(),
});

export type MultiVariableAnalysis = z.infer<typeof MultiVariableAnalysisSchema>;

export async function getCachedAnalysis(
  env: AppEnv,
  matchId: string,
): Promise<MultiVariableAnalysis | null> {
  const raw = await env.KV.get(`analysis:${matchId}`);
  if (!raw) return null;
  try {
    return MultiVariableAnalysisSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function runMultiVariableAnalysis(
  env: AppEnv,
  matchId: string,
): Promise<MultiVariableAnalysis | null> {
  const cached = await getCachedAnalysis(env, matchId);
  if (cached) return cached;

  if (!isGatewayConfigured(env)) return null;

  const match = await matchesRepo.getMatch(env.DB, matchId);
  if (!match) return null;
  const home = await teamsRepo.getTeam(env.DB, match.home_team_id);
  const away = await teamsRepo.getTeam(env.DB, match.away_team_id);
  if (!home || !away) return null;

  const snap = await probabilityRepo.getLatestSnapshot(env.DB, matchId);
  const events = await eventsRepo.getMatchEvents(env.DB, matchId);
  const tournament = await env.DB.prepare('SELECT year, name FROM tournaments WHERE id = ?')
    .bind(match.tournament_id)
    .first<{ year: number; name: string }>();

  const features = await buildMatchFeaturesWithForm(env, match, home, away, tournament?.year ?? 2026);
  const { positive, negative } = buildExplanationFactors(features);

  const ctx = {
    match: {
      id: match.id,
      status: match.status,
      minute: match.minute,
      score: { home: match.home_score, away: match.away_score },
      stage: match.stage,
      kickoff: match.kickoff_utc,
    },
    teams: {
      home: { id: home.id, name: home.name, elo: home.elo_rating, fifa: home.fifa_ranking },
      away: { id: away.id, name: away.name, elo: away.elo_rating, fifa: away.fifa_ranking },
    },
    probability: snap
      ? {
          homeWin: snap.home_win_prob,
          draw: snap.draw_prob,
          awayWin: snap.away_win_prob,
          xgHome: snap.expected_home_goals,
          xgAway: snap.expected_away_goals,
          mostLikely: snap.most_likely_score,
          confidence: snap.confidence,
        }
      : null,
    collectiveVariables: {
      home: features.homeTeam,
      away: features.awayTeam,
    },
    explanationFactors: { positive, negative },
    recentEvents: events.slice(-12),
    tournament: tournament?.name,
  };

  const result = await gatewayChatJson<MultiVariableAnalysis>(env, 'multi_variable_synthesis', [
    { role: 'system', content: SYSTEM_NO_INVENT_NUMBERS },
    { role: 'user', content: multiVariableSynthesisPrompt(ctx) },
  ]);

  if (!result) return null;

  const parsed = MultiVariableAnalysisSchema.parse({
    ...result,
    matchId,
    generatedAt: result.generatedAt ?? nowIso(),
    modelsUsed: ['openai/gpt-5.5 (thinking) via Cloudflare AI Gateway'],
  });

  await env.KV.put(`analysis:${matchId}`, JSON.stringify(parsed), { expirationTtl: 3600 });
  return parsed;
}
