import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { getDb } from '../db/client';
import type { TeamRow } from '../db/schema';
import { applyEffectiveTeamProfile } from './teamProfile';
import { loadTeamStrengthProfiles } from './tournamentTeamStrength';
import {
  runTournamentMonteCarlo,
  type McBracketLink,
  type McGroupMatch,
  type McKnockoutMatch,
  type TournamentMonteCarloInput,
} from '../models/tournament/tournamentMonteCarlo';

const CACHE_KEY = 'meta:mc_champion_odds:v1';
const CACHE_TTL_SECONDS = 60 * 60;
const DEFAULT_SIMULATIONS = 8_000;
const CHAMPION_REFRESH_KV_KEY = 'meta:champion_odds_refresh_pending';

export interface ChampionOddsEntry {
  teamId: string;
  teamName: string;
  countryCode: string | null;
  probability: number;
  rank: number;
}

export interface ChampionOddsPayload {
  generatedAt: string;
  simulations: number;
  modelVersion: string;
  top: ChampionOddsEntry[];
  all: ChampionOddsEntry[];
}

type BracketLinkRow = {
  source_match_id: string | null;
  target_match_id: string;
  target_slot: 'home' | 'away';
  rule_type: 'winner' | 'loser' | 'group_rank';
  rule_json: string | null;
};

type MatchRow = {
  id: string;
  stage: string;
  group_code: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

const MODEL_VERSION = 'mc-strength-v2';

async function loadMonteCarloInput(
  env: AppEnv,
  simulations: number,
): Promise<{ input: TournamentMonteCarloInput; teamMeta: Map<string, { name: string; countryCode: string | null }> }> {
  const db = getDb(env);

  const [teamsRes, matchesRes, linksRes] = await Promise.all([
    db
      .prepare(`SELECT * FROM teams WHERE id LIKE 'team-w26-%' ORDER BY id ASC`)
      .all<TeamRow>(),
    db
      .prepare(
        `SELECT id, stage, group_code, home_team_id, away_team_id, home_score, away_score, status
         FROM matches
         WHERE tournament_id = ?`,
      )
      .bind(WC2026_TOURNAMENT_ID)
      .all<MatchRow>(),
    db
      .prepare(
        `SELECT source_match_id, target_match_id, target_slot, rule_type, rule_json
         FROM match_bracket_links
         WHERE tournament_id = ?`,
      )
      .bind(WC2026_TOURNAMENT_ID)
      .all<BracketLinkRow>(),
  ]);

  const teams = (teamsRes.results ?? []).map((row) => applyEffectiveTeamProfile(row));
  const teamStrength = await loadTeamStrengthProfiles(env, teams);

  const teamMeta = new Map<string, { name: string; countryCode: string | null }>();
  for (const team of teams) {
    teamMeta.set(team.id, { name: team.name, countryCode: team.country_code ?? null });
  }

  const groupRankLinks: McBracketLink[] = [];
  const winnerLinks: McBracketLink[] = [];
  for (const link of linksRes.results ?? []) {
    const base = {
      sourceMatchId: link.source_match_id,
      targetMatchId: link.target_match_id,
      targetSlot: link.target_slot,
    };
    if (link.rule_type === 'group_rank') {
      if (!link.rule_json) continue;
      const rule = JSON.parse(link.rule_json) as { group: string; rank: number };
      groupRankLinks.push({
        ...base,
        ruleType: 'group_rank',
        group: rule.group,
        rank: rule.rank,
      });
      continue;
    }
    winnerLinks.push({
      ...base,
      ruleType: link.rule_type,
    });
  }

  const groupMatches: McGroupMatch[] = [];
  const knockoutMatches: McKnockoutMatch[] = [];
  for (const match of matchesRes.results ?? []) {
    if (match.stage === 'Group') {
      if (!match.group_code) continue;
      groupMatches.push({
        id: match.id,
        groupCode: match.group_code,
        homeTeamId: match.home_team_id,
        awayTeamId: match.away_team_id,
        homeScore: match.home_score ?? 0,
        awayScore: match.away_score ?? 0,
        status: match.status,
      });
      continue;
    }
    knockoutMatches.push({ id: match.id, stage: match.stage });
  }

  return {
    input: {
      groupMatches,
      knockoutMatches,
      teamStrength,
      groupRankLinks,
      winnerLinks,
      simulations,
    },
    teamMeta,
  };
}

function toPayload(
  result: ReturnType<typeof runTournamentMonteCarlo>,
  teamMeta: Map<string, { name: string; countryCode: string | null }>,
): ChampionOddsPayload {
  const generatedAt = new Date().toISOString();
  const all = result.championCounts
    .map((row, index) => {
      const meta = teamMeta.get(row.teamId);
      return {
        teamId: row.teamId,
        teamName: meta?.name ?? row.teamId,
        countryCode: meta?.countryCode ?? null,
        probability: row.prob,
        rank: index + 1,
      };
    })
    .sort((a, b) => b.probability - a.probability)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    generatedAt,
    simulations: result.simulations,
    modelVersion: MODEL_VERSION,
    top: all.slice(0, 3),
    all,
  };
}

