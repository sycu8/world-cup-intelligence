import {
  parseEspnLeaders,
  parseEspnNews,
  parseEspnScoreboardEvents,
  parseEspnStandings,
  parseTheSportsDbEvents,
  parseTheSportsDbTable,
  type ParsedLeagueMatch,
  type ParsedLeagueNews,
  type ParsedLeagueScorer,
  type ParsedLeagueStanding,
} from './parseLeagueSources';

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_V2 = 'https://site.api.espn.com/apis/v2/sports/soccer';
const THESPORTSDB = 'https://www.thesportsdb.com/api/v1/json/123';

/** Browser-like headers — Cloudflare Workers often get empty/timeouts with bare bots. */
const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent':
    'Mozilla/5.0 (compatible; PitchIntel/1.0; +https://wcstat.orangecloud.vn)',
  Referer: 'https://www.espn.com/',
  Origin: 'https://www.espn.com',
};

const ESPN_TIMEOUT_MS = 8_000;
const TSDB_TIMEOUT_MS = 12_000;

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Prefer a single ESPN date-range call (Workers often time out on 6 parallel requests). */
export async function fetchEspnLeagueScoreboard(espnSlug: string): Promise<ParsedLeagueMatch[]> {
  const start = ymd(-3);
  const end = ymd(7);
  const rangePayload = await fetchJson(
    `${ESPN_SITE}/${espnSlug}/scoreboard?dates=${start}-${end}`,
    ESPN_TIMEOUT_MS,
  );
  const byId = new Map<string, ParsedLeagueMatch>();
  for (const match of parseEspnScoreboardEvents(rangePayload)) {
    byId.set(match.sourceEventId, match);
  }

  // Fallback: today-only board if the range endpoint is empty/unavailable.
  if (byId.size === 0) {
    const todayPayload = await fetchJson(
      `${ESPN_SITE}/${espnSlug}/scoreboard?dates=${ymd(0)}`,
      ESPN_TIMEOUT_MS,
    );
    for (const match of parseEspnScoreboardEvents(todayPayload)) {
      byId.set(match.sourceEventId, match);
    }
  }

  return [...byId.values()];
}

export async function fetchEspnLeagueStandings(espnSlug: string): Promise<ParsedLeagueStanding[]> {
  return parseEspnStandings(await fetchJson(`${ESPN_V2}/${espnSlug}/standings`, ESPN_TIMEOUT_MS));
}

export async function fetchEspnLeagueLeaders(espnSlug: string): Promise<ParsedLeagueScorer[]> {
  return parseEspnLeaders(await fetchJson(`${ESPN_SITE}/${espnSlug}/leaders`, ESPN_TIMEOUT_MS));
}

export async function fetchEspnLeagueNews(espnSlug: string): Promise<ParsedLeagueNews[]> {
  return parseEspnNews(await fetchJson(`${ESPN_SITE}/${espnSlug}/news`, ESPN_TIMEOUT_MS));
}

/** Normalize catalog seasons (`2026/27`) into TheSportsDB variants (`2026-2027`, `2026`, …). */
export function theSportsDbSeasonCandidates(season: string, year: number): string[] {
  const out: string[] = [];
  const push = (value: string) => {
    if (value && !out.includes(value)) out.push(value);
  };
  push(season.trim());
  const slash = season.match(/^(\d{4})\s*[\/\-]\s*(\d{2,4})$/);
  if (slash) {
    const y1 = slash[1]!;
    const rawY2 = slash[2]!;
    const y2 = rawY2.length === 2 ? `${y1.slice(0, 2)}${rawY2}` : rawY2;
    push(`${y1}-${y2}`);
    push(`${y1}/${y2.slice(-2)}`);
    push(y1);
    push(y2);
  }
  push(String(year));
  push(`${year}-${year + 1}`);
  push(`${year - 1}-${year}`);
  push(`${year}/${String(year + 1).slice(-2)}`);
  return out;
}

function withinKickoffWindow(kickoffUtc: string, now = Date.now()): boolean {
  const t = Date.parse(kickoffUtc);
  if (!Number.isFinite(t)) return false;
  const delta = t - now;
  // Wider than before so sparse / mid-season cups still surface.
  return delta > -21 * 86400_000 && delta < 45 * 86400_000;
}

export async function fetchTheSportsDbSeason(
  leagueId: string,
  season: string,
  year = Number(season.slice(0, 4)) || new Date().getUTCFullYear(),
): Promise<{ matches: ParsedLeagueMatch[]; standings: ParsedLeagueStanding[] }> {
  const seasons = theSportsDbSeasonCandidates(season, year);
  let matches: ParsedLeagueMatch[] = [];
  let standings: ParsedLeagueStanding[] = [];

  for (const candidate of seasons) {
    const [eventsPayload, tablePayload] = await Promise.all([
      fetchJson(
        `${THESPORTSDB}/eventsseason.php?id=${leagueId}&s=${encodeURIComponent(candidate)}`,
        TSDB_TIMEOUT_MS,
      ),
      fetchJson(
        `${THESPORTSDB}/lookuptable.php?l=${leagueId}&s=${encodeURIComponent(candidate)}`,
        TSDB_TIMEOUT_MS,
      ),
    ]);
    const parsedMatches = parseTheSportsDbEvents(eventsPayload).filter((match) =>
      withinKickoffWindow(match.kickoffUtc),
    );
    const parsedStandings = parseTheSportsDbTable(tablePayload);
    if (parsedMatches.length || parsedStandings.length) {
      matches = parsedMatches;
      standings = parsedStandings;
      break;
    }
  }

  return { matches, standings };
}
