import type { FifaGoal, FifaMatchInfo, FifaTimelinePayload } from '../ingestion/fifa/fifaApiClient';
import { parseFifaMinute } from '../ingestion/fifa/parse';
import { timelinePeriodLabel } from '../ingestion/fifa/parseFifaTimeline';

export type ScorePair = { home: number; away: number };

export type MatchScoreDetail = {
  ht?: ScorePair;
  secondHalf?: ScorePair;
  ft90?: ScorePair;
  extraTime?: ScorePair;
  extraTime1?: ScorePair;
  extraTime2?: ScorePair;
  penalties?: ScorePair;
  stoppage?: {
    firstHalf?: number;
    secondHalf?: number;
    extraTimeFirst?: number;
    extraTimeSecond?: number;
  };
};

type GoalEventRow = {
  team_id: string;
  minute: number | null;
  period: string | null;
  event_type: string;
};

const GOAL_TYPES = new Set(['goal', 'penalty_goal', 'own_goal']);

function pair(home: number, away: number): ScorePair {
  return { home, away };
}

function hasPair(p?: ScorePair): p is ScorePair {
  return p != null && (p.home > 0 || p.away > 0);
}

function countGoalsByFifaPeriod(goals: FifaGoal[] | undefined, period: number): number {
  return (goals ?? []).filter((g) => g.Period === period).length;
}

function stoppageFromMinutes(minutes: number[], base: number): number | undefined {
  const max = minutes.length ? Math.max(...minutes) : 0;
  return max > base ? max - base : undefined;
}

function parseStoppageMinute(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/'/g, '').trim();
  const plus = cleaned.indexOf('+');
  if (plus < 0) return parseFifaMinute(raw);
  const base = Number.parseInt(cleaned.slice(0, plus), 10);
  const extra = Number.parseInt(cleaned.slice(plus + 1), 10);
  if (!Number.isFinite(base) || !Number.isFinite(extra)) return parseFifaMinute(raw);
  return base + extra;
}

/** Build score breakdown from FIFA match info goals + optional timeline. */
export function deriveScoreDetailFromFifa(
  info: FifaMatchInfo,
  timeline?: FifaTimelinePayload | null,
): MatchScoreDetail | null {
  const homeGoals = info.HomeTeam?.Goals ?? [];
  const awayGoals = info.AwayTeam?.Goals ?? [];

  const ht = pair(countGoalsByFifaPeriod(homeGoals, 3), countGoalsByFifaPeriod(awayGoals, 3));
  const h2 = pair(countGoalsByFifaPeriod(homeGoals, 5), countGoalsByFifaPeriod(awayGoals, 5));
  const et1h = countGoalsByFifaPeriod(homeGoals, 6);
  const et1a = countGoalsByFifaPeriod(awayGoals, 6);
  const et2h = countGoalsByFifaPeriod(homeGoals, 7);
  const et2a = countGoalsByFifaPeriod(awayGoals, 7);
  const penH = countGoalsByFifaPeriod(homeGoals, 8);
  const penA = countGoalsByFifaPeriod(awayGoals, 8);

  const ft90 = pair(ht.home + h2.home, ht.away + h2.away);
  const penalties = penH + penA > 0 ? pair(penH, penA) : undefined;

  const minutes1H: number[] = [];
  const minutes2H: number[] = [];
  const minutesEt1: number[] = [];
  const minutesEt2: number[] = [];

  for (const g of [...homeGoals, ...awayGoals]) {
    const m = parseStoppageMinute(g.Minute);
    if (m == null) continue;
    if (g.Period === 3) minutes1H.push(m);
    if (g.Period === 5) minutes2H.push(m);
    if (g.Period === 6) minutesEt1.push(m);
    if (g.Period === 7) minutesEt2.push(m);
  }

  for (const ev of timeline?.Event ?? []) {
    const m = parseStoppageMinute(ev.MatchMinute);
    if (m == null) continue;
    const label = timelinePeriodLabel(ev.Period);
    if (label === '1H') minutes1H.push(m);
    if (label === '2H') minutes2H.push(m);
    if (label === 'ET1') minutesEt1.push(m);
    if (label === 'ET2') minutesEt2.push(m);
    if (label === 'HT' && ev.HomeGoals != null && ev.AwayGoals != null) {
      ht.home = ev.HomeGoals;
      ht.away = ev.AwayGoals;
    }
  }

  const stoppage = {
    firstHalf: stoppageFromMinutes(minutes1H, 45),
    secondHalf: stoppageFromMinutes(minutes2H, 90),
    extraTimeFirst: stoppageFromMinutes(minutesEt1, 105),
    extraTimeSecond: stoppageFromMinutes(minutesEt2, 120),
  };

  const extraTime1Pair = pair(et1h, et1a);
  const extraTime2Pair = pair(et2h, et2a);
  const extraTime1 =
    hasPair(extraTime1Pair) || stoppage.extraTimeFirst ? extraTime1Pair : undefined;
  const extraTime2 =
    hasPair(extraTime2Pair) || stoppage.extraTimeSecond ? extraTime2Pair : undefined;
  const extraTime =
    et1h + et1a + et2h + et2a > 0 ? pair(et1h + et2h, et1a + et2a) : undefined;

  const detail: MatchScoreDetail = {
    ht,
    secondHalf: hasPair(h2) ? h2 : undefined,
    ft90,
    extraTime,
    extraTime1,
    extraTime2,
    penalties,
    stoppage:
      stoppage.firstHalf || stoppage.secondHalf || stoppage.extraTimeFirst || stoppage.extraTimeSecond
        ? stoppage
        : undefined,
  };

  if (
    !detail.ht &&
    !detail.secondHalf &&
    !detail.extraTime &&
    !detail.extraTime1 &&
    !detail.extraTime2 &&
    !detail.penalties &&
    !detail.stoppage
  ) {
    return null;
  }
  return detail;
}

