/** Normalize team labels for fuzzy ESPN ↔ platform matching. */
export function normalizeTeamLabel(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const PLATFORM_TO_ESPN_ALIASES: Record<string, string[]> = {
  'bosnia and herzegovina': ['bosnia herzegovina', 'bosnia herz'],
  'korea republic': ['south korea', 'korea republic'],
  'usa': ['united states'],
  'cote d ivoire': ['ivory coast', 'cote d ivoire'],
  'curacao': ['curacao', 'curaçao'],
};

export function teamLabelsMatch(platformName: string, espnName: string): boolean {
  const p = normalizeTeamLabel(platformName);
  const e = normalizeTeamLabel(espnName);
  if (!p || !e) return false;
  if (p === e || e.includes(p) || p.includes(e)) return true;

  for (const alias of PLATFORM_TO_ESPN_ALIASES[p] ?? []) {
    const a = normalizeTeamLabel(alias);
    if (e === a || e.includes(a) || a.includes(e)) return true;
  }
  return false;
}

export type EspnScoreboardEvent = {
  id: string;
  date: string;
  competitions?: {
    competitors?: { homeAway?: string; team?: { displayName?: string } }[];
  }[];
};

/** Find ESPN event id for a platform match on kickoff day (±1 day). */
export function findEspnEventId(
  events: EspnScoreboardEvent[],
  homeName: string,
  awayName: string,
): string | null {
  for (const event of events) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === 'home')?.team?.displayName;
    const away = competitors.find((c) => c.homeAway === 'away')?.team?.displayName;
    if (!home || !away) continue;
    if (teamLabelsMatch(homeName, home) && teamLabelsMatch(awayName, away)) {
      return event.id;
    }
  }
  return null;
}
