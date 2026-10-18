import { describe, it, expect } from 'vitest';
import { parseGamedayTeamStats, parseGamedayTeamsPayload } from '../src/ingestion/fifa/parseFifaGamedayStats';
import {
  deriveShotsFromTimeline,
  eventTypeKey,
  parseFifaTimelineCommentary,
  timelinePeriodLabel,
} from '../src/ingestion/fifa/parseFifaTimeline';

describe('parseFifaGamedayStats', () => {
  it('maps Gameday stat names to platform columns', () => {
    const stats = [
      { name: 'Possession', value: 58, isPostMatch: false },
      { name: 'AttemptAtGoal', value: 14, isPostMatch: false },
      { name: 'AttemptAtGoalOnTarget', value: 6, isPostMatch: false },
      { name: 'Passes', value: 420, isPostMatch: false },
      { name: 'PassesCompleted', value: 378, isPostMatch: false },
    ];
    expect(parseGamedayTeamStats(stats)).toEqual({
      possession: 58,
      shots: 14,
      shotsOnTarget: 6,
      passes: 420,
      passAccuracy: 90,
    });
  });

  it('parses teams.json keyed payload', () => {
    const teams = parseGamedayTeamsPayload({
      '43822': [
        ['Possession', 55, false],
        ['AttemptAtGoal', 12, false],
      ],
    });
    expect(teams).toHaveLength(1);
    expect(teams[0].idTeam).toBe('43822');
    expect(parseGamedayTeamStats(teams[0].stats).shots).toBe(12);
  });
});

describe('parseFifaTimeline', () => {
  const homeId = '43822';
  const awayId = '43995';

  const sampleTimeline = {
    IdMatch: '400021441',
    Event: [
      {
        EventId: '1',
        MatchMinute: "0'",
        Period: 3,
        TypeLocalized: [{ Locale: 'en-GB', Description: 'Start Time' }],
        EventDescription: [{ Locale: 'en-GB', Description: 'Kick-off' }],
      },
      {
        EventId: '2',
        IdTeam: homeId,
        MatchMinute: "12'",
        Period: 3,
        TypeLocalized: [{ Locale: 'en-GB', Description: 'Attempt at Goal' }],
        EventDescription: [{ Locale: 'en-GB', Description: 'H M SON attempts an effort on goal.' }],
      },
      {
        EventId: '3',
        IdTeam: homeId,
        MatchMinute: "12'",
        Period: 3,
        TypeLocalized: [{ Locale: 'en-GB', Description: 'Attempt at Goal' }],
        GoalGatePositionX: 59.3,
        EventDescription: [{ Locale: 'en-GB', Description: 'LEE Hanbeom attempts an effort on goal.' }],
      },
      {
        EventId: '4',
        IdTeam: awayId,
        MatchMinute: "22'",
        Period: 3,
        TypeLocalized: [{ Locale: 'en-GB', Description: 'Attempt at Goal' }],
        GoalGatePositionX: 79.6,
        EventDescription: [{ Locale: 'en-GB', Description: 'Soucek attempts an effort on goal.' }],
      },
      {
        EventId: '5',
        MatchMinute: "45'",
        Period: 3,
        TypeLocalized: [{ Locale: 'en-GB', Description: 'Goal!' }],
        EventDescription: [{ Locale: 'en-GB', Description: 'GOAL! Korea Republic 1-0' }],
      },
      {
        EventId: '6',
        MatchMinute: "78'",
        Period: 5,
        TypeLocalized: [{ Locale: 'en-GB', Description: 'VAR' }],
        EventDescription: [{ Locale: 'en-GB', Description: 'Goal disallowed' }],
      },
      {
        EventId: '7',
        MatchMinute: "84'",
        Period: 5,
        TypeLocalized: [{ Locale: 'en-GB', Description: 'Substitution' }],
        EventDescription: [
          { Locale: 'en-GB', Description: 'KIM Jingyu (in) replaces HWANG Inbeom (out) (Korea Republic)' },
        ],
      },
      {
        EventId: 'noise',
        MatchMinute: "10'",
        Period: 3,
        TypeLocalized: [{ Locale: 'en-GB', Description: 'Foul' }],
        EventDescription: [{ Locale: 'en-GB', Description: 'Foul committed' }],
      },
    ],
  };

  it('maps FIFA period codes', () => {
    expect(timelinePeriodLabel(3)).toBe('1H');
    expect(timelinePeriodLabel(5)).toBe('2H');
    expect(timelinePeriodLabel(10)).toBe('FT');
  });

  it('extracts commentary lines and skips non-blog events', () => {
    const lines = parseFifaTimelineCommentary(sampleTimeline, 'm1');
    expect(lines.length).toBe(7);
    expect(lines[0].eventType).toBe('kickoff');
    expect(lines.find((l) => l.eventType === 'goal')?.minute).toBe(45);
    expect(lines.find((l) => l.eventType === 'var')?.textEn).toContain('disallowed');
    expect(lines.every((l) => l.id.startsWith('mc-fifa-m1-'))).toBe(true);
  });

  it('derives shot counts from timeline attempts', () => {
    const counts = deriveShotsFromTimeline(sampleTimeline, homeId, awayId);
    expect(counts.homeShots).toBe(2);
    expect(counts.homeSot).toBe(1);
    expect(counts.awayShots).toBe(1);
    expect(counts.awaySot).toBe(1);
  });

  it('normalizes unknown commentary labels to snake_case keys', () => {
    expect(eventTypeKey('Highlight Moment')).toBe('highlight_moment');
    expect(eventTypeKey('!!!')).toBe('event');
  });
});