function periodKey(period: string | null | undefined): '1H' | '2H' | 'ET1' | 'ET2' | 'PEN' | null {
  if (!period) return null;
  const p = period.toUpperCase();
  if (p === '1H' || p === 'HT') return '1H';
  if (p === '2H') return '2H';
  if (p === 'ET1') return 'ET1';
  if (p === 'ET2') return 'ET2';
  if (p === 'PEN') return 'PEN';
  return null;
}

/** Derive breakdown from stored match_events when FIFA JSON is unavailable. */
export function deriveScoreDetailFromGoalRows(
  rows: GoalEventRow[],
  homeTeamId: string,
  awayTeamId: string,
): MatchScoreDetail | null {
  let htH = 0;
  let htA = 0;
  let h2H = 0;
  let h2A = 0;
  let et1H = 0;
  let et1A = 0;
  let et2H = 0;
  let et2A = 0;
  let penH = 0;
  let penA = 0;
  const minutes1H: number[] = [];
  const minutes2H: number[] = [];
  const minutesEt1: number[] = [];
  const minutesEt2: number[] = [];

  for (const row of rows) {
    if (!GOAL_TYPES.has(row.event_type)) continue;
    const isHome = row.team_id === homeTeamId;
    const isAway = row.team_id === awayTeamId;
    if (!isHome && !isAway) continue;

    const pk = periodKey(row.period);
    const minute = row.minute ?? 0;

    if (pk === '1H') {
      if (isHome) htH += 1;
      else htA += 1;
      if (minute) minutes1H.push(minute);
    } else if (pk === '2H') {
      if (isHome) h2H += 1;
      else h2A += 1;
      if (minute) minutes2H.push(minute);
    } else if (pk === 'ET1') {
      if (isHome) et1H += 1;
      else et1A += 1;
      if (minute) minutesEt1.push(minute);
    } else if (pk === 'ET2') {
      if (isHome) et2H += 1;
      else et2A += 1;
      if (minute) minutesEt2.push(minute);
    } else if (pk === 'PEN') {
      if (isHome) penH += 1;
      else penA += 1;
    } else if (minute <= 45) {
      if (isHome) htH += 1;
      else htA += 1;
      minutes1H.push(minute);
    } else if (minute <= 120) {
      if (isHome) h2H += 1;
      else h2A += 1;
      minutes2H.push(minute);
    }
  }

  const allMinutes = rows.map((r) => r.minute ?? 0).filter((m) => m > 0);
  for (const m of allMinutes) {
    if (m > 45 && m <= 60) minutes1H.push(m);
    if (m > 90 && m <= 100) minutes2H.push(m);
    if (m > 105 && m <= 108) minutesEt1.push(m);
    if (m > 120) minutesEt2.push(m);
  }

  const ht = pair(htH, htA);
  const secondHalf = pair(h2H, h2A);
  const ft90 = pair(htH + h2H, htA + h2A);
  const stoppage = {
    firstHalf: stoppageFromMinutes(minutes1H, 45),
    secondHalf: stoppageFromMinutes(minutes2H, 90),
    extraTimeFirst: stoppageFromMinutes(minutesEt1, 105),
    extraTimeSecond: stoppageFromMinutes(minutesEt2, 120),
  };
  const extraTime1Pair = pair(et1H, et1A);
  const extraTime2Pair = pair(et2H, et2A);
  const extraTime1 =
    hasPair(extraTime1Pair) || stoppage.extraTimeFirst ? extraTime1Pair : undefined;
  const extraTime2 =
    hasPair(extraTime2Pair) || stoppage.extraTimeSecond ? extraTime2Pair : undefined;
  const extraTime = et1H + et1A + et2H + et2A > 0 ? pair(et1H + et2H, et1A + et2A) : undefined;
  const penalties = penH + penA > 0 ? pair(penH, penA) : undefined;

  if (
    htH + htA + h2H + h2A + et1H + et1A + et2H + et2A + penH + penA === 0 &&
    !stoppage.secondHalf &&
    !stoppage.extraTimeFirst &&
    !stoppage.extraTimeSecond
  ) {
    return null;
  }

  return {
    ht: htH + htA > 0 || minutes1H.length ? ht : undefined,
    secondHalf: h2H + h2A > 0 ? secondHalf : undefined,
    ft90,
    extraTime,
    extraTime1,
    extraTime2,
    penalties,
    stoppage:
      stoppage.firstHalf || stoppage.secondHalf || stoppage.extraTimeFirst || stoppage.extraTimeSecond
        ? stoppage
        : undefined,
  };
}

