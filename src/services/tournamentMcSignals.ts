import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import { buildFormSnapshotFromRows, type TeamFormSnapshot } from './teamFormStats';

export type HalfTimeSignal = {
  firstHalfGoalsFor: number;
  firstHalfGoalsAgainst: number;
  secondHalfGoalsFor: number;
  secondHalfGoalsAgainst: number;
  matchesSampled: number;
  firstHalfLeadRate: number;
};

export type MatchProbabilityTriple = { homeWin: number; draw: number; awayWin: number };

export function pairKey(homeTeamId: string, awayTeamId: string): string {
  return `${homeTeamId}|${awayTeamId}`;
}

function isFirstHalf(minute: number, period: string | null): boolean {
  if (period === '1H' || period === 'HT') return true;
  if (period === '2H' || period === 'FT') return false;
  return minute <= 45;
}

function tripleFromResults(
  homeId: string,
  rows: Array<{ home_team_id: string; away_team_id: string; home_score: number; away_score: number }>,
): MatchProbabilityTriple {
  if (!rows.length) return { homeWin: 0.33, draw: 0.34, awayWin: 0.33 };

  let homeW = 0;
  let draw = 0;
  let awayW = 0;
  for (const m of rows) {
    const homeIsA = m.home_team_id === homeId;
    const h = homeIsA ? m.home_score : m.away_score;
    const a = homeIsA ? m.away_score : m.home_score;
    if (h > a) homeW += 1;
    else if (a > h) awayW += 1;
    else draw += 1;
  }
  const n = rows.length;
  return { homeWin: homeW / n, draw: draw / n, awayWin: awayW / n };
}

export async function loadTournamentGroupFormForTeams(
  db: D1Database,
  teamIds: string[],
  limitPerTeam = 4,
): Promise<Map<string, TeamFormSnapshot>> {
  const out = new Map<string, TeamFormSnapshot>();
  if (!teamIds.length) return out;

  const rowsByTeam = new Map<
    string,
    Array<{
      home_team_id: string;
      away_team_id: string;
      home_score: number;
      away_score: number;
      home_xg: number;
      away_xg: number;
    }>
  >();

  const chunkSize = 8;
  for (let offset = 0; offset < teamIds.length; offset += chunkSize) {
    const chunk = teamIds.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `SELECT home_team_id, away_team_id, home_score, away_score, home_xg, away_xg, kickoff_utc
         FROM matches
         WHERE tournament_id = ?
           AND stage = 'Group'
           AND status IN ('completed', 'finished')
           AND (home_team_id IN (${placeholders}) OR away_team_id IN (${placeholders}))
         ORDER BY kickoff_utc DESC
         LIMIT ?`,
      )
      .bind(WC2026_TOURNAMENT_ID, ...chunk, ...chunk, limitPerTeam * chunk.length)
      .all<{
        home_team_id: string;
        away_team_id: string;
        home_score: number;
        away_score: number;
        home_xg: number;
        away_xg: number;
      }>();

    for (const row of results ?? []) {
      for (const teamId of [row.home_team_id, row.away_team_id]) {
        if (!chunk.includes(teamId)) continue;
        const bucket = rowsByTeam.get(teamId) ?? [];
        if (bucket.length >= limitPerTeam) continue;
        bucket.push(row);
        rowsByTeam.set(teamId, bucket);
      }
    }
  }

  for (const teamId of teamIds) {
    const snapshot = buildFormSnapshotFromRows(rowsByTeam.get(teamId) ?? [], teamId);
    if (snapshot) out.set(teamId, snapshot);
  }

  return out;
}

