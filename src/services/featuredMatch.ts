import type { AppEnv } from '../env';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { buildMatchSlug } from '../utils/matchSlug';

type MatchRow = Record<string, unknown> & {
  id: string;
  kickoff_utc: string;
  status: string;
};

const matchSelect = `SELECT m.*, ht.name AS home_name, ht.short_name AS home_short, ht.country_code AS home_country_code,
            at.name AS away_name, at.short_name AS away_short, at.country_code AS away_country_code
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     WHERE m.tournament_id = ?`;

export async function resolveFeaturedMatch(env: AppEnv): Promise<MatchRow | null> {
  const now = new Date().toISOString();

  const live = await env.DB.prepare(
    `${matchSelect} AND m.status = 'live' ORDER BY m.kickoff_utc ASC LIMIT 1`,
  )
    .bind(WC2026_TOURNAMENT_ID)
    .first<MatchRow>();

  if (live) return live;

  const upcoming = await env.DB.prepare(
    `${matchSelect} AND m.status = 'scheduled' AND m.kickoff_utc > ? ORDER BY m.kickoff_utc ASC LIMIT 1`,
  )
    .bind(WC2026_TOURNAMENT_ID, now)
    .first<MatchRow>();

  if (upcoming) return upcoming;

  const nextScheduled = await env.DB.prepare(
    `${matchSelect} AND m.status = 'scheduled' ORDER BY m.kickoff_utc ASC LIMIT 1`,
  )
    .bind(WC2026_TOURNAMENT_ID)
    .first<MatchRow>();

  return nextScheduled;
}

export async function getFeaturedMatchPayload(env: AppEnv) {
  const featured = await resolveFeaturedMatch(env);
  if (!featured) return null;

  const snap = await probabilityRepo.getLatestSnapshot(env.DB, featured.id);
  const probability = snap
    ? {
        homeWinProb: snap.home_win_prob,
        drawProb: snap.draw_prob,
        awayWinProb: snap.away_win_prob,
        expectedHomeGoals: snap.expected_home_goals,
        expectedAwayGoals: snap.expected_away_goals,
        mostLikelyScore: snap.most_likely_score,
        confidence: snap.confidence,
        modelVersion: snap.model_version,
      }
    : null;

  return {
    ...featured,
    slug: buildMatchSlug({
      stage: featured.stage as string | null,
      groupCode: featured.group_code as string | null,
      homeName: String(featured.home_name),
      awayName: String(featured.away_name),
    }),
    probability,
  };
}
