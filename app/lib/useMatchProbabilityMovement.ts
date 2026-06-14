import { useEffect, useState } from 'react';
import { api, type ProbabilityData, type ProbabilityMovementPayload } from './api';

const MOVEMENT_REFRESH_MS = 30_000;

/** Shared probability-movement fetch — one poll per match page instead of duplicate panel requests. */
export function useMatchProbabilityMovement(
  matchId: string | undefined,
  prob: ProbabilityData | null,
) {
  const [movement, setMovement] = useState<ProbabilityMovementPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) {
      setMovement(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = (trackLoading: boolean) => {
      if (trackLoading) setLoading(true);
      return api
        .matchProbabilityMovement(matchId)
        .then((r) => {
          if (!cancelled) setMovement(r.data);
        })
        .catch(() => {
          if (!cancelled) setMovement(null);
        })
        .finally(() => {
          if (!cancelled && trackLoading) setLoading(false);
        });
    };

    load(true);
    const timer = setInterval(() => {
      load(false);
    }, MOVEMENT_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [matchId, prob?.homeWinProb, prob?.drawProb, prob?.awayWinProb]);

  return { movement, loading };
}
