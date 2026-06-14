import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { scheduleRecomputeAfterDataChange } from './bulkRecomputeRunner';
import * as matchesRepo from '../db/repositories/matchesRepo';
import {
  matchToOutcome,
  resolveLoserTeamId,
  resolveWinnerTeamId,
} from './matchLifecycle';
import { logInfo } from '../utils/logger';
import { nowIso } from '../utils/time';
import { refreshTeamRatingsFromForm } from './teamRatingRefresh';
import { scheduleChampionOddsRefresh } from './tournamentChampionOdds';

const GROUP_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

/** Eight slots on R32 matches 13–16 for best third-place qualifiers. */
export const BEST_THIRD_R32_SLOTS: { matchId: string; slot: 'home' | 'away' }[] = [
  { matchId: 'm-w26-r32-13', slot: 'home' },
  { matchId: 'm-w26-r32-13', slot: 'away' },
  { matchId: 'm-w26-r32-14', slot: 'home' },
  { matchId: 'm-w26-r32-14', slot: 'away' },
  { matchId: 'm-w26-r32-15', slot: 'home' },
  { matchId: 'm-w26-r32-15', slot: 'away' },
  { matchId: 'm-w26-r32-16', slot: 'home' },
  { matchId: 'm-w26-r32-16', slot: 'away' },
];

function compareStandings(a: GroupStanding, b: GroupStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.teamId.localeCompare(b.teamId);
}

export async function areAllGroupsComplete(db: D1Database): Promise<boolean> {
  for (const code of GROUP_CODES) {
    if (!(await isGroupComplete(db, code))) return false;
  }
  return true;
}

export async function collectThirdPlaceCandidates(db: D1Database): Promise<(GroupStanding & { group: string })[]> {
  const out: (GroupStanding & { group: string })[] = [];
  for (const code of GROUP_CODES) {
    const standings = await computeGroupStandings(db, code);
    if (standings[2]) out.push({ ...standings[2], group: code });
  }
  return out.sort(compareStandings);
}

export async function applyBestThirdQualifiers(env: AppEnv): Promise<string[]> {
  if (!(await areAllGroupsComplete(env.DB))) return [];

  const candidates = await collectThirdPlaceCandidates(env.DB);
  const top8 = candidates.slice(0, 8);
  const affected = new Set<string>();

  for (let i = 0; i < top8.length && i < BEST_THIRD_R32_SLOTS.length; i++) {
    const { matchId, slot } = BEST_THIRD_R32_SLOTS[i];
    const changed = await assignTeamToSlot(env, matchId, slot, top8[i].teamId);
    if (changed) affected.add(matchId);
  }

  if (affected.size) {
    logInfo('best third-place qualifiers applied', { teams: top8.length, matches: affected.size });
  }
  return [...affected];
}

type BracketLinkRow = {
  id: string;
  source_match_id: string | null;
  target_match_id: string;
  target_slot: 'home' | 'away';
  rule_type: 'winner' | 'loser' | 'group_rank';
  rule_json: string | null;
};

type GroupRankRule = { group: string; rank: number };

export type GroupStanding = {
  teamId: string;
  played: number;
  points: number;
  gf: number;
  ga: number;
  gd: number;
};

export type GroupStageMatchRow = {
  group_code: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: string;
};

const SCORED_STATUSES = new Set(['completed', 'finished', 'live']);

