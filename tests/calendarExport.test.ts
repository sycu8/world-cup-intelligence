import { describe, expect, it } from 'vitest';
import { buildMatchIcsEvent, buildScheduleIcs, googleCalendarUrl } from '../app/lib/calendarExport';
import type { ScheduleMatch } from '../app/lib/api';

const sample: ScheduleMatch = {
  id: 'm-test',
  kickoff_utc: '2026-06-11T19:00:00Z',
  status: 'scheduled',
  stage: 'Group',
  group_code: 'A',
  home_score: 0,
  away_score: 0,
  home_name: 'United States',
  away_name: 'Mexico',
};

describe('calendarExport', () => {
  it('builds a valid VEVENT block', () => {
    const event = buildMatchIcsEvent(sample);
    expect(event).toContain('BEGIN:VEVENT');
    expect(event).toContain('SUMMARY:United States vs Mexico');
    expect(event).toContain('DTSTART:20260611T190000Z');
  });

  it('wraps matches in VCALENDAR', () => {
    const ics = buildScheduleIcs([sample]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('United States vs Mexico');
  });

  it('builds google calendar url', () => {
    const url = googleCalendarUrl(sample);
    expect(url).toContain('calendar.google.com');
    expect(url).toContain(encodeURIComponent('United States vs Mexico'));
  });
});
