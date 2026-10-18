export type LiveSideStats = {
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  xg: number | null;
  passes: number | null;
  passAccuracy: number | null;
};

export type LiveMatchStatsInput = {
  home: LiveSideStats;
  away: LiveSideStats;
  minute: number;
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function attackSignal(side: LiveSideStats): number {
  const xg = side.xg ?? (side.shotsOnTarget ?? 0) * 0.11 + (side.shots ?? 0) * 0.04;
  const shotQuality = (side.shotsOnTarget ?? 0) / Math.max(1, side.shots ?? 1);
  const passQuality = (side.passAccuracy ?? 0) / 100;
  return xg * 1.15 + shotQuality * 0.35 + passQuality * 0.2;
}

/** Adjust live W/D/L lambdas from in-match team stats (possession, xG, shots). */
export function liveMatchStatsModifier(input: LiveMatchStatsInput): { home: number; away: number } {
  if (input.minute <= 0) return { home: 1, away: 1 };

  const homePoss = input.home.possession;
  const awayPoss = input.away.possession;
  const hasPossession = homePoss != null && awayPoss != null && homePoss + awayPoss > 10;
  const possessionEdge = hasPossession ? (homePoss - awayPoss) / 100 : 0;

  const homeAttack = attackSignal(input.home);
  const awayAttack = attackSignal(input.away);
  const attackTotal = Math.max(0.15, homeAttack + awayAttack);
  const attackEdge = (homeAttack - awayAttack) / attackTotal;

  const minuteWeight = clamp(input.minute / 90, 0.15, 1);
  const homeBoost = 1 + (possessionEdge * 0.22 + attackEdge * 0.42) * minuteWeight;
  const awayBoost = 1 - (possessionEdge * 0.22 + attackEdge * 0.42) * minuteWeight;

  return {
    home: clamp(homeBoost, 0.78, 1.28),
    away: clamp(awayBoost, 0.78, 1.28),
  };
}

export function hasUsableLiveStats(home: LiveSideStats, away: LiveSideStats): boolean {
  const signal = (side: LiveSideStats) =>
    (side.possession ?? 0) > 0 ||
    (side.shots ?? 0) > 0 ||
    (side.shotsOnTarget ?? 0) > 0 ||
    (side.xg ?? 0) > 0 ||
    (side.passes ?? 0) > 0;
  return signal(home) || signal(away);
}
