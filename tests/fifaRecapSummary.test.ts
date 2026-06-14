import { describe, it, expect } from 'vitest';
import {
  buildFifaRecapSummaryEn,
  recapInputFromFifaInfo,
} from '../src/ingestion/fifa/generateFifaRecapSummary';
import type { FifaMatchInfo } from '../src/ingestion/fifa/fifaApiClient';
import type { ParsedCommentaryLine } from '../src/ingestion/fifa/parseFifaTimeline';

const sampleCommentary: ParsedCommentaryLine[] = [
  {
    id: 'c1',
    minute: 45,
    period: '1H',
    sortOrder: 1,
    textEn: 'GOAL! Korea Republic 1-0',
    eventType: 'goal',
  },
  {
    id: 'c2',
    minute: 90,
    period: 'FT',
    sortOrder: 2,
    textEn: 'Full time. Korea Republic 2-1 Czechia.',
    eventType: 'full_time',
  },
];

const sampleInfo: FifaMatchInfo = {
  IdMatch: '400021441',
  IdCompetition: '17',
  MatchNumber: 1,
  Date: '2026-06-11',
  MatchTime: '19:00',
  MatchStatus: 0,
  HomeTeamScore: 2,
  AwayTeamScore: 1,
  Home: { TeamName: [{ Locale: 'en-GB', Description: 'Korea Republic' }] },
  Away: { TeamName: [{ Locale: 'en-GB', Description: 'Czechia' }] },
  HomeTeam: { Score: 2, TeamName: [{ Locale: 'en-GB', Description: 'Korea Republic' }] },
  AwayTeam: { Score: 1, TeamName: [{ Locale: 'en-GB', Description: 'Czechia' }] },
  StageName: [{ Locale: 'en-GB', Description: 'Group' }],
  GroupName: [{ Locale: 'en-GB', Description: 'Group A' }],
  Stadium: { Name: [{ Locale: 'en-GB', Description: 'Mexico City Stadium' }] },
};

describe('generateFifaRecapSummary', () => {
  it('builds English recap from FIFA match info and timeline highlights', () => {
    const input = recapInputFromFifaInfo(sampleInfo, sampleCommentary, 58, 42);
    const summary = buildFifaRecapSummaryEn(input);

    expect(summary).toContain('Korea Republic beat Czechia 2-1');
    expect(summary).toContain('Group A');
    expect(summary).toContain('Mexico City Stadium');
    expect(summary).toContain("45': GOAL!");
    expect(summary).toContain('Possession 58–42');
  });

  it('handles draws without group suffix when stage is not Group', () => {
    const summary = buildFifaRecapSummaryEn({
      homeName: 'Brazil',
      awayName: 'Morocco',
      homeScore: 1,
      awayScore: 1,
      stage: 'Knockout',
      commentary: [],
    });

    expect(summary).toBe('Brazil and Morocco drew 1-1.');
  });
});
