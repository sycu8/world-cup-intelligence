import type { AppEnv } from '../../env';
import { resolveMatchRef } from '../matchRef';
import { getMatchStats } from '../matchStats';
import { getMatchRecap } from '../matchRecap';
import * as eventsRepo from '../../db/repositories/eventsRepo';

export type MatchSnapshotPayload = {
  matchId: string;
  slug: string;
  status: string;
  minute: number | null;
  homeScore: number;
  awayScore: number;
  kickoffUtc: string | null;
  fifaMatchId: string | null;
  updatedAt: string | null;
  homeName: string;
  awayName: string;
  stats: Awaited<ReturnType<typeof getMatchStats>> | null;
  recap: {
    summaryEn: string;
    commentaryCount: number;
    playerStatsCount: number;
    updatedAt: string | null;
  } | null;
  eventsCount: number;
};

export type GetMatchSnapshotOptions = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

export async function getMatchSnapshot(
  env: AppEnv,
  ref: string,
  opts?: GetMatchSnapshotOptions,
): Promise<MatchSnapshotPayload | null> {
  const resolved = await resolveMatchRef(env.DB, ref);
  if (!resolved) return null;

  const matchId = resolved.id;
  const waitUntil = opts?.waitUntil;

  const [stats, recap, events] = await Promise.all([
    getMatchStats(env, ref, { waitUntil }).catch(() => null),
    getMatchRecap(env, ref, { waitUntil }).catch(() => null),
    eventsRepo.getMatchEvents(env.DB, matchId).catch(() => []),
  ]);

  return {
    matchId,
    slug: resolved.slug,
    status: resolved.status,
    minute: resolved.minute ?? null,
    homeScore: resolved.home_score,
    awayScore: resolved.away_score,
    kickoffUtc: resolved.kickoff_utc ?? null,
    fifaMatchId: resolved.fifa_match_id ?? null,
    updatedAt: resolved.updated_at ?? null,
    homeName: resolved.home_name,
    awayName: resolved.away_name,
    stats,
    recap: recap
      ? {
          summaryEn: recap.summaryEn,
          commentaryCount: recap.commentary.length,
          playerStatsCount: recap.playerStats.length,
          updatedAt: recap.updatedAt,
        }
      : null,
    eventsCount: events?.length ?? 0,
  };
}
