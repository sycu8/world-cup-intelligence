import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { getTeamsByTournament } from '../db/repositories/teamsRepo';
import type { TeamRow } from '../db/schema';
import type { ExtractedEntities } from '../ai/entityExtraction';
import { recomputeMatchProbability } from './recomputeMatch';
import { logInfo, logError } from '../utils/logger';

export type ImpactLevel = 'none' | 'low' | 'medium' | 'high';

export type NewsImpactResult = {
  matchIds: string[];
  impactLevel: ImpactLevel;
  summaryVi: string | null;
  triggeredRecompute: boolean;
};

type TeamAlias = {
  teamId: string;
  name: string;
  aliases: string[];
};

const HIGH_IMPACT_RE =
  /\b(injur(?:y|ed|ies)|ruled out|will miss|suspended|suspension|red card|absent|doubtful|hamstring|acl|torn|out of (?:the )?squad|fitness concern|muscle strain|knock|setback)\b/i;

const MEDIUM_IMPACT_RE =
  /\b(lineup|starting xi|squad list|team sheet|formation|tactical|selection|call[- ]?up|captain|coach|manager|press conference|pre[- ]?match)\b/i;

const WC2026_EXTRA_ALIASES: Record<string, string[]> = {
  'South Africa': ['Bafana Bafana', 'RSA'],
  'Korea Republic': ['South Korea', 'Korea'],
  Czechia: ['Czech Republic'],
  'United States': ['USA', 'USMNT', 'Americans'],
  Mexico: ['El Tri', 'MEX'],
  Canada: ['CAN'],
};

export function buildTeamAliasIndex(teams: TeamRow[]): TeamAlias[] {
  return teams.map((t) => {
    const aliases = new Set<string>([t.name]);
    if (t.short_name) aliases.add(t.short_name);
    for (const extra of WC2026_EXTRA_ALIASES[t.name] ?? []) aliases.add(extra);
    return { teamId: t.id, name: t.name, aliases: [...aliases] };
  });
}

export function findTeamIdsInText(text: string, index: TeamAlias[]): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const entry of index) {
    for (const alias of entry.aliases) {
      const needle = alias.toLowerCase();
      if (needle.length < 3) continue;
      const re = new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'i');
      if (re.test(lower) || lower.includes(needle)) {
        found.add(entry.teamId);
        break;
      }
    }
  }
  return [...found];
}

export function classifyNewsImpact(text: string, entities: ExtractedEntities | null): ImpactLevel {
  const combined = [
    text,
    ...(entities?.injuries ?? []),
    ...(entities?.tacticalNotes ?? []),
    ...(entities?.players ?? []),
  ].join(' ');

  if (HIGH_IMPACT_RE.test(combined)) return 'high';
  if ((entities?.injuries?.length ?? 0) > 0) return 'high';
  if (MEDIUM_IMPACT_RE.test(combined)) return 'medium';
  if ((entities?.formations?.length ?? 0) > 0 || (entities?.tacticalNotes?.length ?? 0) > 0) {
    return 'medium';
  }
  if ((entities?.teams?.length ?? 0) >= 2) return 'low';
  return 'none';
}

