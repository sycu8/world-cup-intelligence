import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import { recomputeMatchProbability } from './recomputeMatch';
import { logInfo } from '../utils/logger';

export type UpcomingMatchProbability = {
  matchId: string;
  kickoffUtc: string;
  homeName: string;
  awayName: string;
  status: string;
  hasProbability: boolean;
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  modelVersion?: string;
  snapshotAt?: string;
};

export type UpcomingProbabilityVerification = {
  verifiedAt: string;
  upcomingTotal: number;
  withProbability: number;
  missing: number;
  refreshed: number;
  matches: UpcomingMatchProbability[];
};

type UpcomingRow = {
  id: string;
  kickoff_utc: string;
  status: string;
  home_name: string;
  away_name: string;
};

const INLINE_REFRESH_BUDGET_MS = 4_000;
const VERIFY_KV_KEY = 'upcoming-prob-verify';

async function loadUpcomingMatches(db: D1Database): Promise<UpcomingRow[]> {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.kickoff_utc, m.status, ht.name AS home_name, at.name AS away_name
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE m.tournament_id = ?
         AND m.status = 'scheduled'
         AND m.kickoff_utc >= datetime('now')
       ORDER BY m.kickoff_utc ASC`,
    )
    .bind(WC2026_TOURNAMENT_ID)
    .all<UpcomingRow>();
  return results ?? [];
}

async function toUpcomingMatch(db: D1Database, row: UpcomingRow): Promise<UpcomingMatchProbability> {
  const snap = await probabilityRepo.getLatestSnapshot(db, row.id);
  return {
    matchId: row.id,
    kickoffUtc: row.kickoff_utc,
    homeName: row.home_name,
    awayName: row.away_name,
    status: row.status,
    hasProbability: !!snap,
    homeWin: snap?.home_win_prob,
    draw: snap?.draw_prob,
    awayWin: snap?.away_win_prob,
    modelVersion: snap?.model_version,
    snapshotAt: snap?.created_at ?? undefined,
  };
}

export async function buildUpcomingProbabilityVerification(
  env: AppEnv,
): Promise<UpcomingProbabilityVerification> {
  const rows = await loadUpcomingMatches(env.DB);
  const matches: UpcomingMatchProbability[] = [];
  for (const row of rows) {
    matches.push(await toUpcomingMatch(env.DB, row));
  }

  const withProbability = matches.filter((m) => m.hasProbability).length;
  return {
    verifiedAt: new Date().toISOString(),
    upcomingTotal: matches.length,
    withProbability,
    missing: matches.length - withProbability,
    refreshed: 0,
    matches: matches.slice(0, 20),
  };
}

/** Recompute scheduled upcoming matches missing a snapshot (inline budget) or all when forced. */
export async function refreshUpcomingProbabilities(
  env: AppEnv,
  options?: { forceAll?: boolean; matchIds?: string[] },
): Promise<{ refreshed: number; attempted: number }> {
  const running = await env.KV.get(VERIFY_KV_KEY);
  if (running) return { refreshed: 0, attempted: 0 };

  await env.KV.put(VERIFY_KV_KEY, 'running', { expirationTtl: 600 });

  const rows = await loadUpcomingMatches(env.DB);
  let targetIds = options?.matchIds;
  if (!targetIds) {
    targetIds = [];
    for (const row of rows) {
      if (options?.forceAll) {
        targetIds.push(row.id);
        continue;
      }
      const snap = await probabilityRepo.getLatestSnapshot(env.DB, row.id);
      if (!snap) targetIds.push(row.id);
    }
  }

  let refreshed = 0;
  let attempted = 0;
  const started = Date.now();

  for (const matchId of targetIds) {
    if (Date.now() - started > INLINE_REFRESH_BUDGET_MS && !options?.forceAll) break;

    attempted += 1;
    try {
      const result = await recomputeMatchProbability(env, matchId);
      if (result) refreshed += 1;
    } catch {
      // continue
    }
  }

  await env.KV.delete(VERIFY_KV_KEY);
  logInfo('upcoming probability verification refresh', { attempted, refreshed, forceAll: !!options?.forceAll });
  return { refreshed, attempted };
}

export async function refreshAllUpcomingProbabilities(env: AppEnv): Promise<{ refreshed: number; attempted: number }> {
  const rows = await loadUpcomingMatches(env.DB);
  let refreshed = 0;
  let attempted = 0;

  for (const row of rows) {
    attempted += 1;
    try {
      const result = await recomputeMatchProbability(env, row.id);
      if (result) refreshed += 1;
    } catch {
      // continue
    }
  }

  logInfo('upcoming probability full refresh', { attempted, refreshed });
  return { refreshed, attempted };
}
