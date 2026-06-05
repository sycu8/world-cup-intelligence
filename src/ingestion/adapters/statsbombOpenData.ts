/**
 * StatsBomb open-data (GitHub) — research/non-commercial.
 * @see https://github.com/statsbomb/open-data
 */
export const STATSBOMB_OPEN_DATA_REPO = 'https://github.com/statsbomb/open-data';
export const STATSBOMB_OPEN_DATA_BASE =
  'https://raw.githubusercontent.com/statsbomb/open-data/master/data';

export const STATSBOMB_WC_COMPETITION_ID = 43;

export type WcSeasonRef = { seasonId: number; year: number; tournamentId: string };

/** Fallback when competitions.json is unreachable. */
export const STATSBOMB_WC_SEASONS: WcSeasonRef[] = [
  { seasonId: 106, year: 2022, tournamentId: 't-2022' },
  { seasonId: 3, year: 2018, tournamentId: 't-2018' },
];

export type StatsbombCompetitionRow = {
  competition_id: number;
  season_id: number;
  competition_name: string;
  competition_gender: string;
  competition_youth: boolean;
  season_name: string;
  match_available: string | null;
};

export function filterWorldCupSeasons(rows: StatsbombCompetitionRow[]): WcSeasonRef[] {
  return rows
    .filter(
      (r) =>
        r.competition_id === STATSBOMB_WC_COMPETITION_ID &&
        r.competition_name === 'FIFA World Cup' &&
        r.competition_gender === 'male' &&
        !r.competition_youth &&
        r.match_available != null &&
        /^\d{4}$/.test(r.season_name),
    )
    .map((r) => ({
      seasonId: r.season_id,
      year: Number(r.season_name),
      tournamentId: `t-${r.season_name}`,
    }))
    .sort((a, b) => b.year - a.year);
}

export function competitionsUrl(): string {
  return `${STATSBOMB_OPEN_DATA_BASE}/competitions.json`;
}

export async function discoverStatsbombWcSeasons(
  minYear = 2006,
): Promise<WcSeasonRef[]> {
  try {
    const res = await fetch(competitionsUrl(), {
      headers: { 'User-Agent': 'wc-tactical-platform/1.0 (statsbomb-open-data)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return STATSBOMB_WC_SEASONS;
    const rows = (await res.json()) as StatsbombCompetitionRow[];
    const seasons = filterWorldCupSeasons(rows).filter((s) => s.year >= minYear);
    return seasons.length ? seasons : STATSBOMB_WC_SEASONS;
  } catch {
    return STATSBOMB_WC_SEASONS;
  }
}

export type StatsbombMatch = {
  match_id: number;
  match_date: string;
  kick_off: string;
  home_team: { home_team_name: string };
  away_team: { away_team_name: string };
  home_score: number;
  away_score: number;
  competition_stage?: { name: string };
};

export function parseStatsbombMatches(json: unknown): StatsbombMatch[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (m): m is StatsbombMatch =>
      typeof m === 'object' &&
      m !== null &&
      typeof (m as StatsbombMatch).match_id === 'number' &&
      typeof (m as StatsbombMatch).home_team?.home_team_name === 'string',
  );
}

export function statsbombMatchUrl(competitionId: number, seasonId: number): string {
  return `${STATSBOMB_OPEN_DATA_BASE}/matches/${competitionId}/${seasonId}.json`;
}

export function mapStatsbombStage(name: string | undefined): string {
  if (!name) return 'Group';
  const n = name.toLowerCase();
  if (n.includes('quarter')) return 'QF';
  if (n.includes('semi')) return 'SF';
  if (n.includes('final')) return 'Final';
  if (n.includes('round of 16') || n.includes('last 16')) return 'R16';
  if (n.includes('third')) return '3rd Place';
  return 'Group';
}

/** Estimate xG from goals when event-level xG is unavailable (conservative). */
export function estimateXgFromGoals(goals: number): number {
  return Math.max(0.15, goals * 0.85 + 0.35);
}
