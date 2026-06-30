import { describe, expect, it, vi } from 'vitest';
import {
  buildMatchIcsEvent,
  buildScheduleIcs,
  downloadMatchIcs,
  downloadScheduleIcs,
  downloadTextFile,
  googleCalendarUrl,
} from '../app/lib/calendarExport';
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

const knockout: ScheduleMatch = {
  ...sample,
  id: 'm-ko',
  group_code: undefined,
  stage: 'Round of 16',
  home_name: 'Team; Alpha',
  away_name: 'Team, Beta',
};

describe('calendarExport', () => {
  it('builds a valid VEVENT block', () => {
    const event = buildMatchIcsEvent(sample);
    expect(event).toContain('BEGIN:VEVENT');
    expect(event).toContain('SUMMARY:United States vs Mexico');
    expect(event).toContain('DTSTART:20260611T190000Z');
    expect(event).toContain('Group A');
  });

  it('uses stage label when group code is missing', () => {
    const event = buildMatchIcsEvent(knockout);
    expect(event).toContain('Round of 16');
  });

  it('escapes special characters in ICS fields', () => {
    const event = buildMatchIcsEvent(knockout);
    expect(event).toContain('Team\\; Alpha vs Team\\, Beta');
  });

  it('wraps matches in VCALENDAR', () => {
    const ics = buildScheduleIcs([sample]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('United States vs Mexico');
  });

  it('builds google calendar url with stage details', () => {
    const url = googleCalendarUrl(sample);
    expect(url).toContain('calendar.google.com');
    expect(url).toContain(encodeURIComponent('United States vs Mexico'));
    expect(url).toContain(encodeURIComponent('Group A'));

    const koUrl = googleCalendarUrl(knockout);
    expect(koUrl).toContain(encodeURIComponent('Round of 16'));

    const bare = { ...sample, group_code: undefined, stage: undefined };
    const bareEvent = buildMatchIcsEvent(bare);
    expect(bareEvent).toContain('World Cup 2026');
    expect(googleCalendarUrl(bare)).toContain(encodeURIComponent('FIFA World Cup 2026'));
  });

  it('downloads text and calendar files via blob anchor', () => {
    const click = vi.fn();
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:ics');
    const anchor = { click, href: '', download: '' } as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    downloadTextFile('test.ics', 'BEGIN:VCALENDAR', 'text/calendar');
    downloadScheduleIcs([sample], 'schedule.ics');
    downloadMatchIcs(sample);

    expect(click).toHaveBeenCalledTimes(3);
    expect(revoke).toHaveBeenCalledTimes(3);
  });
});
