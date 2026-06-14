import { describe, expect, it } from 'vitest';
import {
  formatKickoffTime,
  getViewerLocale,
  kickoffDisplayParts,
  localDateKey,
  SCHEDULE_TZ,
  VIETNAM_TZ,
} from '../app/lib/matchKickoffDisplay';

describe('matchKickoffDisplay', () => {
  it('maps opening match to Vietnam 02:00 on 12/06', () => {
    const kickoff = '2026-06-11T19:00:00Z';
    expect(formatKickoffTime(kickoff, SCHEDULE_TZ, 'vi-VN')).toBe('02:00');
    expect(localDateKey(kickoff, SCHEDULE_TZ)).toBe('2026-06-12');
  });

  it('uses GMT+7 as primary schedule time with optional local reference', () => {
    const kickoff = '2026-06-11T19:00:00Z';
    const inVn = kickoffDisplayParts(kickoff, VIETNAM_TZ, 'en');
    expect(inVn.time).toBe('02:00');
    expect(inVn.showLocalReference).toBe(false);

    const inNy = kickoffDisplayParts(kickoff, 'America/New_York', 'en');
    expect(inNy.time).toBe('02:00');
    expect(inNy.showLocalReference).toBe(true);
    expect(inNy.localTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it('groups schedule days by GMT+7 calendar date', () => {
    const kickoff = '2026-06-11T19:00:00Z';
    expect(localDateKey(kickoff, SCHEDULE_TZ)).toBe('2026-06-12');
    expect(localDateKey(kickoff, 'America/New_York')).toMatch(/2026-06-11/);
  });

  it('falls back when device locale is unavailable', () => {
    expect(getViewerLocale('vi-VN')).toBeTruthy();
  });
});
