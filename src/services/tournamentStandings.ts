import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import {
  computeGroupStandingsFromMatchRows,
  type GroupStanding,
  type GroupStageMatchRow,
} from './tournamentProgression';

export type StandingRow = GroupStanding & {
  teamName: string;
  shortName: string | null;
  countryCode?: string | null;
  rank: number;
  isThirdPlaceCandidate?: boolean;
};

export type GroupStandingsPayload = {
  tournamentId: string;
  groups: Record<
    string,
    {
      complete: boolean;
      rows: StandingRow[];
    }
  >;
  thirdPlaceRanking: Array<StandingRow & { group: string }>;
};

const GROUP_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

export function compareStandings(a: GroupStanding, b: GroupStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  return b.gd - a.gd || b.gf - a.gf || a.teamId.localeCompare(b.teamId);
}

export function sortStandingRows(rows: StandingRow[]): StandingRow[] {
  const preTournament = rows.every((r) => r.played === 0);
  const sorted = [...rows].sort((a, b) => {
    if (preTournament) {
      return a.teamName.localeCompare(b.teamName, undefined, { sensitivity: 'base' });
    }
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamName.localeCompare(b.teamName, undefined, { sensitivity: 'base' });
  });
  return sorted.map((row, i) => ({
    ...row,
    rank: i + 1,
    isThirdPlaceCandidate: i === 2,
  }));
}

export async function buildGroupStandingsPayload(env: AppEnv): Promise<GroupStandingsPayload> {
  const [matchesResult, completionResult, teamsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT group_code, home_team_id, away_team_id, home_score, away_score, status
       FROM matches
       WHERE tournament_id = ? AND stage = 'Group'`,
    )
      .bind(WC2026_TOURNAMENT_ID)
      .all<GroupStageMatchRow>(),
    env.DB.prepare(
      `SELECT group_code,
              COUNT(*) AS total,
              SUM(CASE WHEN status IN ('completed', 'finished') THEN 1 ELSE 0 END) AS done
       FROM matches
       WHERE tournament_id = ? AND stage = 'Group'
       GROUP BY group_code`,
    )
      .bind(WC2026_TOURNAMENT_ID)
      .all<{ group_code: string; total: number; done: number }>(),
    env.DB.prepare(
      `SELECT id, name, short_name, country_code FROM teams WHERE id LIKE 'team-w26-%'`,
    ).all<{ id: string; name: string; short_name: string | null; country_code: string | null }>(),
  ]);

  const allMatches = matchesResult.results ?? [];
  const completionMap = new Map(
    (completionResult.results ?? []).map((r) => [
      r.group_code,
      r.total > 0 && r.total === r.done,
    ]),
  );
  const nameMap = new Map(
    (teamsResult.results ?? []).map((t) => [
      t.id,
      { name: t.name, short: t.short_name, countryCode: t.country_code },
    ]),
  );

  const groups: GroupStandingsPayload['groups'] = {};
  const thirdPlaceCandidates: Array<StandingRow & { group: string }> = [];

  for (const code of GROUP_CODES) {
    const raw = computeGroupStandingsFromMatchRows(allMatches, code);
    const complete = completionMap.get(code) === true;

    const rows: StandingRow[] = raw.map((row) => {
      const names = nameMap.get(row.teamId);
      return {
        ...row,
        rank: 0,
        teamName: names?.name ?? row.teamId,
        shortName: names?.short ?? null,
        countryCode: names?.countryCode ?? null,
        isThirdPlaceCandidate: false,
      };
    });

    const ranked = sortStandingRows(rows);

    if (ranked[2]) {
      thirdPlaceCandidates.push({ ...ranked[2], group: code });
    }

    groups[code] = { complete, rows: ranked };
  }

  thirdPlaceCandidates.sort((a, b) => compareStandings(a, b));

  return {
    tournamentId: WC2026_TOURNAMENT_ID,
    groups,
    thirdPlaceRanking: thirdPlaceCandidates,
  };
}

export function rankBestThirdPlace(
  candidates: Array<GroupStanding & { group?: string }>,
): GroupStanding[] {
  return [...candidates].sort(compareStandings).slice(0, 8);
}
