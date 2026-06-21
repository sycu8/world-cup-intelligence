import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { TEAM_NAME_TO_ID } from '../data/teamNameMap';

export type HeadToHeadMatch = {
  id: string;
  kickoff_utc: string;
  stage: string | null;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_name: string;
  away_name: string;
  home_short: string | null;
  away_short: string | null;
  home_score: number;
  away_score: number;
  home_xg: number;
  away_xg: number;
  tournament_year?: number;
  tournament_name?: string;
};

export type HeadToHeadSummary = {
  totalMatches: number;
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
  avgGoalsHome: number;
  avgGoalsAway: number;
  recentFormHome: string;
  recentFormAway: string;
};

export type TeamWcOpponentRecord = {
  opponentId: string;
  opponentName: string;
  opponentShort: string | null;
  meetings: HeadToHeadMatch[];
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type TeamRecentWcMatch = HeadToHeadMatch & {
  opponentId: string;
  opponentName: string;
  opponentShort: string | null;
  teamScore: number;
  opponentScore: number;
  result: 'W' | 'D' | 'L';
  isHome: boolean;
};

const WC_HISTORY_SQL_FILTER = `
  m.status = 'completed'
  AND t.year IS NOT NULL
  AND t.year < 2026
  AND m.stage NOT IN ('Friendly', 'WCQ')
`;

const H2H_SELECT = `
  SELECT m.*, ht.name AS home_name, ht.short_name AS home_short,
         at.name AS away_name, at.short_name AS away_short,
         t.year AS tournament_year, t.name AS tournament_name
  FROM matches m
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams at ON at.id = m.away_team_id
  LEFT JOIN tournaments t ON t.id = m.tournament_id
`;

export function summarizePairFromPerspective(
  meetings: HeadToHeadMatch[],
  perspectiveHomeId: string,
  perspectiveAwayId: string,
): HeadToHeadSummary {
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let goalsHome = 0;
  let goalsAway = 0;

  for (const h of meetings) {
    const isCurrentOrientation =
      h.home_team_id === perspectiveHomeId && h.away_team_id === perspectiveAwayId;
    const hScore = isCurrentOrientation ? h.home_score : h.away_score;
    const aScore = isCurrentOrientation ? h.away_score : h.home_score;
    goalsHome += hScore;
    goalsAway += aScore;
    if (hScore > aScore) homeWins++;
    else if (hScore < aScore) awayWins++;
    else draws++;
  }

  const formSlice = meetings.slice(0, 5);
  const formHome = formSlice.map((h) => {
    const oriented = h.home_team_id === perspectiveHomeId;
    const hs = oriented ? h.home_score : h.away_score;
    const as = oriented ? h.away_score : h.home_score;
    return hs > as ? 'W' : hs < as ? 'L' : 'D';
  });
  const formAway = formSlice.map((h) => {
    const oriented = h.away_team_id === perspectiveAwayId;
    const hs = oriented ? h.home_score : h.away_score;
    const as = oriented ? h.away_score : h.home_score;
    return hs > as ? 'W' : hs < as ? 'L' : 'D';
  });

  return {
    totalMatches: meetings.length,
    homeTeamWins: homeWins,
    awayTeamWins: awayWins,
    draws,
    avgGoalsHome: meetings.length ? goalsHome / meetings.length : 0,
    avgGoalsAway: meetings.length ? goalsAway / meetings.length : 0,
    recentFormHome: formHome.join(' ') || '—',
    recentFormAway: formAway.join(' ') || '—',
  };
}

export function groupTeamWorldCupMeetings(
  teamId: string,
  meetings: HeadToHeadMatch[],
): TeamWcOpponentRecord[] {
  const byOpponent = new Map<string, TeamWcOpponentRecord>();

  for (const m of meetings) {
    const isHome = m.home_team_id === teamId;
    const opponentId = isHome ? m.away_team_id : m.home_team_id;
    const opponentName = isHome ? m.away_name : m.home_name;
    const opponentShort = isHome ? m.away_short : m.home_short;
    const goalsFor = isHome ? m.home_score : m.away_score;
    const goalsAgainst = isHome ? m.away_score : m.home_score;

    let record = byOpponent.get(opponentId);
    if (!record) {
      record = {
        opponentId,
        opponentName,
        opponentShort,
        meetings: [],
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      };
      byOpponent.set(opponentId, record);
    }

    record.meetings.push(m);
    record.goalsFor += goalsFor;
    record.goalsAgainst += goalsAgainst;
    if (goalsFor > goalsAgainst) record.wins++;
    else if (goalsFor < goalsAgainst) record.losses++;
    else record.draws++;
  }

  return [...byOpponent.values()].sort(
    (a, b) => (b.meetings[0]?.tournament_year | 0) - (a.meetings[0]?.tournament_year | 0),
  );
}

export async function resolveTeamIdsForWcHistory(env: AppEnv, teamId: string): Promise<string[]> {
  const team = await env.DB.prepare(`SELECT id, name, country_code FROM teams WHERE id = ?`)
    .bind(teamId)
    .first<{ id: string; name: string; country_code: string | null }>();
  if (!team) return [teamId];

  const ids = new Set<string>([teamId]);
  if (team.country_code) {
    const { results } = await env.DB.prepare(`SELECT id FROM teams WHERE country_code = ?`)
      .bind(team.country_code)
      .all<{ id: string }>();
    for (const row of results ?? []) ids.add(row.id);
  }

  const legacyId = TEAM_NAME_TO_ID[team.name];
  if (legacyId) ids.add(legacyId);

  return [...ids];
}

export function mapMatchesToTeamPerspective(
  aliasIds: Set<string>,
  matches: HeadToHeadMatch[],
): TeamRecentWcMatch[] {
  return matches.map((m) => {
    const isHome = aliasIds.has(m.home_team_id);
    const teamScore = isHome ? m.home_score : m.away_score;
    const opponentScore = isHome ? m.away_score : m.home_score;
    const opponentId = isHome ? m.away_team_id : m.home_team_id;
    const opponentName = isHome ? m.away_name : m.home_name;
    const opponentShort = isHome ? m.away_short : m.home_short;
    return {
      ...m,
      opponentId,
      opponentName,
      opponentShort,
      teamScore,
      opponentScore,
      result: teamScore > opponentScore ? 'W' : teamScore < opponentScore ? 'L' : 'D',
      isHome,
    };
  });
}

export async function getTeamRecentWorldCupMatches(
  env: AppEnv,
  teamId: string,
  limit = 5,
  excludeMatchId?: string,
): Promise<TeamRecentWcMatch[]> {
  const aliasIds = new Set(await resolveTeamIdsForWcHistory(env, teamId));

  const placeholders = [...aliasIds].map(() => '?').join(', ');
  const excludeClause = excludeMatchId ? 'AND m.id != ?' : '';
  const binds: (string | number)[] = [...aliasIds, ...aliasIds];
  if (excludeMatchId) binds.push(excludeMatchId);
  binds.push(limit);

  const { results } = await env.DB.prepare(
    `${H2H_SELECT}
     WHERE ${WC_HISTORY_SQL_FILTER}
       ${excludeClause}
       AND (m.home_team_id IN (${placeholders}) OR m.away_team_id IN (${placeholders}))
     ORDER BY t.year DESC, m.kickoff_utc DESC
     LIMIT ?`,
  )
    .bind(...binds)
    .all<HeadToHeadMatch>();

  return mapMatchesToTeamPerspective(aliasIds, results ?? []);
}

export async function getWorldCupHeadToHeadBetween(
  env: AppEnv,
  homeTeamId: string,
  awayTeamId: string,
  excludeMatchId?: string,
): Promise<HeadToHeadMatch[]> {
  const excludeClause = excludeMatchId ? 'AND m.id != ?' : '';
  const binds: (string | number)[] = [homeTeamId, awayTeamId, awayTeamId, homeTeamId];
  if (excludeMatchId) binds.unshift(excludeMatchId);

  const { results } = await env.DB.prepare(
    `${H2H_SELECT}
     WHERE ${WC_HISTORY_SQL_FILTER}
       ${excludeClause}
       AND (
         (m.home_team_id = ? AND m.away_team_id = ?)
         OR (m.home_team_id = ? AND m.away_team_id = ?)
       )
     ORDER BY t.year DESC, m.kickoff_utc DESC`,
  )
    .bind(...binds)
    .all<HeadToHeadMatch>();

  return results ?? [];
}

export async function getTeamWorldCupHeadToHead(
  env: AppEnv,
  teamId: string,
): Promise<{ teamId: string; opponents: TeamWcOpponentRecord[]; totalMeetings: number } | null> {
  const team = await env.DB.prepare(`SELECT id FROM teams WHERE id = ?`).bind(teamId).first();
  if (!team) return null;

  const { results } = await env.DB.prepare(
    `${H2H_SELECT}
     WHERE ${WC_HISTORY_SQL_FILTER}
       AND (m.home_team_id = ? OR m.away_team_id = ?)
     ORDER BY t.year DESC, m.kickoff_utc DESC`,
  )
    .bind(teamId, teamId)
    .all<HeadToHeadMatch>();

  const meetings = results ?? [];
  const opponents = groupTeamWorldCupMeetings(teamId, meetings);

  return {
    teamId,
    opponents,
    totalMeetings: meetings.length,
  };
}

export async function getHeadToHead(
  env: AppEnv,
  matchId: string,
): Promise<{
  current: HeadToHeadMatch | null;
  history: HeadToHeadMatch[];
  worldCupHistory: HeadToHeadMatch[];
  summary: HeadToHeadSummary;
  worldCupSummary: HeadToHeadSummary;
  homeRecentWc: TeamRecentWcMatch[];
  awayRecentWc: TeamRecentWcMatch[];
} | null> {
  const current = await env.DB.prepare(
    `${H2H_SELECT}
     WHERE m.id = ? AND m.tournament_id = ?`,
  )
    .bind(matchId, WC2026_TOURNAMENT_ID)
    .first<HeadToHeadMatch & { home_team_id: string; away_team_id: string }>();

  if (!current) return null;

  const [worldCupHistory, homeRecentWc, awayRecentWc] = await Promise.all([
    getWorldCupHeadToHeadBetween(env, current.home_team_id, current.away_team_id, matchId),
    getTeamRecentWorldCupMatches(env, current.home_team_id, 5, matchId),
    getTeamRecentWorldCupMatches(env, current.away_team_id, 5, matchId),
  ]);

  const worldCupSummary = summarizePairFromPerspective(
    worldCupHistory,
    current.home_team_id,
    current.away_team_id,
  );

  return {
    current: current as HeadToHeadMatch,
    history: worldCupHistory,
    worldCupHistory,
    summary: worldCupSummary,
    worldCupSummary,
    homeRecentWc,
    awayRecentWc,
  };
}