export async function loadGroupHalfTimeSignals(
  db: D1Database,
  teamIds: string[],
): Promise<Map<string, HalfTimeSignal>> {
  const out = new Map<string, HalfTimeSignal>();
  if (!teamIds.length) return out;

  const teamSet = new Set(teamIds);
  type Acc = {
    firstFor: number;
    firstAgainst: number;
    secondFor: number;
    secondAgainst: number;
    htLead: number;
    htSample: number;
  };
  const byTeam = new Map<string, Acc>();
  for (const teamId of teamIds) {
    byTeam.set(teamId, { firstFor: 0, firstAgainst: 0, secondFor: 0, secondAgainst: 0, htLead: 0, htSample: 0 });
  }

  const { results } = await db
    .prepare(
      `SELECT me.team_id, me.minute, me.period, m.id AS match_id,
              m.home_team_id, m.away_team_id
       FROM match_events me
       INNER JOIN matches m ON m.id = me.match_id
       WHERE m.tournament_id = ?
         AND m.stage = 'Group'
         AND m.status IN ('completed', 'finished')
         AND me.event_type = 'goal'`,
    )
    .bind(WC2026_TOURNAMENT_ID)
    .all<{
      team_id: string;
      minute: number;
      period: string | null;
      match_id: string;
      home_team_id: string;
      away_team_id: string;
    }>();

  const htScore = new Map<string, { home: number; away: number; homeTeamId: string; awayTeamId: string }>();

  for (const row of results ?? []) {
    if (!teamSet.has(row.team_id)) continue;
    const first = isFirstHalf(row.minute, row.period);
    const isHome = row.team_id === row.home_team_id;
    const oppId = isHome ? row.away_team_id : row.home_team_id;

    const scorerAcc = byTeam.get(row.team_id);
    const oppAcc = byTeam.get(oppId);
    if (!scorerAcc || !oppAcc) continue;

    if (first) {
      scorerAcc.firstFor += 1;
      oppAcc.firstAgainst += 1;
      const ht = htScore.get(row.match_id) ?? {
        home: 0,
        away: 0,
        homeTeamId: row.home_team_id,
        awayTeamId: row.away_team_id,
      };
      if (isHome) ht.home += 1;
      else ht.away += 1;
      htScore.set(row.match_id, ht);
    } else {
      scorerAcc.secondFor += 1;
      oppAcc.secondAgainst += 1;
    }
  }

  for (const score of htScore.values()) {
    for (const teamId of [score.homeTeamId, score.awayTeamId]) {
      if (!teamSet.has(teamId)) continue;
      const acc = byTeam.get(teamId);
      if (!acc) continue;
      acc.htSample += 1;
      const isHome = teamId === score.homeTeamId;
      const teamHt = isHome ? score.home : score.away;
      const oppHt = isHome ? score.away : score.home;
      if (teamHt > oppHt) acc.htLead += 1;
    }
  }

  for (const teamId of teamIds) {
    const acc = byTeam.get(teamId)!;
    const matchesSampled = Math.max(1, acc.htSample);
    out.set(teamId, {
      firstHalfGoalsFor: acc.firstFor / matchesSampled,
      firstHalfGoalsAgainst: acc.firstAgainst / matchesSampled,
      secondHalfGoalsFor: acc.secondFor / matchesSampled,
      secondHalfGoalsAgainst: acc.secondAgainst / matchesSampled,
      matchesSampled: acc.htSample,
      firstHalfLeadRate: acc.htSample > 0 ? acc.htLead / acc.htSample : 0.22,
    });
  }

  return out;
}

export async function loadRecentH2HTriples(
  db: D1Database,
  limitTotal = 500,
  limitPerPair = 5,
): Promise<Map<string, MatchProbabilityTriple>> {
  const { results } = await db
    .prepare(
      `SELECT home_team_id, away_team_id, home_score, away_score, kickoff_utc
       FROM matches
       WHERE status IN ('completed', 'finished')
         AND home_team_id LIKE 'team-w26-%'
         AND away_team_id LIKE 'team-w26-%'
       ORDER BY kickoff_utc DESC
       LIMIT ?`,
    )
    .bind(limitTotal)
    .all<{
      home_team_id: string;
      away_team_id: string;
      home_score: number;
      away_score: number;
    }>();

  const rowsByPair = new Map<string, Array<{ home_team_id: string; away_team_id: string; home_score: number; away_score: number }>>();
  for (const row of results ?? []) {
    const forward = pairKey(row.home_team_id, row.away_team_id);
    const bucket = rowsByPair.get(forward) ?? [];
    if (bucket.length < limitPerPair) {
      bucket.push(row);
      rowsByPair.set(forward, bucket);
    }

    const reverse = pairKey(row.away_team_id, row.home_team_id);
    const revBucket = rowsByPair.get(reverse) ?? [];
    if (revBucket.length < limitPerPair) {
      revBucket.push({
        home_team_id: row.away_team_id,
        away_team_id: row.home_team_id,
        home_score: row.away_score,
        away_score: row.home_score,
      });
      rowsByPair.set(reverse, revBucket);
    }
  }

  const out = new Map<string, MatchProbabilityTriple>();
  for (const [key, rows] of rowsByPair) {
    const [homeId] = key.split('|');
    out.set(key, tripleFromResults(homeId, rows));
  }
  return out;
}

export function blendTriples(
  base: MatchProbabilityTriple,
  overlay: MatchProbabilityTriple | undefined,
  overlayWeight = 0.32,
): MatchProbabilityTriple {
  if (!overlay) return base;
  const w = overlayWeight;
  const homeWin = base.homeWin * (1 - w) + overlay.homeWin * w;
  const draw = base.draw * (1 - w) + overlay.draw * w;
  const awayWin = base.awayWin * (1 - w) + overlay.awayWin * w;
  const sum = homeWin + draw + awayWin;
  return { homeWin: homeWin / sum, draw: draw / sum, awayWin: awayWin / sum };
}
