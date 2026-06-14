import { describe, expect, it, vi } from 'vitest';
import { fallbackBriefing } from '../src/ai/tacticalBriefing';

describe('site-wide fast load routes', () => {
  it('fallbackBriefing returns instantly without AI', () => {
    const briefing = fallbackBriefing({
      matchId: 'm1',
      probability: { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3 },
      aiFallback: false,
    });
    expect(briefing.matchId).toBe('m1');
    expect(briefing.probabilityExplanation.length).toBeGreaterThan(0);
  });

  it('deferNonCritical schedules work without blocking', async () => {
    vi.useFakeTimers();
    const { deferNonCritical } = await import('../app/lib/deferNonCritical');
    let ran = false;
    deferNonCritical(() => {
      ran = true;
    });
    expect(ran).toBe(false);
    await vi.runAllTimersAsync();
    expect(ran).toBe(true);
    vi.useRealTimers();
  });
});
