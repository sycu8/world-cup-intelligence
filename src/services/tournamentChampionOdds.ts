import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { getDb } from '../db/client';
import { getTeamsByTournament } from '../db/repositories/teamsRepo';
import { applyEffectiveTeamProfile } from './teamProfile';
import { loadRecentH2HTriples } from './tournamentMcSignals';
import { loadTeamStrengthProfiles } from './tournamentTeamStrength';
import {
  hasConfirmedKnockoutPairing,
  runTournamentMonteCarlo,
  type McBracketLink,
  type McGroupMatch,
  type McKnockoutMatch,
  type TournamentMonteCarloInput,
} from '../models/tournament/tournamentMonteCarlo';
import { resolveWinnerTeamId } from './matchLifecycle';

const CACHE_KEY = 'meta:mc_champion_odds:v1';
const CACHE_TTL_SECONDS = 60 * 60;
const FINAL_SCHEDULED_CACHE_TTL_SECONDS = 5 * 60;
const FINAL_LIVE_CACHE_TTL_SECONDS = 60;
const DEFAULT_SIMULATIONS = 4_000;
const CHAMPION_REFRESH_KV_KEY = 'meta:champion_odds_refresh_pending';

export type ChampionOddsPhase = 'group' | 'knockout' | 'final' | 'final_live' | 'decided';

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
  phase: ChampionOddsPhase;
  finalMatchId?: string;
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
  minute: number | null;
};

const MODEL_VERSION = 'mc-strength-v4';

function isFinishedStatus(status: string | undefined): boolean {
  return status === 'completed' || status === 'finished';
}

function isLiveStatus(status: string | undefined): boolean {
  return status === 'live' || status === 'in_progress';
}

function findFinalMatch(matches: McKnockoutMatch[]): McKnockoutMatch | undefined {
  return matches.find((m) => m.id === 'm-w26-final-01') ?? matches.find((m) => m.stage === 'Final');
}

function detectChampionOddsPhase(
  groupMatches: McGroupMatch[],
  knockoutMatches: McKnockoutMatch[],
): { phase: ChampionOddsPhase; finalMatchId?: string } {
  const final = findFinalMatch(knockoutMatches);
  if (final) {
    if (isFinishedStatus(final.status)) return { phase: 'decided', finalMatchId: final.id };
    if (isLiveStatus(final.status) && hasConfirmedKnockoutPairing(final)) {
      return { phase: 'final_live', finalMatchId: final.id };
    }
    if (hasConfirmedKnockoutPairing(final)) return { phase: 'final', finalMatchId: final.id };
  }

  const groupOpen = groupMatches.some((m) => !isFinishedStatus(m.status));
  if (groupOpen) return { phase: 'group' };
  return { phase: 'knockout' };
}

function resolveCacheTtlSeconds(knockoutMatches: McKnockoutMatch[]): number {
  const final = findFinalMatch(knockoutMatches);
  if (!final || !hasConfirmedKnockoutPairing(final)) return CACHE_TTL_SECONDS;
  if (isLiveStatus(final.status)) return FINAL_LIVE_CACHE_TTL_SECONDS;
  if (!isFinishedStatus(final.status)) return FINAL_SCHEDULED_CACHE_TTL_SECONDS;
  return CACHE_TTL_SECONDS;
}

function resolveCacheTtlForPayload(payload: ChampionOddsPayload): number {
  switch (payload.phase) {
    case 'final_live':
      return FINAL_LIVE_CACHE_TTL_SECONDS;
    case 'final':
      return FINAL_SCHEDULED_CACHE_TTL_SECONDS;
    default:
      return CACHE_TTL_SECONDS;
  }
}

