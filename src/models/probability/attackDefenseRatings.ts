import type { TeamFeatures } from './types';
import { teamAttackStrength, teamDefenseWeakness } from './teamStrength';

export type AttackDefenseRatings = {
  attack: number;
  /** Higher = concedes more goals (defensive leak). */
  defenseLeak: number;
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Separate attack and defense ratings with shrinkage when form sample is thin. */
export function deriveAttackDefenseRatings(
  team: TeamFeatures,
  formMatchesPlayed = 6,
): AttackDefenseRatings {
  const shrink = Math.max(0, (3 - formMatchesPlayed) / 3) * 0.35;
  const tourMean = 0.88;

  const atkFromXg = team.xgFor / 1.45;
  const atkFromElo = team.eloRating / 2000;
  const atkFromForm = 0.45 + team.recentForm * 0.4;
  const rawAttack = atkFromXg * 0.45 + atkFromElo * 0.35 + atkFromForm * 0.2;

  const defFromXga = team.xgAgainst / 1.35;
  const defCompact = 1.08 - team.defensiveCompactness * 0.1;
  const rawDefenseLeak = defFromXga * 0.62 + defCompact * 0.38;

  let attack = clamp(rawAttack * (1 - shrink) + tourMean * shrink, 0.45, 1.55);
  let defenseLeak = clamp(rawDefenseLeak * (1 - shrink) + tourMean * shrink, 0.55, 1.45);

  if (formMatchesPlayed < 4) {
    const bridge = ((4 - formMatchesPlayed) / 4) * 0.45;
    const v4Attack = teamAttackStrength(team);
    const v4DefLeak = teamDefenseWeakness(team);
    attack = attack * (1 - bridge) + v4Attack * bridge;
    defenseLeak = defenseLeak * (1 - bridge) + v4DefLeak * bridge;
  }

  return { attack, defenseLeak };
}
