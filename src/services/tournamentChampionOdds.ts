import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { getDb } from '../db/client';
import type { TeamRow } from '../db/schema';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import { applyEffectiveTeamProfile } from './teamProfile';
import {
  runTournamentMonteCarlo,
  type MatchProbabilityTriple,
  type McBracketLink,
  type McGroupMatch,
  type McKnockoutMatch,
  type TournamentMonteCarloInput,
} from '../models/tournament/tournamentMonteCarlo';

const CACHE_KEY = 'meta:mc_champion_odds:v1';
const CACHE_TTL_SECONDS = 6 * 60 * 60;
const DEFAULT_SIMULATIONS = 12_000;

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

async function loadMonteCarloInput(
  env: AppEnv,
  simulations: number,
): Promise<{ input: TournamentMonteCarloInput; teamMeta: Map<string, { name: string; countryCode: string | null }> }> {
  const db = getDb(env);

  const [teamsRes, matchesRes, linksRes, snapshots] = await Promise.all([
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
    probabilityRepo.listLatestSnapshotsForTournament(db, WC2026_TOURNAMENT_ID),
  ]);

  const teamMeta = new Map<string, { name: string; countryCode: string | null }>();
  const teamRatings: Record<string, number> = {};
  for (const row of teamsRes.results ?? []) {
    const team = applyEffectiveTeamProfile(row);
    teamRatings[team.id] = team.elo_rating ?? 1500;
    teamMeta.set(team.id, { name: team.name, countryCode: team.country_code ?? null });
  }

  const matchProbs: Record<string, MatchProbabilityTriple> = {};
  for (const row of snapshots) {
    matchProbs[row.matchId] = {
      homeWin: row.homeWinProb,
      draw: row.drawProb,
      awayWin: row.awayWinProb,
    };
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
      matchProbs,
      teamRatings,
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
  return payload;
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
  const ageMs = Date.now() - new Date(payload.generatedAt).getTime();
  return ageMs > CACHE_TTL_SECONDS * 1000;
}

export async function getChampionOddsForDisplay(env: AppEnv): Promise<ChampionOddsPayload | null> {
  const cached = await readCachedChampionOdds(env);
  if (cached) return cached;

  try {
    return await refreshChampionOdds(env);
  } catch (err) {
    console.error('[champion-odds] refresh failed', err);
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