export async function computeChampionOdds(
  env: AppEnv,
  options?: { simulations?: number },
): Promise<ChampionOddsPayload> {
  const simulations = options?.simulations ?? DEFAULT_SIMULATIONS;
  const { input, teamMeta } = await loadMonteCarloInput(env, simulations);
  const result = runTournamentMonteCarlo(input);
  return toPayload(result, teamMeta);
}

export async function refreshChampionOdds(env: AppEnv): Promise<ChampionOddsPayload> {
  const payload = await computeChampionOdds(env);
  await env.KV.put(CACHE_KEY, JSON.stringify(payload), { expirationTtl: CACHE_TTL_SECONDS });
  await env.KV.delete(CHAMPION_REFRESH_KV_KEY);
  return payload;
}

export async function scheduleChampionOddsRefresh(env: AppEnv, reason: string): Promise<void> {
  await env.KV.put(CHAMPION_REFRESH_KV_KEY, reason, { expirationTtl: 3600 });
}

export async function runChampionOddsRefreshIfPending(env: AppEnv): Promise<boolean> {
  const pending = await env.KV.get(CHAMPION_REFRESH_KV_KEY);
  if (!pending) return false;
  await refreshChampionOdds(env);
  return true;
}

async function readCachedChampionOdds(env: AppEnv): Promise<ChampionOddsPayload | null> {
  const raw = await env.KV.get(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChampionOddsPayload;
  } catch {
    return null;
  }
}

function isCacheStale(payload: ChampionOddsPayload): boolean {
  if (payload.modelVersion !== MODEL_VERSION) return true;
  const ageMs = Date.now() - new Date(payload.generatedAt).getTime();
  return ageMs > CACHE_TTL_SECONDS * 1000;
}

export async function getChampionOddsForDisplay(env: AppEnv): Promise<ChampionOddsPayload | null> {
  const cached = await readCachedChampionOdds(env);
  if (cached && !isCacheStale(cached)) return cached;

  try {
    return await refreshChampionOdds(env);
  } catch (err) {
    console.error('[champion-odds] refresh failed', err);
    if (cached) return cached;
    return null;
  }
}

export async function getChampionOddsForHome(
  env: AppEnv,
  ctx: ExecutionContext,
): Promise<ChampionOddsPayload | null> {
  const cached = await readCachedChampionOdds(env);
  if (cached) {
    if (isCacheStale(cached)) {
      ctx.waitUntil(refreshChampionOdds(env).catch((err) => console.error('[champion-odds] background refresh failed', err)));
    }
    return cached;
  }

  ctx.waitUntil(refreshChampionOdds(env).catch((err) => console.error('[champion-odds] initial refresh failed', err)));
  return null;
}
