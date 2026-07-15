import type { AppEnv } from '../env';
import { attachSlugToScheduleRow } from '../services/matchRef';
import {
  resolveScheduleTournamentId,
  WC2026_MATCH_COUNT,
  WC2026_TOURNAMENT_ID,
  WC2026_YEAR,
} from '../constants/tournament';

type ScheduleMatchRow = {
  id: string;
  kickoff_utc: string;
  status: string;
  stage: string | null;
  group_code: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  minute: number;
  tournament_id: string;
};

type TeamMeta = {
  id: string;
  name: string;
  short_name: string | null;
  country_code: string | null;
};

function scheduleDateKey(kickoffUtc: string | null | undefined): string {
  return kickoffUtc?.slice(0, 10) ?? 'unknown';
}

export async function buildSchedulePayload(
  env: AppEnv,
  tournamentParam?: string | null,
) {
  const tournamentId = resolveScheduleTournamentId(tournamentParam ?? undefined);
  const [matchesResult, teamsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT id, kickoff_utc, status, stage, group_code,
              home_team_id, away_team_id,
              home_score, away_score, minute, tournament_id
       FROM matches
       WHERE tournament_id = ?
       ORDER BY kickoff_utc ASC`,
    )
      .bind(tournamentId)
      .all<ScheduleMatchRow>(),
    env.DB.prepare(
      `SELECT id, name, short_name, country_code FROM teams`,
    ).all<TeamMeta>(),
  ]);

  const teamMap = new Map((teamsResult.results ?? []).map((team) => [team.id, team]));
  const byDate: Record<string, unknown[]> = {};
  const list = (matchesResult.results ?? []).map((row) => {
    const home = teamMap.get(row.home_team_id);
    const away = teamMap.get(row.away_team_id);
    const enriched = attachSlugToScheduleRow({
      ...row,
      home_score: Number(row.home_score ?? 0),
      away_score: Number(row.away_score ?? 0),
      minute: Number(row.minute ?? 0),
      home_name: home?.name ?? 'TBD',
      home_short: home?.short_name ?? null,
      home_country_code: home?.country_code ?? null,
      away_name: away?.name ?? 'TBD',
      away_short: away?.short_name ?? null,
      away_country_code: away?.country_code ?? null,
    });
    const dateKey = scheduleDateKey(row.kickoff_utc);
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(enriched);
    return enriched;
  });

  return {
    data: { byDate, matches: list, tournamentId, total: list.length },
    meta: {
      expectedMatches: WC2026_MATCH_COUNT,
      year: WC2026_YEAR,
      tournamentId: WC2026_TOURNAMENT_ID,
      wc2026Only: true,
    },
  };
}
