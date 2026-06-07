import { describe, expect, it } from 'vitest';
import { getCountdownParts } from '../app/lib/useCountdown';

describe('getCountdownParts', () => {
  it('computes remaining time until target', () => {
    const now = Date.parse('2026-06-04T12:00:00Z');
    const parts = getCountdownParts('2026-06-11T19:00:00Z', now);
    expect(parts.days).toBe(7);
    expect(parts.hours).toBe(7);
    expect(parts.expired).toBe(false);
  });

  it('marks expired when target passed', () => {
    const parts = getCountdownParts('2020-01-01T00:00:00Z', Date.now());
    expect(parts.expired).toBe(true);
    expect(parts.days).toBe(0);
  });
});
