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

const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'pitchintel-leagues/1.0',
};

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
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

export async function fetchEspnLeagueScoreboard(espnSlug: string): Promise<ParsedLeagueMatch[]> {
  const dates = [ymd(-2), ymd(-1), ymd(0), ymd(1), ymd(2), ymd(3)];
  const batches = await Promise.all(
    dates.map((date) => fetchJson(`${ESPN_SITE}/${espnSlug}/scoreboard?dates=${date}`)),
  );
  const byId = new Map<string, ParsedLeagueMatch>();
  for (const payload of batches) {
    for (const match of parseEspnScoreboardEvents(payload)) {
      byId.set(match.sourceEventId, match);
    }
  }
  return [...byId.values()];
}

export async function fetchEspnLeagueStandings(espnSlug: string): Promise<ParsedLeagueStanding[]> {
  return parseEspnStandings(await fetchJson(`${ESPN_V2}/${espnSlug}/standings`));
}

export async function fetchEspnLeagueLeaders(espnSlug: string): Promise<ParsedLeagueScorer[]> {
  return parseEspnLeaders(await fetchJson(`${ESPN_SITE}/${espnSlug}/leaders`));
}

export async function fetchEspnLeagueNews(espnSlug: string): Promise<ParsedLeagueNews[]> {
  return parseEspnNews(await fetchJson(`${ESPN_SITE}/${espnSlug}/news`));
}

export async function fetchTheSportsDbSeason(
  leagueId: string,
  season: string,
): Promise<{ matches: ParsedLeagueMatch[]; standings: ParsedLeagueStanding[] }> {
  const [eventsPayload, tablePayload] = await Promise.all([
    fetchJson(`${THESPORTSDB}/eventsseason.php?id=${leagueId}&s=${encodeURIComponent(season)}`),
    fetchJson(`${THESPORTSDB}/lookuptable.php?l=${leagueId}&s=${encodeURIComponent(season)}`),
  ]);
  const matches = parseTheSportsDbEvents(eventsPayload).filter((match) => {
    const t = Date.parse(match.kickoffUtc);
    if (!Number.isFinite(t)) return false;
    const delta = t - Date.now();
    return delta > -14 * 86400_000 && delta < 21 * 86400_000;
  });
  return { matches, standings: parseTheSportsDbTable(tablePayload) };
}
