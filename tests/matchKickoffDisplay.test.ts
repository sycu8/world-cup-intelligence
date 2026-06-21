import { describe, expect, it, vi } from 'vitest';
import {
  formatKickoffDate,
  formatKickoffDateLong,
  formatKickoffTime,
  getViewerTimezone,
  isVietnamTimezone,
  kickoffDisplayParts,
  localDateKey,
  timezoneShortLabel,
  VIETNAM_TZ,
} from '../app/lib/matchKickoffDisplay';

describe('matchKickoffDisplay', () => {
  it('maps opening match to Vietnam 02:00 on 12/06', () => {
    const kickoff = '2026-06-11T19:00:00Z';
    expect(formatKickoffTime(kickoff, VIETNAM_TZ, 'vi-VN')).toBe('02:00');
    expect(localDateKey(kickoff, VIETNAM_TZ)).toBe('2026-06-12');
  });

  it('groups by viewer local date', () => {
    const kickoff = '2026-06-11T19:00:00Z';
    expect(localDateKey(kickoff, 'America/New_York')).toMatch(/2026-06-11/);
  });

  it('formats long dates and detects Vietnam timezone', () => {
    const kickoff = '2026-06-11T19:00:00Z';
    expect(formatKickoffDateLong(kickoff, VIETNAM_TZ, 'en-US')).toMatch(/Jun/);
    expect(formatKickoffDate(kickoff, VIETNAM_TZ, 'vi-VN', { weekday: 'short' })).toBeTruthy();
    expect(isVietnamTimezone(VIETNAM_TZ)).toBe(true);
    expect(isVietnamTimezone('UTC')).toBe(false);
  });

  it('builds kickoff display parts with VN reference for non-VN viewers', () => {
    const kickoff = '2026-06-11T19:00:00Z';
    const foreign = kickoffDisplayParts(kickoff, 'America/New_York', 'en-US');
    expect(foreign.showVnReference).toBe(true);
    expect(foreign.vnTime).toBeTruthy();

    const local = kickoffDisplayParts(kickoff, VIETNAM_TZ, 'vi-VN');
    expect(local.showVnReference).toBe(false);
    expect(local.vnTime).toBeUndefined();
  });

  it('returns timezone short label and falls back when Intl fails', () => {
    expect(timezoneShortLabel(VIETNAM_TZ, 'en-US')).toBeTruthy();

    const original = Intl.DateTimeFormat;
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl unavailable');
    });
    expect(getViewerTimezone()).toBe(VIETNAM_TZ);
    Intl.DateTimeFormat = original;
  });

  it('falls back to short timezone name when offset parts are missing', () => {
    const original = Intl.DateTimeFormat;
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function MockDtf(
      this: Intl.DateTimeFormat,
      locale?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) {
      const real = new original(locale, options);
      if (options?.timeZoneName === 'shortOffset') {
        return {
          formatToParts: () => [{ type: 'literal', value: '' }],
        } as Intl.DateTimeFormat;
      }
      return real;
    });
    expect(timezoneShortLabel(VIETNAM_TZ, 'en-US')).toBeTruthy();
    Intl.DateTimeFormat = original;
  });
});
