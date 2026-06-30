import type { ProbabilityCalibration } from './calibration';
import type { TeamFeatures } from './types';

/** Knockout mentality: both sides play to win in regulation — draws are not a target. */
export type KnockoutCompetitiveSpiritSnapshot = {
  /** Round weight 0–1 (R32 → Final). */
  roundIntensity: number;
  /** Home must-win competitive drive 0–1. */
  homeSpirit: number;
  /** Away must-win competitive drive 0–1. */
  awaySpirit: number;
  /** Combined elimination intensity — both teams push for victory, not a draw. */
  mustWinIntensity: number;
};

function stageRoundIntensity(stage: string): number {
  const s = stage.toLowerCase();
  if (s.includes('final') && !s.includes('third')) return 1;
  if (s.includes('semi')) return 0.93;
  if (s.includes('quarter')) return 0.88;
  if (s.includes('round of 16')) return 0.82;
  if (s.includes('round of 32') || s.includes('1/16')) return 0.75;
  if (s.includes('third')) return 0.85;
  return 0.78;
}

function sideCompetitiveSpirit(
  team: TeamFeatures,
  opponent: TeamFeatures,
  roundIntensity: number,
): number {
  const rankGap = opponent.fifaRanking - team.fifaRanking;
  const underdogBoost = rankGap >= 12 ? Math.min(0.2, (rankGap - 11) * 0.014) : 0;
  const favoriteEdge = rankGap <= -18 ? Math.min(0.06, (-rankGap - 17) * 0.004) : 0;
  const formBoost = Math.max(0, team.recentForm) * 0.1;
  const base = 0.84 + roundIntensity * 0.12;
  return Math.min(1, base + underdogBoost + favoriteEdge + formBoost);
}

/** Build knockout competitive-spirit snapshot for elimination matches. */
export function buildKnockoutCompetitiveSpirit(
  stage: string,
  homeTeam: TeamFeatures,
  awayTeam: TeamFeatures,
): KnockoutCompetitiveSpiritSnapshot {
  const roundIntensity = stageRoundIntensity(stage);
  const homeSpirit = sideCompetitiveSpirit(homeTeam, awayTeam, roundIntensity);
  const awaySpirit = sideCompetitiveSpirit(awayTeam, homeTeam, roundIntensity);
  const mustWinIntensity = Math.min(1, ((homeSpirit + awaySpirit) / 2) * (0.72 + roundIntensity * 0.28));

  return { roundIntensity, homeSpirit, awaySpirit, mustWinIntensity };
}

export function knockoutCompetitiveSpiritModifier(
  snapshot: KnockoutCompetitiveSpiritSnapshot | undefined,
  calibration: ProbabilityCalibration,
): { home: number; away: number; drawInflationAdjust: number } {
  if (!snapshot) return { home: 1, away: 1, drawInflationAdjust: 0 };

  const spiritScale = 0.65 + snapshot.roundIntensity * 0.35;
  const home = 1 + snapshot.homeSpirit * calibration.knockoutSpiritMax * spiritScale;
  const away = 1 + snapshot.awaySpirit * calibration.knockoutSpiritMax * spiritScale;
  const drawInflationAdjust = -snapshot.mustWinIntensity * calibration.knockoutSpiritDrawDampen;

  return { home, away, drawInflationAdjust };
}
