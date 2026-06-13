import { logInfo } from '../../utils/logger';
import {
  findEspnEventId,
  teamLabelsMatch,
  type EspnScoreboardEvent,
} from './espnTeamMatch';
import { parseEspnTeamStats, type EspnMatchSummary } from './parseEspnStats';
import type { ParsedTeamMatchStats } from '../fifa/parseFifaGamedayStats';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const ESPN_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'wc-tactical-platform/1.0 (ESPN stats fallback)',
};

function kickoffDatesUtc(kickoffUtc: string): string[] {
  const day = kickoffUtc.slice(0, 10);
  const base = new Date(`${day}T12:00:00Z`);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const prev = new Date(base);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + 1);
  return [fmt(prev), fmt(base), fmt(next)];
}

async function espnFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${ESPN_API_BASE}${path}`, {
    headers: ESPN_HEADERS,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchScoreboard(dateYmd: string): Promise<EspnScoreboardEvent[]> {
  const data = await espnFetch<{ events?: EspnScoreboardEvent[] }>(`/scoreboard?dates=${dateYmd}`);
  return data?.events ?? [];
}

export async function resolveEspnEventId(
  homeName: string,
  awayName: string,
  kickoffUtc: string,
): Promise<string | null> {
  const seen = new Set<string>();
  for (const dateYmd of kickoffDatesUtc(kickoffUtc)) {
    if (seen.has(dateYmd)) continue;
    seen.add(dateYmd);
    const events = await fetchScoreboard(dateYmd);
    const hit = findEspnEventId(events, homeName, awayName);
    if (hit) return hit;
  }
  return null;
}

export async function fetchEspnMatchSummary(eventId: string): Promise<EspnMatchSummary | null> {
  return espnFetch<EspnMatchSummary>(`/summary?event=${eventId}`);
}

export type EspnResolvedMatchStats = {
  eventId: string;
  homeEspnName: string;
  awayEspnName: string;
  home: ParsedTeamMatchStats;
  away: ParsedTeamMatchStats;
};

/** Pull team boxscore stats from ESPN when FIFA Gameday is unavailable. */
export async function fetchEspnTeamMatchStats(
  homeName: string,
  awayName: string,
  kickoffUtc: string,
): Promise<EspnResolvedMatchStats | null> {
  const eventId = await resolveEspnEventId(homeName, awayName, kickoffUtc);
  if (!eventId) return null;

  const summary = await fetchEspnMatchSummary(eventId);
  const teams = summary?.boxscore?.teams ?? [];
  if (teams.length < 2) return null;

  let homeRow = teams.find((t) => teamLabelsMatch(homeName, t.team?.displayName ?? ''));
  let awayRow = teams.find((t) => teamLabelsMatch(awayName, t.team?.displayName ?? ''));
  if (!homeRow || !awayRow || homeRow === awayRow) {
    const [a, b] = teams;
    homeRow = teamLabelsMatch(homeName, a.team?.displayName ?? '') ? a : b;
    awayRow = teamLabelsMatch(awayName, a.team?.displayName ?? '') ? a : b;
  }
  if (!homeRow?.statistics?.length || !awayRow?.statistics?.length) return null;

  const home = parseEspnTeamStats(homeRow.statistics);
  const away = parseEspnTeamStats(awayRow.statistics);
  const hasCore =
    (home.possession ?? 0) > 0 &&
    (away.possession ?? 0) > 0 &&
    (home.passes ?? 0) > 0 &&
    (away.passes ?? 0) > 0;
  if (!hasCore) return null;

  logInfo('espn stats resolved', {
    event_id: eventId,
    home: homeRow.team?.displayName,
    away: awayRow.team?.displayName,
  });

  return {
    eventId,
    homeEspnName: homeRow.team?.displayName ?? homeName,
    awayEspnName: awayRow.team?.displayName ?? awayName,
    home,
    away,
  };
}
