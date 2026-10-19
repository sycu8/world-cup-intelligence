/** One wait between briefing polls. */
export const BRIEFING_POLL_INTERVAL_MS = 5000;
/**
 * How long the match page keeps asking. The old 24×5s window was 120s, the same
 * length as one AI call, so a briefing still in the queue was marked not ready.
 * This matches the 660s in-flight marker.
 */
export const BRIEFING_POLL_WINDOW_MS = 660_000;
export const BRIEFING_POLL_LIMIT = Math.ceil(BRIEFING_POLL_WINDOW_MS / BRIEFING_POLL_INTERVAL_MS);

export function nextBriefingPoll(input: {
  generating: boolean;
  briefingStatus?: string;
  attempt: number;
}): { generating: boolean; timedOut: boolean; continuePolling: boolean } {
  const ready = input.briefingStatus === 'ready' && !input.generating;
  const continuePolling = !ready && input.attempt < BRIEFING_POLL_LIMIT;
  const stillWaiting = continuePolling && (input.generating || input.briefingStatus === 'failed');
  return {
    generating: stillWaiting,
    timedOut: !ready && !continuePolling,
    continuePolling,
  };
}
