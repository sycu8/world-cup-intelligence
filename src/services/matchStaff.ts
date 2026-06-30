import type { AppEnv } from '../env';
import { resolveMatchRef } from './matchRef';
import type { CoachFeatures, RefereeFeatures } from '../models/probability/types';

export type CoachProfile = {
  coachId: string;
  name: string;
  nationality: string | null;
  wcAppearances: number;
  tenureYears: number;
  tacticalRating: number;
  disciplineIndex: number;
};

export type MatchOfficialRow = {
  role: string;
  name: string;
  nationality: string | null;
  fifaCategory: string | null;
  strictness: number | null;
};

export type MatchStaffPayload = {
  matchId: string;
  slug: string;
  homeCoach: CoachProfile | null;
  awayCoach: CoachProfile | null;
  officials: MatchOfficialRow[];
  referee: MatchOfficialRow | null;
};

type CoachRow = {
  id: string;
  name: string;
  nationality: string | null;
  wc_appearances: number;
  tenure_years: number;
  tactical_rating: number;
  discipline_index: number;
};

function mapCoach(row: CoachRow): CoachProfile {
  return {
    coachId: row.id,
    name: row.name,
    nationality: row.nationality,
    wcAppearances: row.wc_appearances,
    tenureYears: row.tenure_years,
    tacticalRating: row.tactical_rating,
    disciplineIndex: row.discipline_index,
  };
}

export function coachToFeatures(
  profile: CoachProfile | null,
  teamCountryCode?: string | null,
): CoachFeatures | undefined {
  if (!profile) return undefined;
  return {
    coachId: profile.coachId,
    name: profile.name,
    wcAppearances: profile.wcAppearances,
    tenureYears: profile.tenureYears,
    tacticalRating: profile.tacticalRating,
    disciplineIndex: profile.disciplineIndex,
    homeNationMatch:
      !!teamCountryCode &&
      !!profile.nationality &&
      teamCountryCode.toUpperCase() === profile.nationality.toUpperCase(),
  };
}

export function refereeToFeatures(official: MatchOfficialRow | null): RefereeFeatures | undefined {
  if (!official?.strictness) return undefined;
  return {
    name: official.name,
    strictness: official.strictness,
    avgYellowCards: 3.5 + official.strictness * 2,
    avgRedCards: official.strictness * 0.22,
  };
}

async function loadTeamCoach(
  db: D1Database,
  teamId: string,
  tournamentId: string,
): Promise<CoachProfile | null> {
  const row = await db
    .prepare(
      `SELECT c.id, c.name, c.nationality, c.wc_appearances, c.tenure_years,
              c.tactical_rating, c.discipline_index
       FROM team_coaches tc
       JOIN coaches c ON c.id = tc.coach_id
       WHERE tc.team_id = ? AND tc.tournament_id = ? AND tc.role = 'head'`,
    )
    .bind(teamId, tournamentId)
    .first<CoachRow>();
  return row ? mapCoach(row) : null;
}

export async function getTeamCoachProfile(
  env: AppEnv,
  teamId: string,
  tournamentId = 't-2026',
): Promise<CoachProfile | null> {
  return loadTeamCoach(env.DB, teamId, tournamentId);
}

export async function getMatchStaff(env: AppEnv, ref: string): Promise<MatchStaffPayload | null> {
  const resolved = await resolveMatchRef(env.DB, ref);
  if (!resolved) return null;

  const matchId = resolved.id;
  const tournamentId = resolved.tournament_id ?? 't-2026';

  const [homeCoach, awayCoach, officialsResult] = await Promise.all([
    loadTeamCoach(env.DB, resolved.home_team_id, tournamentId),
    loadTeamCoach(env.DB, resolved.away_team_id, tournamentId),
    env.DB.prepare(
      `SELECT role, name, nationality, fifa_category, strictness
       FROM match_officials WHERE match_id = ?
       ORDER BY CASE role
         WHEN 'referee' THEN 1
         WHEN 'assistant_1' THEN 2
         WHEN 'assistant_2' THEN 3
         WHEN 'fourth_official' THEN 4
         WHEN 'var' THEN 5
         ELSE 9 END`,
    )
      .bind(matchId)
      .all<{
        role: string;
        name: string;
        nationality: string | null;
        fifa_category: string | null;
        strictness: number | null;
      }>(),
  ]);

  const officials: MatchOfficialRow[] = (officialsResult.results ?? []).map((o) => ({
    role: o.role,
    name: o.name,
    nationality: o.nationality,
    fifaCategory: o.fifa_category,
    strictness: o.strictness,
  }));

  const referee = officials.find((o) => o.role === 'referee') ?? null;

  return {
    matchId,
    slug: resolved.slug,
    homeCoach,
    awayCoach,
    officials,
    referee,
  };
}

export async function loadStaffFeaturesForMatch(
  env: AppEnv,
  matchId: string,
  tournamentId: string,
  homeTeamId: string,
  awayTeamId: string,
  homeCountryCode?: string | null,
  awayCountryCode?: string | null,
): Promise<{ homeCoach?: CoachFeatures; awayCoach?: CoachFeatures; referee?: RefereeFeatures }> {
  const [homeCoach, awayCoach, officialsResult] = await Promise.all([
    loadTeamCoach(env.DB, homeTeamId, tournamentId),
    loadTeamCoach(env.DB, awayTeamId, tournamentId),
    env.DB.prepare(
      `SELECT role, name, nationality, strictness FROM match_officials
       WHERE match_id = ? AND role = 'referee'`,
    )
      .bind(matchId)
      .first<{ role: string; name: string; nationality: string | null; strictness: number | null }>(),
  ]);

  const refereeRow: MatchOfficialRow | null = officialsResult
    ? {
        role: officialsResult.role,
        name: officialsResult.name,
        nationality: officialsResult.nationality,
        fifaCategory: null,
        strictness: officialsResult.strictness,
      }
    : null;

  return {
    homeCoach: coachToFeatures(homeCoach, homeCountryCode),
    awayCoach: coachToFeatures(awayCoach, awayCountryCode),
    referee: refereeToFeatures(refereeRow),
  };
}
