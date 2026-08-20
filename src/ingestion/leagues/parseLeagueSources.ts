export type ParsedLeagueTeam = {
  sourceId: string;
  name: string;
  shortName: string;
  abbreviation: string;
  crestUrl: string | null;
  countryCode: string | null;
};

export type ParsedLeagueMatch = {
  sourceEventId: string;
  kickoffUtc: string;
  status: 'scheduled' | 'live' | 'completed';
  minute: number;
  home: ParsedLeagueTeam;
  away: ParsedLeagueTeam;
  homeScore: number;
  awayScore: number;
  matchweek: number | null;
  stage: string;
  groupCode: string | null;
  venueName: string | null;
};

export type ParsedLeagueStanding = {
  groupCode: string;
  rank: number;
  team: ParsedLeagueTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export type ParsedLeagueScorer = {
  sourcePlayerId: string;
  playerName: string;
  sourceTeamId: string | null;
  teamName: string | null;
  goals: number;
  rank: number;
};

export type ParsedLeagueNews = {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  imageUrl: string | null;
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string | number;
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
    logos?: { href?: string }[];
  };
};

type EspnEvent = {
  id?: string;
  date?: string;
  week?: { number?: number; text?: string };
  competitions?: {
    status?: {
      type?: { state?: string; completed?: boolean; detail?: string; shortDetail?: string };
      displayClock?: string;
      period?: number;
    };
    competitors?: EspnCompetitor[];
    venue?: { fullName?: string };
    notes?: { headline?: string }[];
    grouping?: { displayName?: string };
  }[];
  grouping?: { displayName?: string };
};

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseMinute(detail: string | undefined, clock: string | undefined, period: number | undefined): number {
  const raw = `${clock ?? ''} ${detail ?? ''}`;
  const m = raw.match(/(\d{1,3})/);
  if (m) return Math.min(120, Number(m[1]));
  if (period && period > 1) return 45 * period;
  return 0;
}

export function mapEspnStatus(state: string | undefined, completed?: boolean): ParsedLeagueMatch['status'] {
  if (completed || state === 'post') return 'completed';
  if (state === 'in') return 'live';
  return 'scheduled';
}

function teamFromCompetitor(c: EspnCompetitor | undefined, fallbackName: string): ParsedLeagueTeam {
  const t = c?.team ?? {};
  const name = (t.displayName ?? t.shortDisplayName ?? fallbackName).trim() || fallbackName;
  const sourceId = String(t.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  return {
    sourceId,
    name,
    shortName: (t.shortDisplayName ?? t.abbreviation ?? name).slice(0, 24),
    abbreviation: (t.abbreviation ?? name.slice(0, 3)).toUpperCase(),
    crestUrl: t.logo ?? t.logos?.[0]?.href ?? null,
    countryCode: null,
  };
}

export function parseEspnScoreboardEvents(payload: unknown): ParsedLeagueMatch[] {
  const events = (payload as { events?: EspnEvent[] } | null)?.events ?? [];
  const matches: ParsedLeagueMatch[] = [];
  for (const event of events) {
    const competition = event.competitions?.[0];
    if (!event.id || !competition) continue;
    const competitors = competition.competitors ?? [];
    const homeC = competitors.find((c) => c.homeAway === 'home') ?? competitors[0];
    const awayC = competitors.find((c) => c.homeAway === 'away') ?? competitors[1];
    if (!homeC || !awayC) continue;
    const statusType = competition.status?.type;
    const week = event.week?.number ?? null;
    const groupHint =
      event.grouping?.displayName ??
      competition.grouping?.displayName ??
      competition.notes?.find((n) => /group/i.test(n.headline ?? ''))?.headline ??
      null;
    const groupCode = extractGroupCode(groupHint);
    const stage = week
      ? `Round ${week}`
      : groupCode
        ? 'Group'
        : (event.week?.text ?? competition.notes?.[0]?.headline ?? 'League');
    matches.push({
      sourceEventId: String(event.id),
      kickoffUtc: event.date ? new Date(event.date).toISOString() : new Date().toISOString(),
      status: mapEspnStatus(statusType?.state, statusType?.completed),
      minute: parseMinute(statusType?.detail, competition.status?.displayClock, competition.status?.period),
      home: teamFromCompetitor(homeC, 'Home'),
      away: teamFromCompetitor(awayC, 'Away'),
      homeScore: num(homeC.score),
      awayScore: num(awayC.score),
      matchweek: week,
      stage,
      groupCode,
      venueName: competition.venue?.fullName ?? null,
    });
  }
  return matches;
}

function extractGroupCode(label: string | null): string | null {
  if (!label) return null;
  const m = label.match(/group\s*([a-l])/i);
  return m ? m[1]!.toUpperCase() : null;
}

type EspnStat = { name?: string; value?: number | string; abbreviation?: string };
type EspnStandingEntry = {
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logos?: { href?: string }[];
  };
  stats?: EspnStat[];
};

