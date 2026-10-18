import { z } from 'zod';
import type { AppEnv } from '../env';
import { guardedAiRun } from './aiCallGuard';
import { gatewayChatJson, isGatewayConfigured } from './gatewayClient';
import { resolveModel, WORKERS_AI_TEXT_MODEL } from './modelRouter';
import { SYSTEM_NO_INVENT_NUMBERS, entityExtractPrompt } from './prompts';
import { getTeamsByTournament } from '../db/repositories/teamsRepo';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { buildTeamAliasIndex, findTeamIdsInText } from '../services/newsMatchImpact';
import { logAiCallFailure } from '../utils/logger';
import { extractJsonObject, workersAiResultText } from './workersAiText';

const EntitySchema = z.object({
  teams: z.array(z.string()).default([]),
  players: z.array(z.string()).default([]),
  injuries: z.array(z.string()).default([]),
  tacticalNotes: z.array(z.string()).default([]),
  formations: z.array(z.string()).default([]),
});

export type ExtractedEntities = z.infer<typeof EntitySchema>;

const INJURY_LINE_RE =
  /([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\s+(?:is|was|has been|remains)?\s*(?:ruled out|injured|doubtful|sidelined|out)/gi;

export function extractEntitiesRuleBased(
  articleText: string,
  teamNames: string[],
): ExtractedEntities {
  const lower = articleText.toLowerCase();
  const teams = teamNames.filter((n) => lower.includes(n.toLowerCase()));

  const injuries: string[] = [];
  let m: RegExpExecArray | null;
  INJURY_LINE_RE.lastIndex = 0;
  while ((m = INJURY_LINE_RE.exec(articleText))) {
    injuries.push(m[0].trim().slice(0, 120));
    if (injuries.length >= 5) break;
  }

  const tacticalNotes: string[] = [];
  if (/\blineup\b/i.test(articleText)) tacticalNotes.push('lineup');
  if (/\bformation\b/i.test(articleText)) tacticalNotes.push('formation');
  if (/\bsquad\b/i.test(articleText)) tacticalNotes.push('squad');

  const formations: string[] = [];
  const formMatch = /\b([34]-[0-9]-[0-9]|[34]-[0-9]-[0-9]-[0-9])\b/.exec(articleText);
  if (formMatch) formations.push(formMatch[1]!);

  return { teams, players: [], injuries, tacticalNotes, formations };
}

async function workersAiExtract(env: AppEnv, articleText: string): Promise<ExtractedEntities | null> {
  if (!env.AI) return null;
  const started = Date.now();
  try {
    const response = await guardedAiRun(
      env,
      WORKERS_AI_TEXT_MODEL,
      {
        max_tokens: resolveModel('entity_extract').maxTokens,
        messages: [
          { role: 'system', content: SYSTEM_NO_INVENT_NUMBERS },
          { role: 'user', content: entityExtractPrompt(articleText) },
        ],
      },
      { source: articleText },
    );
    if (response == null) return null;
    const text = extractJsonObject(await workersAiResultText(response));
    if (!text.includes('{')) return null;
    return EntitySchema.parse(JSON.parse(text));
  } catch (error) {
    logAiCallFailure('entity extraction workers ai failed', error, {
      model: WORKERS_AI_TEXT_MODEL,
      durationMs: Date.now() - started,
    });
    return null;
  }
}

export async function extractEntitiesFromArticle(
  env: AppEnv,
  articleText: string,
): Promise<ExtractedEntities | null> {
  if (isGatewayConfigured(env)) {
    const raw = await gatewayChatJson<ExtractedEntities>(env, 'entity_extract', [
      { role: 'system', content: SYSTEM_NO_INVENT_NUMBERS },
      { role: 'user', content: entityExtractPrompt(articleText) },
    ]);
    if (raw) {
      try {
        return EntitySchema.parse(raw);
      } catch {
        /* fall through */
      }
    }
  }

  const viaWorkers = await workersAiExtract(env, articleText);
  if (viaWorkers) return viaWorkers;

  const wcTeams = await getTeamsByTournament(env.DB, WC2026_TOURNAMENT_ID);
  const aliasIndex = buildTeamAliasIndex(wcTeams);
  const matchedIds = findTeamIdsInText(articleText, aliasIndex);
  const teamNames = matchedIds
    .map((id) => aliasIndex.find((a) => a.teamId === id)?.name)
    .filter((x): x is string => Boolean(x));

  return extractEntitiesRuleBased(articleText, teamNames);
}
