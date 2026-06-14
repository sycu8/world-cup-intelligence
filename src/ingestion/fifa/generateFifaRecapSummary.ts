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

function scoreLine(homeScore: number, awayScore: number): string {
  return `${homeScore}-${awayScore}`;
}

function resultLead(input: RecapSummaryInput): string {
  const score = scoreLine(input.homeScore, input.awayScore);
  const stageBit = input.stage === 'Group' && input.groupCode ? ` in Group ${input.groupCode}` : '';
  const venueBit = input.venue ? ` at ${input.venue}` : '';

  if (input.homeScore > input.awayScore) {
    return `${input.homeName} beat ${input.awayName} ${score}${stageBit}${venueBit}.`;
  }
  if (input.awayScore > input.homeScore) {
    return `${input.awayName} beat ${input.homeName} ${score}${stageBit}${venueBit}.`;
  }
  return `${input.homeName} and ${input.awayName} drew ${score}${stageBit}${venueBit}.`;
}

function goalMoments(commentary: ParsedCommentaryLine[]): string[] {
  const picks: string[] = [];
  for (const line of commentary) {
    if (!line.textEn.trim()) continue;
    if (line.eventType !== 'goal' && line.eventType !== 'penalty_goal' && line.eventType !== 'own_goal') {
      continue;
    }
    const minute = line.minute != null ? `in the ${line.minute}th minute` : '';
    picks.push(minute ? `${line.textEn} (${minute})` : line.textEn);
    if (picks.length >= 3) break;
  }
  return picks;
}

function closingBeat(commentary: ParsedCommentaryLine[], input: RecapSummaryInput): string | null {
  const fullTime = commentary.find((line) => line.eventType === 'full_time');
  if (fullTime?.textEn.trim()) return fullTime.textEn.trim();

  if (input.homePossession != null && input.awayPossession != null) {
    const leader =
      input.homePossession > input.awayPossession
        ? input.homeName
        : input.awayPossession > input.homePossession
          ? input.awayName
          : null;
    if (leader) {
      return `${leader} had more of the ball (${Math.max(input.homePossession, input.awayPossession)}% possession).`;
    }
    return `Possession was even at ${input.homePossession}-${input.awayPossession}.`;
  }
  return null;
}

/** Build an English match summary from FIFA Match Centre data (source for Vietnamese translation). */
export function buildFifaRecapSummaryEn(input: RecapSummaryInput): string {
  const parts: string[] = [resultLead(input)];

  const goals = goalMoments(input.commentary);
  if (goals.length) {
    parts.push(`Key goals: ${goals.join('; ')}.`);
  }

  const close = closingBeat(input.commentary, input);
  if (close) parts.push(close);

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
