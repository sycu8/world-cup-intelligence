import type { D1Database } from '@cloudflare/workers-types';

export type TeamFormSnapshot = {
  matchesPlayed: number;
  pointsPerGame: number;
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  xgForPerGame: number;
  xgAgainstPerGame: number;
  recentForm: number;
  sourceConfidence: number;
};

type MatchRow = {
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  home_xg: number;
  away_xg: number;
};

const FORM_BLEND = 0.65;

export async function getTeamFormSnapshot(
  db: D1Database,
  teamId: string,
  limit = 6,
): Promise<TeamFormSnapshot | null> {
  const { results } = await db
    .prepare(
      `SELECT home_team_id, away_team_id, home_score, away_score, home_xg, away_xg
       FROM matches
       WHERE status = 'completed' AND (home_team_id = ? OR away_team_id = ?)
       ORDER BY kickoff_utc DESC
       LIMIT ?`,
    )
    .bind(teamId, teamId, limit)
    .all<MatchRow>();

  if (!results?.length) return null;

  let points = 0;
  let gf = 0;
  let ga = 0;
  let xgf = 0;
  let xga = 0;

  for (const m of results) {
    const isHome = m.home_team_id === teamId;
    const scored = isHome ? m.home_score : m.away_score;
    const conceded = isHome ? m.away_score : m.home_score;
    const xgScored = isHome ? (m.home_xg ?? scored * 0.85) : (m.away_xg ?? scored * 0.85);
    const xgConceded = isHome ? (m.away_xg ?? conceded * 0.85) : (m.home_xg ?? conceded * 0.85);

    gf += scored;
    ga += conceded;
    xgf += xgScored;
    xga += xgConceded;

    if (scored > conceded) points += 3;
    else if (scored === conceded) points += 1;
  }

  const n = results.length;
  const ppg = points / n;
  const recentForm = Math.max(0, Math.min(1, (ppg / 3) * 0.7 + (gf - ga) / (n * 4) * 0.3 + 0.15));

  return {
    matchesPlayed: n,
    pointsPerGame: ppg,
    goalsForPerGame: gf / n,
    goalsAgainstPerGame: ga / n,
    xgForPerGame: xgf / n,
    xgAgainstPerGame: xga / n,
    recentForm,
    sourceConfidence: Math.min(0.95, 0.72 + n * 0.04),
  };
}

export function blendFormWithBase(
  base: number,
  form: number | undefined,
  weight = FORM_BLEND,
): number {
  if (form === undefined) return base;
  return base * (1 - weight) + form * weight;
}