export function buildImpactSummaryVi(
  teamNames: string[],
  matchIds: string[],
  impactLevel: ImpactLevel,
  entities: ExtractedEntities | null,
): string | null {
  if (impactLevel === 'none' || matchIds.length === 0) return null;

  const teams = teamNames.length ? teamNames.join(', ') : 'đội liên quan';
  const injuryPart =
    entities?.injuries?.length && entities.injuries.length > 0
      ? ` Chấn thương / vắng mặt: ${entities.injuries.slice(0, 3).join(', ')}.`
      : '';

  const levelLabel =
    impactLevel === 'high'
      ? 'cao'
      : impactLevel === 'medium'
        ? 'trung bình'
        : 'thấp';

  return `Tin tức liên quan ${teams} có thể ảnh hưởng mức ${levelLabel} tới ${matchIds.length} trận World Cup 2026.${injuryPart} Hệ thống đã cập nhật lại dự đoán cho các trận này.`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findWc2026MatchesForTeams(env: AppEnv, teamIds: string[]): Promise<string[]> {
  if (teamIds.length === 0) return [];

  const expanded = new Set<string>();
  for (const tid of teamIds) {
    expanded.add(tid);
    const row = await env.DB.prepare(`SELECT country_code FROM teams WHERE id = ?`)
      .bind(tid)
      .first<{ country_code: string | null }>();
    if (row?.country_code) {
      const { results } = await env.DB.prepare(`SELECT id FROM teams WHERE country_code = ?`)
        .bind(row.country_code)
        .all<{ id: string }>();
      for (const r of results ?? []) expanded.add(r.id);
    }
  }

  const ids = [...expanded];
  const placeholders = ids.map(() => '?').join(',');

  const { results: pairMatches } = await env.DB.prepare(
    `SELECT id FROM matches
     WHERE tournament_id = ?
       AND status IN ('scheduled', 'not_started', 'live')
       AND home_team_id IN (${placeholders})
       AND away_team_id IN (${placeholders})
     ORDER BY kickoff_utc ASC
     LIMIT 3`,
  )
    .bind(WC2026_TOURNAMENT_ID, ...ids, ...ids)
    .all<{ id: string }>();

  if ((pairMatches?.length ?? 0) > 0) {
    return (pairMatches ?? []).map((r) => r.id);
  }

  const { results } = await env.DB.prepare(
    `SELECT id FROM matches
     WHERE tournament_id = ?
       AND status IN ('scheduled', 'not_started', 'live')
       AND (home_team_id IN (${placeholders}) OR away_team_id IN (${placeholders}))
     ORDER BY kickoff_utc ASC
     LIMIT 5`,
  )
    .bind(WC2026_TOURNAMENT_ID, ...ids, ...ids)
    .all<{ id: string }>();

  return (results ?? []).map((r) => r.id);
}

export async function processNewsDocumentImpact(
  env: AppEnv,
  documentId: string,
  content: string,
  entities: ExtractedEntities | null,
): Promise<NewsImpactResult> {
  const wcTeams = await getTeamsByTournament(env.DB, WC2026_TOURNAMENT_ID);
  const aliasIndex = buildTeamAliasIndex(wcTeams);

  const teamIdsFromText = findTeamIdsInText(content, aliasIndex);
  const entityTeamIds = (entities?.teams ?? [])
    .map((name) => {
      const hit = aliasIndex.find(
        (a) =>
          a.name.toLowerCase() === name.toLowerCase() ||
          a.aliases.some((al) => al.toLowerCase() === name.toLowerCase()),
      );
      return hit?.teamId ?? null;
    })
    .filter((x): x is string => x != null);

  const teamIds = [...new Set([...teamIdsFromText, ...entityTeamIds])];
  const matchIds = await findWc2026MatchesForTeams(env, teamIds);
  const impactLevel = classifyNewsImpact(content, entities);

  const teamNames = teamIds
    .map((id) => aliasIndex.find((a) => a.teamId === id)?.name)
    .filter((x): x is string => Boolean(x));

  const summaryVi = buildImpactSummaryVi(teamNames, matchIds, impactLevel, entities);

  let triggeredRecompute = false;
  const shouldRecompute =
    matchIds.length > 0 && (impactLevel === 'high' || impactLevel === 'medium');

  if (shouldRecompute) {
    for (const matchId of matchIds) {
      try {
        await recomputeMatchProbability(env, matchId);
        triggeredRecompute = true;
        if (env.MODEL_QUEUE) {
          await env.MODEL_QUEUE.send({ type: 'ai_multi_analyze', matchId });
          await env.MODEL_QUEUE.send({ type: 'ai_briefing', matchId });
        }
      } catch (e) {
        logError('news impact recompute failed', { matchId, error: String(e) });
      }
    }
    logInfo('news impact applied', {
      documentId,
      match_ids: matchIds.join(','),
      impactLevel,
      recompute: triggeredRecompute,
    });
  }

  await env.DB.prepare(
    `UPDATE source_documents
     SET affected_match_ids_json = ?, impact_level = ?, impact_summary_vi = ?
     WHERE id = ?`,
  )
    .bind(
      matchIds.length ? JSON.stringify(matchIds) : null,
      impactLevel,
      summaryVi,
      documentId,
    )
    .run();

  return { matchIds, impactLevel, summaryVi, triggeredRecompute };
}
