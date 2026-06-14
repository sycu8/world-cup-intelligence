import {
  FIFA_API_BASE,
  WC2026_COMPETITION_ID,
  WC2026_FIXTURES_FROM_ISO,
  WC2026_FIXTURES_TO_ISO,
  WC2026_SEASON_ID,
} from './constants';

export type FifaCalendarMatch = {
  IdMatch: string;
  IdCompetition: string;
  MatchNumber: number | null;
  Date: string;
  MatchTime: string | null;
  MatchStatus: number;
  Period?: number | null;
  HomeTeamScore: number | null;
  AwayTeamScore: number | null;
  Home: { TeamName?: { Locale?: string; Description?: string }[]; IdCountry?: string } | null;
  Away: { TeamName?: { Locale?: string; Description?: string }[]; IdCountry?: string } | null;
  BallPossession?: { OverallHome?: number; OverallAway?: number } | null;
};

export type FifaMatchInfo = FifaCalendarMatch & {
  HomeTeam?: FifaSideDetail;
  AwayTeam?: FifaSideDetail;
  Attendance?: string | null;
  Officials?: FifaOfficial[];
  Properties?: { IdIFES?: string | number | null } | null;
  Stadium?: { Name?: { Locale?: string; Description?: string }[] } | null;
  StageName?: { Locale?: string; Description?: string }[] | null;
  GroupName?: { Locale?: string; Description?: string }[] | null;
};

type FifaSideDetail = {
  Score?: number | null;
  IdTeam?: string;
  IdCountry?: string;
  Tactics?: string | null;
  TeamName?: { Locale?: string; Description?: string }[];
  Goals?: FifaGoal[];
  Bookings?: FifaBooking[];
  Substitutions?: FifaSubstitution[];
  Players?: FifaPlayer[];
};

type FifaGoal = {
  IdPlayer?: string;
  IdTeam?: string;
  Minute?: string;
  Period?: number;
  Type?: number;
  IdAssistPlayer?: string | null;
};

type FifaBooking = {
  IdPlayer?: string | null;
  IdCoach?: string | null;
  IdTeam?: string;
  Minute?: string;
  Period?: number;
  Card?: number;
};

type FifaSubstitution = {
  IdPlayer?: string;
  IdSubstitute?: string;
  IdTeam?: string;
  Minute?: string;
  Period?: number;
};

type FifaPlayer = {
  IdPlayer?: string;
  ShirtNumber?: number;
  PlayerName?: { Locale?: string; Description?: string }[];
  Status?: number;
};

type FifaOfficial = {
  OfficialType?: number;
  Name?: { Locale?: string; Description?: string }[];
  IdCountry?: string;
};

type CalendarResponse = { Results?: FifaCalendarMatch[] | null };

const DEFAULT_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en',
  Origin: 'https://www.fifa.com',
  Referer: 'https://www.fifa.com/',
  'User-Agent': 'wc-tactical-platform/1.0 (FIFA Match Centre sync)',
};

async function fifaFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${FIFA_API_BASE}/${path}`, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || text === 'null') return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function fetchFifaCalendarMatches(fromIso: string, toIso: string): Promise<FifaCalendarMatch[]> {
  const params = new URLSearchParams({
    from: fromIso,
    to: toIso,
    count: '500',
    language: 'en',
    IdSeason: WC2026_SEASON_ID,
  });
  const data = await fifaFetch<CalendarResponse>(`calendar/matches?${params}`);
  return (data?.Results ?? []).filter((m) => m.IdCompetition === WC2026_COMPETITION_ID);
}

/** Full WC2026 scores & fixtures window (same feed as FIFA scores-fixtures page). */
export async function fetchFifaWc2026FixturesCalendar(): Promise<FifaCalendarMatch[]> {
  const params = new URLSearchParams({
    from: WC2026_FIXTURES_FROM_ISO,
    to: WC2026_FIXTURES_TO_ISO,
    count: '500',
    language: 'en',
    IdSeason: WC2026_SEASON_ID,
  });
  const data = await fifaFetch<CalendarResponse>(`calendar/matches?${params}`);
  return (data?.Results ?? []).filter((m) => m.IdCompetition === WC2026_COMPETITION_ID);
}

export async function fetchFifaMatchInfo(fifaMatchId: string): Promise<FifaMatchInfo | null> {
  const params = new URLSearchParams({ idMatch: fifaMatchId, language: 'en' });
  return fifaFetch<FifaMatchInfo>(`live/football/getMatchInfo?${params}`);
}

export type FifaTimelineEvent = {
  EventId?: string;
  IdTeam?: string;
  IdPlayer?: string;
  MatchMinute?: string;
  Period?: number;
  Type?: number;
  TypeLocalized?: { Locale?: string; Description?: string }[];
  EventDescription?: { Locale?: string; Description?: string }[];
  HomeGoals?: number;
  AwayGoals?: number;
  GoalGatePositionX?: number | null;
  GoalGatePositionY?: number | null;
};

export type FifaTimelinePayload = {
  IdMatch?: string;
  Event?: FifaTimelineEvent[];
};

/** Match Centre live blog / timeline feed. */
export async function fetchFifaTimeline(fifaMatchId: string): Promise<FifaTimelinePayload | null> {
  const params = new URLSearchParams({ language: 'en' });
  return fifaFetch<FifaTimelinePayload>(`timelines/${fifaMatchId}?${params}`);
}

export type { FifaGoal, FifaBooking, FifaSubstitution, FifaPlayer, FifaSideDetail };
