import { describe, expect, it } from 'vitest';
import {
  BRIEFING_POLL_INTERVAL_MS,
  BRIEFING_POLL_LIMIT,
  BRIEFING_POLL_WINDOW_MS,
  nextBriefingPoll,
} from '../app/lib/briefingPoll';

describe('briefing page poll', () => {
  it('keeps polling past the old 120s window while a briefing is still generating', () => {
    expect(BRIEFING_POLL_WINDOW_MS).toBeGreaterThan(120_000);
    expect(BRIEFING_POLL_LIMIT * BRIEFING_POLL_INTERVAL_MS).toBe(BRIEFING_POLL_WINDOW_MS);
    const atOldLimit = nextBriefingPoll({ generating: true, briefingStatus: 'generating', attempt: 24 });
    expect(atOldLimit.continuePolling).toBe(true);
    expect(atOldLimit.timedOut).toBe(false);
    const done = nextBriefingPoll({
      generating: true,
      briefingStatus: 'generating',
      attempt: BRIEFING_POLL_LIMIT,
    });
    expect(done.continuePolling).toBe(false);
    expect(done.timedOut).toBe(true);
  });

  it('stops when the briefing is ready', () => {
    const ready = nextBriefingPoll({ generating: false, briefingStatus: 'ready', attempt: 2 });
    expect(ready.continuePolling).toBe(false);
    expect(ready.timedOut).toBe(false);
    expect(ready.generating).toBe(false);
  });
});