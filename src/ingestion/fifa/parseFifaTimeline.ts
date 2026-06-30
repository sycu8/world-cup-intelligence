import { parseFifaMinute } from './parse';

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

export type ParsedCommentaryLine = {
  id: string;
  minute: number | null;
  period: string | null;
  sortOrder: number;
  textEn: string;
  eventType: string | null;
};

const COMMENTARY_EVENT_TYPES = new Set([
  'Goal!',
  'Goal',
  'Assist',
  'Substitution',
  'Yellow Card',
  'Red Card',
  'VAR',
  'Start Time',
  'End Time',
  'Coin Toss',
  'Penalty',
  'Own Goal',
  'Goal Prevention',
]);

/** FIFA timeline Period codes (Match Centre live blog). */
export function timelinePeriodLabel(period: number | null | undefined): string {
  switch (period) {
    case 3:
      return '1H';
    case 4:
      return 'HT';
    case 5:
      return '2H';
    case 6:
      return 'ET1';
    case 7:
      return 'ET2';
    case 8:
      return 'PEN';
    case 10:
      return 'FT';
    default:
      return 'PRE';
  }
}

export function eventTypeKey(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('attempt at goal')) return 'shot';
  if (lower.includes('goal prevention') || lower.includes('save')) return 'save';
  if (lower.includes('goal')) return 'goal';
  if (lower.includes('substitution')) return 'substitution';
  if (lower.includes('yellow')) return 'yellow_card';
  if (lower.includes('red')) return 'red_card';
  if (lower.includes('var')) return 'var';
  if (lower.includes('assist')) return 'assist';
  if (lower.includes('start')) return 'kickoff';
  if (lower.includes('end')) return 'full_time';
  if (lower.includes('coin')) return 'coin_toss';
  if (lower.includes('penalty')) return 'penalty';
  return lower.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'event';
}

function eventLabel(ev: FifaTimelineEvent): string {
  return (
    ev.TypeLocalized?.find((t) => t.Locale?.toLowerCase().startsWith('en'))?.Description ??
    ev.TypeLocalized?.[0]?.Description ??
    'Event'
  );
}

function eventText(ev: FifaTimelineEvent): string {
  return (
    ev.EventDescription?.find((t) => t.Locale?.toLowerCase().startsWith('en'))?.Description ??
    ev.EventDescription?.[0]?.Description ??
    eventLabel(ev)
  );
}

/** Build match commentary rows from FIFA `/timelines/{idMatch}` (Match Centre live blog feed). */
export function parseFifaTimelineCommentary(
  payload: FifaTimelinePayload,
  matchIdPrefix: string,
): ParsedCommentaryLine[] {
  const events = payload.Event ?? [];
  const lines: ParsedCommentaryLine[] = [];
  let seq = 0;

  for (const ev of events) {
    const label = eventLabel(ev);
    if (!COMMENTARY_EVENT_TYPES.has(label) && label !== 'Attempt at Goal') continue;

    const text = eventText(ev);
    if (!text.trim()) continue;

    seq += 1;
    lines.push({
      id: `mc-fifa-${matchIdPrefix}-${ev.EventId ?? seq}`,
      minute: ev.MatchMinute ? parseFifaMinute(ev.MatchMinute) : null,
      period: timelinePeriodLabel(ev.Period),
      sortOrder: seq,
      textEn: text,
      eventType: eventTypeKey(label),
    });
  }

  return lines;
}

/** Derive rough shot counts from timeline when Gameday stats are unavailable. */
export function deriveShotsFromTimeline(
  payload: FifaTimelinePayload,
  homeFifaTeamId: string,
  awayFifaTeamId: string,
): { homeShots: number; awayShots: number; homeSot: number; awaySot: number } {
  let homeShots = 0;
  let awayShots = 0;
  let homeSot = 0;
  let awaySot = 0;

  for (const ev of payload.Event ?? []) {
    const label = eventLabel(ev);
    if (label !== 'Attempt at Goal' || !ev.IdTeam) continue;
    const onTarget = ev.GoalGatePositionX != null || /on target/i.test(eventText(ev));
    if (ev.IdTeam === homeFifaTeamId) {
      homeShots += 1;
      if (onTarget) homeSot += 1;
    } else if (ev.IdTeam === awayFifaTeamId) {
      awayShots += 1;
      if (onTarget) awaySot += 1;
    }
  }

  return { homeShots, awayShots, homeSot, awaySot };
}
