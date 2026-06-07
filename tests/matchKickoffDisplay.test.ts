import { describe, expect, it } from 'vitest';
import {
  formatKickoffTime,
  localDateKey,
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
});
