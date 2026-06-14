import type { FifaMatchInfo } from './fifaApiClient';
import { fifaLocalizedName } from './parse';
import type { ParsedCommentaryLine } from './parseFifaTimeline';

export type RecapSummaryInput = {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  stage?: string | null;
  groupCode?: string | null;
  venue?: string | null;
  commentary: ParsedCommentaryLine[];
  homePossession?: number | null;
  awayPossession?: number | null;
};

function resultPhrase(homeScore: number, awayScore: number, homeName: string, awayName: string): string {
  if (homeScore > awayScore) return `${homeName} beat ${awayName} ${homeScore}-${awayScore}`;
  if (awayScore > homeScore) return `${awayName} beat ${homeName} ${awayScore}-${homeScore}`;
  return `${homeName} and ${awayName} drew ${homeScore}-${awayScore}`;
}

function keyMoments(commentary: ParsedCommentaryLine[]): string[] {
  const picks: string[] = [];
  for (const line of commentary) {
    if (!line.textEn.trim()) continue;
    if (line.eventType === 'goal' || line.eventType === 'red_card' || line.eventType === 'full_time') {
      const minute = line.minute != null ? `${line.minute}'` : '';
      picks.push(minute ? `${minute}: ${line.textEn}` : line.textEn);
    }
    if (picks.length >= 4) break;
  }
  return picks;
}

/** Build an English match summary from FIFA Match Centre data (source for Vietnamese translation). */
export function buildFifaRecapSummaryEn(input: RecapSummaryInput): string {
  const parts: string[] = [];
  const stageBit = input.stage === 'Group' && input.groupCode ? ` (Group ${input.groupCode})` : '';
  const venueBit = input.venue ? ` at ${input.venue}` : '';

  parts.push(`${resultPhrase(input.homeScore, input.awayScore, input.homeName, input.awayName)}${stageBit}${venueBit}.`);

  const moments = keyMoments(input.commentary);
  if (moments.length) {
    parts.push(moments.join(' '));
  }

  if (input.homePossession != null && input.awayPossession != null) {
    parts.push(`Possession ${input.homePossession}–${input.awayPossession}.`);
  }

  return parts.join(' ').slice(0, 900);
}

export function recapInputFromFifaInfo(
  info: FifaMatchInfo,
  commentary: ParsedCommentaryLine[],
  homePossession?: number | null,
  awayPossession?: number | null,
): RecapSummaryInput {
  const homeName = fifaLocalizedName(info.HomeTeam?.TeamName ?? info.Home?.TeamName) || 'Home';
  const awayName = fifaLocalizedName(info.AwayTeam?.TeamName ?? info.Away?.TeamName) || 'Away';
  const homeScore = info.HomeTeam?.Score ?? info.HomeTeamScore ?? 0;
  const awayScore = info.AwayTeam?.Score ?? info.AwayTeamScore ?? 0;
  const venue = fifaLocalizedName(info.Stadium?.Name);

  return {
    homeName,
    awayName,
    homeScore: homeScore ?? 0,
    awayScore: awayScore ?? 0,
    stage: info.StageName?.[0]?.Description ?? null,
    groupCode: info.GroupName?.[0]?.Description?.replace(/^Group\s/i, '') ?? null,
    venue: venue || null,
    commentary,
    homePossession,
    awayPossession,
  };
}
