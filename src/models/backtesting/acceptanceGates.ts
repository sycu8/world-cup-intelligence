import type { OfflineBacktestReport } from './offlineBacktest';

export type AcceptanceGate = {
  name: string;
  passed: boolean;
  v4: number | null;
  v5: number | null;
  rule: string;
};

export type AcceptanceGateResult = {
  passed: boolean;
  gates: AcceptanceGate[];
};

function gate(
  name: string,
  passed: boolean,
  v4: number | null,
  v5: number | null,
  rule: string,
): AcceptanceGate {
  return { name, passed, v4, v5, rule };
}

/** Holdout acceptance gates — v5 must not regress vs wc-prob-v4 baseline. */
export function evaluateAcceptanceGates(
  v4: OfflineBacktestReport,
  v5: OfflineBacktestReport,
): AcceptanceGateResult {
  const gates: AcceptanceGate[] = [
    gate(
      'avgBrier',
      (v5.avgBrier ?? 1) <= (v4.avgBrier ?? 1),
      v4.avgBrier,
      v5.avgBrier,
      'v5 avgBrier ≤ v4',
    ),
    gate(
      'favoriteHitRate',
      (v5.favoriteHitRate ?? 0) >= (v4.favoriteHitRate ?? 0),
      v4.favoriteHitRate,
      v5.favoriteHitRate,
      'v5 favoriteHitRate ≥ v4',
    ),
    gate(
      'scorelineTop3Rate',
      (v5.scorelineTop3Rate ?? 0) > (v4.scorelineTop3Rate ?? 0),
      v4.scorelineTop3Rate,
      v5.scorelineTop3Rate,
      'v5 scorelineTop3Rate > v4',
    ),
  ];

  return {
    passed: gates.every((g) => g.passed),
    gates,
  };
}
