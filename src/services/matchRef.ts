import type { MatchRow } from '../db/schema';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { buildMatchSlug, isLegacyMatchId } from '../utils/matchSlug';

export type MatchWithSlug = MatchRow & {
  home_name: string;
  away_name: string;
  home_short: string | null;
  away_short: string | null;
  slug: string;
};

const MATCH_JOIN_SQL = `SELECT m.*,
       ht.name AS home_name, ht.short_name AS home_short,
       at.name AS away_name, at.short_name AS away_short
FROM matches m
JOIN teams ht ON ht.id = m.home_team_id
JOIN teams at ON at.id = m.away_team_id
WHERE m.tournament_id = ?`;

function withSlug(row: Omit<MatchWithSlug, 'slug'> & { slug?: string }): MatchWithSlug {
  const slug =
    row.slug ??
    buildMatchSlug({
      stage: row.stage,
      groupCode: row.group_code,
      homeName: row.home_name,
      awayName: row.away_name,
    });
  return { ...row, slug };
}

export async function resolveMatchRef(db: D1Database, ref: string): Promise<MatchWithSlug | null> {
  if (isLegacyMatchId(ref)) {
    const row = await db
      .prepare(`${MATCH_JOIN_SQL} AND m.id = ?`)
      .bind(WC2026_TOURNAMENT_ID, ref)
      .first<Omit<MatchWithSlug, 'slug'>>();
    return row ? withSlug(row) : null;
  }

  const { results } = await db.prepare(`${MATCH_JOIN_SQL} ORDER BY m.kickoff_utc ASC`).bind(WC2026_TOURNAMENT_ID).all<Omit<MatchWithSlug, 'slug'>>();

  for (const row of results ?? []) {
    const slug = buildMatchSlug({
      stage: row.stage,
      groupCode: row.group_code,
      homeName: row.home_name,
      awayName: row.away_name,
    });
    if (slug === ref) return withSlug({ ...row, slug });
  }

  return null;
}

export async function listMatchesWithSlug(db: D1Database): Promise<MatchWithSlug[]> {
  const { results } = await db
    .prepare(`${MATCH_JOIN_SQL} ORDER BY m.kickoff_utc ASC`)
    .bind(WC2026_TOURNAMENT_ID)
    .all<Omit<MatchWithSlug, 'slug'>>();
  return (results ?? []).map((row) => withSlug(row));
}

export function attachSlugToScheduleRow<T extends Record<string, unknown>>(row: T): T & { slug: string } {
  const homeName = String(row.home_name ?? '');
  const awayName = String(row.away_name ?? '');
  return {
    ...row,
    slug: buildMatchSlug({
      stage: row.stage as string | null,
      groupCode: row.group_code as string | null,
      homeName,
      awayName,
    }),
  };
}