/** Pure standings from pre-fetched group-stage rows (no D1 round-trips). */
export function computeGroupStandingsFromMatchRows(
  rows: GroupStageMatchRow[],
  groupCode: string,
): GroupStanding[] {
  const groupRows = rows.filter((r) => r.group_code === groupCode);
  const stats = new Map<string, GroupStanding>();

  const ensure = (teamId: string): GroupStanding => {
    let row = stats.get(teamId);
    if (!row) {
      row = { teamId, played: 0, points: 0, gf: 0, ga: 0, gd: 0 };
      stats.set(teamId, row);
    }
    return row;
  };

  for (const m of groupRows) {
    ensure(m.home_team_id);
    ensure(m.away_team_id);
  }

  for (const m of groupRows) {
    if (!SCORED_STATUSES.has(m.status)) continue;
    const home = ensure(m.home_team_id);
    const away = ensure(m.away_team_id);
    home.played += 1;
    away.played += 1;
    home.gf += m.home_score;
    home.ga += m.away_score;
    away.gf += m.away_score;
    away.ga += m.home_score;

    if (m.home_score > m.away_score) {
      home.points += 3;
    } else if (m.away_score > m.home_score) {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  for (const row of stats.values()) {
    row.gd = row.gf - row.ga;
  }

  return [...stats.values()].sort(compareStandings);
}

export async function computeGroupStandings(
  db: D1Database,
  groupCode: string,
): Promise<GroupStanding[]> {
  const { results } = await db
    .prepare(
      `SELECT group_code, home_team_id, away_team_id, home_score, away_score, status
       FROM matches
       WHERE tournament_id = ? AND stage = 'Group' AND group_code = ?`,
    )
    .bind(WC2026_TOURNAMENT_ID, groupCode)
    .all<GroupStageMatchRow>();

  return computeGroupStandingsFromMatchRows(results ?? [], groupCode);
}

async function isGroupComplete(db: D1Database, groupCode: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status IN ('completed', 'finished') THEN 1 ELSE 0 END) AS done
       FROM matches
       WHERE tournament_id = ? AND stage = 'Group' AND group_code = ?`,
    )
    .bind(WC2026_TOURNAMENT_ID, groupCode)
    .first<{ total: number; done: number }>();
  return !!row && row.total > 0 && row.total === row.done;
}

async function assignTeamToSlot(
  env: AppEnv,
  targetMatchId: string,
  slot: 'home' | 'away',
  teamId: string,
): Promise<boolean> {
  const column = slot === 'home' ? 'home_team_id' : 'away_team_id';
  const current = await env.DB.prepare(`SELECT ${column} AS team_id FROM matches WHERE id = ?`)
    .bind(targetMatchId)
    .first<{ team_id: string }>();
  if (!current || current.team_id === teamId) return false;

  await env.DB.prepare(
    `UPDATE matches SET ${column} = ?, updated_at = ? WHERE id = ? AND tournament_id = ?`,
  )
    .bind(teamId, nowIso(), targetMatchId, WC2026_TOURNAMENT_ID)
    .run();
  return true;
}

async function applyGroupQualifiers(env: AppEnv, groupCode: string): Promise<string[]> {
  const complete = await isGroupComplete(env.DB, groupCode);
  if (!complete) return [];

  const standings = await computeGroupStandings(env.DB, groupCode);
  const { results: links } = await env.DB.prepare(
    `SELECT id, source_match_id, target_match_id, target_slot, rule_type, rule_json
     FROM match_bracket_links
     WHERE tournament_id = ? AND rule_type = 'group_rank'`,
  )
    .bind(WC2026_TOURNAMENT_ID)
    .all<BracketLinkRow>();

  const affected = new Set<string>();
  for (const link of links ?? []) {
    if (!link.rule_json) continue;
    const rule = JSON.parse(link.rule_json) as GroupRankRule;
    if (rule.group !== groupCode) continue;
    const team = standings[rule.rank - 1];
    if (!team) continue;
    const changed = await assignTeamToSlot(env, link.target_match_id, link.target_slot, team.teamId);
    if (changed) affected.add(link.target_match_id);
  }

  if (affected.size) {
    logInfo('group qualifiers applied', { group: groupCode, slots: affected.size });
  }
  return [...affected];
}

async function applyKnockoutLinks(env: AppEnv, sourceMatchId: string): Promise<string[]> {
  const match = await matchesRepo.getMatch(env.DB, sourceMatchId);
  if (!match || match.status !== 'completed') return [];

  const outcome = matchToOutcome(match);
  const winnerId = resolveWinnerTeamId(outcome);
  const loserId = resolveLoserTeamId(outcome);

  const { results: links } = await env.DB.prepare(
    `SELECT id, source_match_id, target_match_id, target_slot, rule_type, rule_json
     FROM match_bracket_links
     WHERE tournament_id = ? AND source_match_id = ?`,
  )
    .bind(WC2026_TOURNAMENT_ID, sourceMatchId)
    .all<BracketLinkRow>();

  const affected = new Set<string>();
  for (const link of links ?? []) {
    const teamId =
      link.rule_type === 'winner' ? winnerId : link.rule_type === 'loser' ? loserId : null;
    if (!teamId) continue;
    const changed = await assignTeamToSlot(env, link.target_match_id, link.target_slot, teamId);
    if (changed) affected.add(link.target_match_id);
  }

  if (affected.size) {
    logInfo('knockout bracket advanced', { source: sourceMatchId, targets: affected.size });
  }
  return [...affected];
}

/** After a match is marked completed: advance bracket + schedule full probability recompute. */
export async function processMatchCompletion(env: AppEnv, matchId: string): Promise<string[]> {
  const match = await matchesRepo.getMatch(env.DB, matchId);
  if (!match || match.status !== 'completed') return [];

  const affected = new Set<string>();

  if (match.stage === 'Group' && match.group_code) {
    const groupTargets = await applyGroupQualifiers(env, match.group_code);
    groupTargets.forEach((id) => affected.add(id));
    const thirdTargets = await applyBestThirdQualifiers(env);
    thirdTargets.forEach((id) => affected.add(id));
  } else if (match.stage && match.stage !== 'Group') {
    const koTargets = await applyKnockoutLinks(env, matchId);
    koTargets.forEach((id) => affected.add(id));
  }

  await refreshTeamRatingsFromForm(env);
  await scheduleRecomputeAfterDataChange(env, `match-complete:${matchId}`, { queue: true });
  await scheduleChampionOddsRefresh(env, `match-complete:${matchId}`);
  logInfo('match completion processed', {
    match_id: matchId,
    bracket_updates: affected.size,
  });
  return [...affected];
}