async function loadMonteCarloInput(
  env: AppEnv,
  simulations: number,
): Promise<{
  input: TournamentMonteCarloInput;
  teamMeta: Map<string, { name: string; countryCode: string | null }>;
  knockoutMatches: McKnockoutMatch[];
}> {
  const db = getDb(env);

  const [teams, matchesRes, linksRes] = await Promise.all([
    getTeamsByTournament(db, WC2026_TOURNAMENT_ID),
    db
      .prepare(
        `SELECT id, stage, group_code, home_team_id, away_team_id, home_score, away_score, status, minute
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

  const ratedTeams = teams.map((row) => applyEffectiveTeamProfile(row));
  const [teamStrength, h2hTriples] = await Promise.all([
    loadTeamStrengthProfiles(env, ratedTeams),
    loadRecentH2HTriples(db),
  ]);

  const teamMeta = new Map<string, { name: string; countryCode: string | null }>();
  for (const team of ratedTeams) {
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
    knockoutMatches.push({
      id: match.id,
      stage: match.stage,
      homeTeamId: match.home_team_id,
      awayTeamId: match.away_team_id,
      homeScore: match.home_score ?? 0,
      awayScore: match.away_score ?? 0,
      status: match.status,
      minute: match.minute ?? 0,
    });
  }

  return {
    input: {
      groupMatches,
      knockoutMatches,
      teamStrength,
      h2hTriples,
      groupRankLinks,
      winnerLinks,
      simulations,
    },
    teamMeta,
    knockoutMatches,
  };
}

function toPayload(
  result: ReturnType<typeof runTournamentMonteCarlo>,
  teamMeta: Map<string, { name: string; countryCode: string | null }>,
  phase: ChampionOddsPhase,
  finalMatchId?: string,
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
    phase,
    finalMatchId,
    top: all.slice(0, 3),
    all,
  };
}

function toDecidedPayload(
  winnerId: string,
  teamMeta: Map<string, { name: string; countryCode: string | null }>,
  finalMatchId: string,
): ChampionOddsPayload {
  const meta = teamMeta.get(winnerId);
  const entry: ChampionOddsEntry = {
    teamId: winnerId,
    teamName: meta?.name ?? winnerId,
    countryCode: meta?.countryCode ?? null,
    probability: 1,
    rank: 1,
  };
  return {
    generatedAt: new Date().toISOString(),
    simulations: 1,
    modelVersion: MODEL_VERSION,
    phase: 'decided',
    finalMatchId,
    top: [entry],
    all: [entry],
  };
}

function computeChampionOddsFromLoaded(
  input: TournamentMonteCarloInput,
  teamMeta: Map<string, { name: string; countryCode: string | null }>,
  knockoutMatches: McKnockoutMatch[],
): ChampionOddsPayload {
  const { phase, finalMatchId } = detectChampionOddsPhase(input.groupMatches, knockoutMatches);

  const final = findFinalMatch(knockoutMatches);
  if (final && isFinishedStatus(final.status) && hasConfirmedKnockoutPairing(final)) {
    const winnerId = resolveWinnerTeamId({
      home_team_id: final.homeTeamId!,
      away_team_id: final.awayTeamId!,
      home_score: final.homeScore ?? 0,
      away_score: final.awayScore ?? 0,
      stage: final.stage,
    });
    if (winnerId) return toDecidedPayload(winnerId, teamMeta, final.id);
  }

  const result = runTournamentMonteCarlo(input);
  return toPayload(result, teamMeta, phase, finalMatchId);
}

export async function computeChampionOdds(
  env: AppEnv,
  options?: { simulations?: number },
): Promise<ChampionOddsPayload> {
  const simulations = options?.simulations ?? DEFAULT_SIMULATIONS;
  const loaded = await loadMonteCarloInput(env, simulations);
  return computeChampionOddsFromLoaded(loaded.input, loaded.teamMeta, loaded.knockoutMatches);
}

export async function refreshChampionOdds(env: AppEnv): Promise<ChampionOddsPayload> {
  const loaded = await loadMonteCarloInput(env, DEFAULT_SIMULATIONS);
  const payload = computeChampionOddsFromLoaded(loaded.input, loaded.teamMeta, loaded.knockoutMatches);
  const ttl = resolveCacheTtlSeconds(loaded.knockoutMatches);
  await env.KV.put(CACHE_KEY, JSON.stringify(payload), { expirationTtl: ttl });
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

function isCacheStale(payload: ChampionOddsPayload, cacheTtlSeconds: number): boolean {
  if (payload.modelVersion !== MODEL_VERSION) return true;
  if (!payload.top.length || !payload.all.length) return true;
  const ageMs = Date.now() - new Date(payload.generatedAt).getTime();
  return ageMs > cacheTtlSeconds * 1000;
}

export async function getChampionOddsForDisplay(env: AppEnv): Promise<ChampionOddsPayload | null> {
  const cached = await readCachedChampionOdds(env);
  if (cached && !isCacheStale(cached, resolveCacheTtlForPayload(cached))) return cached;

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
  ctx: { waitUntil: (promise: Promise<unknown>) => void },
): Promise<ChampionOddsPayload | null> {
  void ctx;
  return getChampionOddsForDisplay(env);
}