function statValue(stats: EspnStat[] | undefined, names: string[]): number {
  for (const name of names) {
    const hit = stats?.find((s) => (s.name ?? '').toLowerCase() === name.toLowerCase());
    if (hit) return num(hit.value);
  }
  return 0;
}

export function parseEspnStandings(payload: unknown): ParsedLeagueStanding[] {
  const root = payload as {
    children?: { name?: string; abbreviation?: string; standings?: { entries?: EspnStandingEntry[] } }[];
    standings?: { entries?: EspnStandingEntry[] };
  } | null;
  const groups =
    root?.children?.length
      ? root.children.map((child) => ({
          groupCode: extractGroupCode(child.name ?? child.abbreviation ?? '') ?? '',
          entries: child.standings?.entries ?? [],
        }))
      : [{ groupCode: '', entries: root?.standings?.entries ?? [] }];

  const rows: ParsedLeagueStanding[] = [];
  for (const group of groups) {
    group.entries.forEach((entry, index) => {
      const team = entry.team ?? {};
      const name = (team.displayName ?? team.shortDisplayName ?? `Team ${index + 1}`).trim();
      const stats = entry.stats ?? [];
      const gf = statValue(stats, ['pointsFor', 'goalsFor']);
      const ga = statValue(stats, ['pointsAgainst', 'goalsAgainst']);
      rows.push({
        groupCode: group.groupCode,
        rank: statValue(stats, ['rank']) || index + 1,
        team: {
          sourceId: String(team.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
          name,
          shortName: (team.shortDisplayName ?? team.abbreviation ?? name).slice(0, 24),
          abbreviation: (team.abbreviation ?? name.slice(0, 3)).toUpperCase(),
          crestUrl: team.logos?.[0]?.href ?? null,
          countryCode: null,
        },
        played: statValue(stats, ['gamesPlayed', 'played']),
        won: statValue(stats, ['wins']),
        drawn: statValue(stats, ['ties', 'draws']),
        lost: statValue(stats, ['losses']),
        gf,
        ga,
        gd: statValue(stats, ['pointDifferential', 'goalDifferential']) || gf - ga,
        points: statValue(stats, ['points']),
      });
    });
  }
  return rows;
}

export function parseEspnLeaders(payload: unknown): ParsedLeagueScorer[] {
  const categories = (payload as { leaders?: { name?: string; abbreviation?: string; leaders?: unknown[] }[] } | null)
    ?.leaders ?? [];
  const scorers =
    categories.find((c) => /scor|goal/i.test(`${c.name ?? ''} ${c.abbreviation ?? ''}`))?.leaders ??
    categories[0]?.leaders ??
    [];
  return (scorers as {
    athlete?: { id?: string; displayName?: string };
    team?: { id?: string; displayName?: string };
    value?: number | string;
  }[])
    .map((row, index) => ({
      sourcePlayerId: String(row.athlete?.id ?? `${row.athlete?.displayName ?? 'player'}-${index}`),
      playerName: row.athlete?.displayName ?? `Player ${index + 1}`,
      sourceTeamId: row.team?.id ? String(row.team.id) : null,
      teamName: row.team?.displayName ?? null,
      goals: num(row.value),
      rank: index + 1,
    }))
    .filter((row) => row.playerName);
}

export function parseEspnNews(payload: unknown): ParsedLeagueNews[] {
  const articles = (payload as { articles?: Record<string, unknown>[] } | null)?.articles ?? [];
  return articles
    .map((article) => {
      const links = article.links as { web?: { href?: string } } | undefined;
      const images = article.images as { url?: string }[] | undefined;
      const title = String(article.headline ?? article.title ?? '').trim();
      const url = String(links?.web?.href ?? article.published ?? '').trim();
      if (!title) return null;
      return {
        title,
        description: String(article.description ?? '').slice(0, 800),
        url: url.startsWith('http') ? url : `https://www.espn.com${url || '/soccer'}`,
        publishedAt: String(article.published ?? new Date().toISOString()),
        imageUrl: images?.[0]?.url ?? null,
      };
    })
    .filter((row): row is ParsedLeagueNews => Boolean(row));
}

export type TheSportsDbEvent = {
  idEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  dateEvent?: string;
  strTime?: string;
  /** UTC-ish kickoff without offset; pair with strTimeLocal when present. */
  strTimestamp?: string;
  strTimeLocal?: string;
  strStatus?: string;
  intRound?: string;
  strVenue?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
};

/** TheSportsDB `strTime` / `strTimestamp` are UTC; `strTimeLocal` is venue local. */
export function kickoffUtcFromTheSportsDbEvent(event: TheSportsDbEvent): string {
  const stamp = (event.strTimestamp ?? '').trim();
  if (stamp) {
    const normalized = /Z|[+-]\d{2}:?\d{2}$/.test(stamp) ? stamp : `${stamp}Z`;
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  const time = (event.strTime && event.strTime !== '00:00:00' ? event.strTime : '12:00:00').slice(0, 8);
  if (event.dateEvent) {
    const parsed = Date.parse(`${event.dateEvent}T${time}Z`);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export function parseTheSportsDbEvents(payload: unknown): ParsedLeagueMatch[] {
  const events = (payload as { events?: TheSportsDbEvent[] } | null)?.events ?? [];
  return events
    .map((event): ParsedLeagueMatch | null => {
      if (!event.idEvent || !event.strHomeTeam || !event.strAwayTeam) return null;
      const kickoff = kickoffUtcFromTheSportsDbEvent(event);
      const statusRaw = (event.strStatus ?? '').toLowerCase();
      const status: ParsedLeagueMatch['status'] =
        statusRaw.includes('not') || statusRaw === '' || statusRaw === 'ns'
          ? 'scheduled'
          : /ft|match finished|aet|pen/.test(statusRaw)
            ? 'completed'
            : 'live';
      const week = event.intRound ? Number(event.intRound) : null;
      return {
        sourceEventId: event.idEvent,
        kickoffUtc: kickoff,
        status,
        minute: status === 'completed' ? 90 : 0,
        home: {
          sourceId: String(event.idHomeTeam ?? event.strHomeTeam),
          name: event.strHomeTeam,
          shortName: event.strHomeTeam.slice(0, 24),
          abbreviation: event.strHomeTeam.slice(0, 3).toUpperCase(),
          crestUrl: event.strHomeTeamBadge ?? null,
          countryCode: null,
        },
        away: {
          sourceId: String(event.idAwayTeam ?? event.strAwayTeam),
          name: event.strAwayTeam,
          shortName: event.strAwayTeam.slice(0, 24),
          abbreviation: event.strAwayTeam.slice(0, 3).toUpperCase(),
          crestUrl: event.strAwayTeamBadge ?? null,
          countryCode: null,
        },
        homeScore: num(event.intHomeScore),
        awayScore: num(event.intAwayScore),
        matchweek: Number.isFinite(week) ? week : null,
        stage: week ? `Round ${week}` : 'League',
        groupCode: null,
        venueName: event.strVenue ?? null,
      };
    })
    .filter((row): row is ParsedLeagueMatch => Boolean(row));
}

export type TheSportsDbTableRow = {
  intRank?: string;
  strTeam?: string;
  idTeam?: string;
  strTeamBadge?: string;
  intPlayed?: string;
  intWin?: string;
  intDraw?: string;
  intLoss?: string;
  intGoalsFor?: string;
  intGoalsAgainst?: string;
  intGoalDifference?: string;
  intPoints?: string;
};

export function parseTheSportsDbTable(payload: unknown): ParsedLeagueStanding[] {
  const table = (payload as { table?: TheSportsDbTableRow[] } | null)?.table ?? [];
  return table.map((row, index) => {
    const name = row.strTeam ?? `Team ${index + 1}`;
    const gf = num(row.intGoalsFor);
    const ga = num(row.intGoalsAgainst);
    return {
      groupCode: '',
      rank: num(row.intRank, index + 1),
      team: {
        sourceId: String(row.idTeam ?? name),
        name,
        shortName: name.slice(0, 24),
        abbreviation: name.slice(0, 3).toUpperCase(),
        crestUrl: row.strTeamBadge ?? null,
        countryCode: null,
      },
      played: num(row.intPlayed),
      won: num(row.intWin),
      drawn: num(row.intDraw),
      lost: num(row.intLoss),
      gf,
      ga,
      gd: num(row.intGoalDifference, gf - ga),
      points: num(row.intPoints),
    };
  });
}
