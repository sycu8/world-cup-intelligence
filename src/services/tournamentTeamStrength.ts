import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import type { TeamRow } from '../db/schema';
import { lineupModifier } from '../models/probability/playerAvailability';
import { isWc2026HostTeam } from '../models/probability/matchContext';
import { applyEffectiveTeamProfile } from './teamProfile';
import { loadHistoricalFormForTeams } from './teamFormStats';

export type TeamStrengthProfile = {
  teamId: string;
  elo: number;
  collectiveStrength: number;
  recentForm: number;
  fifaRanking: number;
  lineupModifier: number;
  countryCode: string | null;
  isHost: boolean;
  effectiveRating: number;
};

function computeEffectiveRating(profile: Omit<TeamStrengthProfile, 'effectiveRating'>): number {
  const formBonus = (profile.recentForm - 0.5) * 220;
  const collectiveBonus = (profile.collectiveStrength - 0.75) * 420;
  const rankBonus = Math.max(-80, Math.min(80, (25 - profile.fifaRanking) * 3));
  const base = profile.elo + formBonus + collectiveBonus + rankBonus;
  return base * profile.lineupModifier;
}

export function estimateTripleFromTeamStrength(
  home: TeamStrengthProfile,
  away: TeamStrengthProfile,
  knockout: boolean,
): { homeWin: number; draw: number; awayWin: number } {
  const homeAdv = home.isHost ? 55 : 25;
  const homeElo = home.effectiveRating + homeAdv;
  const awayElo = away.effectiveRating;
  const expHome = 1 / (1 + 10 ** ((awayElo - homeElo) / 400));
  const draw = knockout ? 0.2 : 0.24;
  const scale = 1 - draw;
  const sum = expHome * scale + draw + (1 - expHome) * scale;
  return {
    homeWin: (expHome * scale) / sum,
    draw: draw / sum,
    awayWin: ((1 - expHome) * scale) / sum,
  };
}

export async function loadTeamStrengthProfiles(
  env: AppEnv,
  teams: TeamRow[],
): Promise<Record<string, TeamStrengthProfile>> {
  const db = env.DB;
  const profiles: Record<string, TeamStrengthProfile> = {};
  const teamIds = teams.map((t) => t.id);
  const formByTeam = await loadHistoricalFormForTeams(db, teamIds, 8, WC2026_TOURNAMENT_ID);

  for (const raw of teams) {
    const team = applyEffectiveTeamProfile(raw);
    const historicalForm = formByTeam.get(team.id) ?? null;

    const collectiveStrength = team.collective_strength_rating ?? 0.75;
    const recentForm = historicalForm?.recentForm ?? collectiveStrength - 0.5 + 0.5;

    const base: Omit<TeamStrengthProfile, 'effectiveRating'> = {
      teamId: team.id,
      elo: team.elo_rating ?? 1500,
      collectiveStrength,
      recentForm: Math.max(0.15, Math.min(0.95, recentForm)),
      fifaRanking: team.fifa_ranking ?? 40,
      lineupModifier: lineupModifier(undefined),
      countryCode: team.country_code ?? null,
      isHost: isWc2026HostTeam(team.country_code),
    };

    profiles[team.id] = {
      ...base,
      effectiveRating: computeEffectiveRating(base),
    };
  }

  return profiles;
}
