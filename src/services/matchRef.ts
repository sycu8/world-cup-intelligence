import type { MatchRow } from '../db/schema';
import { getLeagueById } from '../constants/leagues';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { buildMatchSlug, isLegacyMatchId } from '../utils/matchSlug';

export type MatchWithSlug = MatchRow & {
  home_name: string;
  away_name: string;
  home_short: string | null;
  away_short: string | null;
  home_country_code: string | null;
  away_country_code: string | null;
  slug: string;
};

const MATCH_JOIN_SELECT = `SELECT m.*,
       ht.name AS home_name, ht.short_name AS home_short, ht.country_code AS home_country_code,
       at.name AS away_name, at.short_name AS away_short, at.country_code AS away_country_code
FROM matches m
JOIN teams ht ON ht.id = m.home_team_id
JOIN teams at ON at.id = m.away_team_id`;

const MATCH_JOIN_SQL = `${MATCH_JOIN_SELECT}
WHERE m.tournament_id = ?`;

const MATCH_REF_CACHE_TTL = 300;
const SLUG_INDEX_KEY = 'cache:match-slug-index';

function slugForRow(row: {
  tournament_id?: string;
  stage: string | null;
  group_code: string | null;
  home_name: string;
  away_name: string;
  slug?: string;
}): string {
  if (row.slug) return row.slug;
  return buildMatchSlug({
    stage: row.stage,
    groupCode: row.group_code,
    homeName: row.home_name,
    awayName: row.away_name,
    tournamentSlug: getLeagueById(row.tournament_id)?.slug,
  });
}

function withSlug(row: Omit<MatchWithSlug, 'slug'> & { slug?: string }): MatchWithSlug {
  return { ...row, slug: slugForRow(row) };
}

async function loadSlugIndex(db: D1Database, kv?: KVNamespace): Promise<Record<string, string>> {
  if (kv) {
    const cached = await kv.get(SLUG_INDEX_KEY);
    if (cached) return JSON.parse(cached) as Record<string, string>;
  }

  const { results } = await db
    .prepare(`${MATCH_JOIN_SQL} ORDER BY m.kickoff_utc ASC`)
    .bind(WC2026_TOURNAMENT_ID)
    .all<Omit<MatchWithSlug, 'slug'>>();

  const { results: clubResults } = await db
    .prepare(`${MATCH_JOIN_SELECT} WHERE m.tournament_id != ? ORDER BY m.kickoff_utc ASC`)
    .bind(WC2026_TOURNAMENT_ID)
    .all<Omit<MatchWithSlug, 'slug'>>();

  const index: Record<string, string> = {};
  for (const row of [...(results ?? []), ...(clubResults ?? [])]) {
    index[slugForRow(row)] = row.id;
  }

  if (kv) {
    await kv.put(SLUG_INDEX_KEY, JSON.stringify(index), { expirationTtl: 600 });
  }
  return index;
}

async function loadMatchById(
  db: D1Database,
  matchId: string,
): Promise<MatchWithSlug | null> {
  const row = await db
    .prepare(`${MATCH_JOIN_SELECT} WHERE m.id = ?`)
    .bind(matchId)
    .first<Omit<MatchWithSlug, 'slug'>>();
  return row ? withSlug(row) : null;
}

export async function resolveMatchRef(
  db: D1Database,
  ref: string,
  kv?: KVNamespace,
): Promise<MatchWithSlug | null> {
  const cacheKey = `cache:match-ref:${ref}`;
  if (kv) {
    const cached = await kv.get(cacheKey);
    if (cached) return JSON.parse(cached) as MatchWithSlug;
  }

  let result: MatchWithSlug | null = null;

  if (isLegacyMatchId(ref)) {
    result = await loadMatchById(db, ref);
  } else {
    const index = await loadSlugIndex(db, kv);
    const matchId = index[ref];
    result = matchId ? await loadMatchById(db, matchId) : null;
  }

  if (result && kv) {
    await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: MATCH_REF_CACHE_TTL });
  }
  return result;
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
      tournamentSlug: getLeagueById(String(row.tournament_id ?? ''))?.slug,
    }),
  };
}