export function mergeScoreDetails(
  stored: MatchScoreDetail,
  derived: MatchScoreDetail | null,
): MatchScoreDetail {
  if (!derived) return stored;
  const stoppage =
    stored.stoppage || derived.stoppage
      ? {
          firstHalf: stored.stoppage?.firstHalf ?? derived.stoppage?.firstHalf,
          secondHalf: stored.stoppage?.secondHalf ?? derived.stoppage?.secondHalf,
          extraTimeFirst: stored.stoppage?.extraTimeFirst ?? derived.stoppage?.extraTimeFirst,
          extraTimeSecond: stored.stoppage?.extraTimeSecond ?? derived.stoppage?.extraTimeSecond,
        }
      : undefined;
  return {
    ht: stored.ht ?? derived.ht,
    secondHalf: stored.secondHalf ?? derived.secondHalf,
    ft90: stored.ft90 ?? derived.ft90,
    extraTime: stored.extraTime ?? derived.extraTime,
    extraTime1: stored.extraTime1 ?? derived.extraTime1,
    extraTime2: stored.extraTime2 ?? derived.extraTime2,
    penalties: stored.penalties ?? derived.penalties,
    stoppage:
      stoppage?.firstHalf || stoppage?.secondHalf || stoppage?.extraTimeFirst || stoppage?.extraTimeSecond
        ? stoppage
        : undefined,
  };
}

export async function loadGoalEventsForMatches(
  db: D1Database,
  matchIds: string[],
): Promise<Map<string, GoalEventRow[]>> {
  const out = new Map<string, GoalEventRow[]>();
  if (!matchIds.length) return out;

  const chunkSize = 40;
  for (let offset = 0; offset < matchIds.length; offset += chunkSize) {
    const chunk = matchIds.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `SELECT match_id, team_id, minute, period, event_type
         FROM match_events
         WHERE match_id IN (${placeholders})
           AND minute IS NOT NULL`,
      )
      .bind(...chunk)
      .all<GoalEventRow & { match_id: string }>();

    for (const row of results ?? []) {
      const bucket = out.get(row.match_id) ?? [];
      bucket.push(row);
      out.set(row.match_id, bucket);
    }
  }
  return out;
}

export async function enrichScheduleScoreDetails(
  db: D1Database,
  matches: Array<{
    id: string;
    home_team_id: string;
    away_team_id: string;
    status: string;
    scoreDetail?: MatchScoreDetail | null;
  }>,
): Promise<void> {
  const needs = matches.filter((m) => m.status === 'completed' || m.status === 'finished');
  if (!needs.length) return;

  const eventsByMatch = await loadGoalEventsForMatches(
    db,
    needs.map((m) => m.id),
  );
  for (const match of needs) {
    const rows = eventsByMatch.get(match.id) ?? [];
    const derived = deriveScoreDetailFromGoalRows(rows, match.home_team_id, match.away_team_id);
    match.scoreDetail = match.scoreDetail
      ? mergeScoreDetails(match.scoreDetail, derived)
      : derived;
  }
}

export function parseScoreDetailJson(raw: string | null | undefined): MatchScoreDetail | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MatchScoreDetail;
  } catch {
    return null;
  }
}

export function serializeScoreDetail(detail: MatchScoreDetail | null): string | null {
  if (!detail) return null;
  return JSON.stringify(detail);
}

export async function resolveMatchScoreDetail(
  db: D1Database,
  match: { id: string; home_team_id: string; away_team_id: string; score_detail_json?: string | null },
): Promise<MatchScoreDetail | null> {
  const stored = parseScoreDetailJson(match.score_detail_json ?? null);
  const rows = await loadGoalEventsForMatches(db, [match.id]);
  const derived = deriveScoreDetailFromGoalRows(rows.get(match.id) ?? [], match.home_team_id, match.away_team_id);

  if (stored) return mergeScoreDetails(stored, derived);
  return derived;
}
