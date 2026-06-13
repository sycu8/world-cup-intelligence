import type { ParsedTeamMatchStats } from '../fifa/parseFifaGamedayStats';

export type EspnStatRow = {
  name: string;
  displayValue: string;
};

export type EspnBoxscoreTeam = {
  team?: { displayName?: string };
  statistics?: EspnStatRow[];
};

export type EspnMatchSummary = {
  boxscore?: { teams?: EspnBoxscoreTeam[] };
};

function espnStatValue(stats: EspnStatRow[] | undefined, name: string): number | null {
  const hit = stats?.find((s) => s.name === name);
  if (!hit) return null;
  const v = Number.parseFloat(hit.displayValue);
  return Number.isFinite(v) ? v : null;
}

export function parseEspnTeamStats(stats: EspnStatRow[] | undefined): ParsedTeamMatchStats {
  const totalPasses = espnStatValue(stats, 'totalPasses');
  const passPct = espnStatValue(stats, 'passPct');
  let passAccuracy: number | null = null;
  if (passPct != null) {
    passAccuracy = Math.round(passPct * 1000) / 10;
  } else {
    const accurate = espnStatValue(stats, 'accuratePasses');
    if (totalPasses != null && accurate != null && totalPasses > 0) {
      passAccuracy = Math.round((accurate / totalPasses) * 1000) / 10;
    }
  }

  return {
    possession: espnStatValue(stats, 'possessionPct'),
    shots: espnStatValue(stats, 'totalShots'),
    shotsOnTarget: espnStatValue(stats, 'shotsOnTarget'),
    passes: totalPasses,
    passAccuracy,
  };
}

export function parseEspnBoxscoreTeams(
  summary: EspnMatchSummary,
  homeName: string,
  awayName: string,
): { home: ParsedTeamMatchStats | null; away: ParsedTeamMatchStats | null } {
  const teams = summary.boxscore?.teams ?? [];
  const homeRow = teams.find((t) => t.team?.displayName === homeName);
  const awayRow = teams.find((t) => t.team?.displayName === awayName);
  return {
    home: homeRow ? parseEspnTeamStats(homeRow.statistics) : null,
    away: awayRow ? parseEspnTeamStats(awayRow.statistics) : null,
  };
}
