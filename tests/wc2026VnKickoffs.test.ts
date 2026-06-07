import { describe, expect, it } from 'vitest';
import { kickoffUtcForFifaNumber, vnKickoffToUtc } from '../scripts/wc2026-vn-kickoffs.mjs';

describe('wc2026 VN kickoffs', () => {
  it('converts VN date/time to UTC', () => {
    expect(vnKickoffToUtc('12/06', '02:00')).toBe('2026-06-11T19:00:00Z');
    expect(vnKickoffToUtc('12/06', '09:00')).toBe('2026-06-12T02:00:00Z');
  });

  it('has all 104 FIFA match kickoffs', () => {
    expect(() => kickoffUtcForFifaNumber(1)).not.toThrow();
    expect(() => kickoffUtcForFifaNumber(104)).not.toThrow();
    expect(kickoffUtcForFifaNumber(1)).toBe('2026-06-11T19:00:00Z');
  });
});
