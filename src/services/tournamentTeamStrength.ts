import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import type { TeamRow } from '../db/schema';
import { lineupModifier } from '../models/probability/playerAvailability';
import { isWc2026HostTeam } from '../models/probability/matchContext';
import { applyEffectiveTeamProfile } from './teamProfile';
import { getTeamHistoricalFormSnapshot } from './teamFormStats';
import { buildLineupFeaturesFromPlayers } from './lineupFeatures';

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

  const formByTeam = new Map<string, Awaited<ReturnType<typeof getTeamHistoricalFormSnapshot>>>();
  await Promise.all(
    teamIds.map(async (teamId) => {
      formByTeam.set(teamId, await getTeamHistoricalFormSnapshot(db, teamId, 8, WC2026_TOURNAMENT_ID));
    }),
  );

  const firstLineupByTeam = new Map<string, { id: string; formation: string; isOfficial: boolean }>();
  if (teamIds.length) {
    const placeholders = teamIds.map(() => '?').join(',');
    const { results: lineupMeta } = await db
      .prepare(
        `SELECT l.id, l.team_id, l.formation, l.is_official, m.kickoff_utc
         FROM lineups l
         INNER JOIN matches m ON m.id = l.match_id
         WHERE m.tournament_id = ? AND l.team_id IN (${placeholders})
         ORDER BY l.is_official DESC, m.kickoff_utc DESC`,
      )
      .bind(WC2026_TOURNAMENT_ID, ...teamIds)
      .all<{ id: string; team_id: string; formation: string; is_official: number }>();

    for (const row of lineupMeta ?? []) {
      if (firstLineupByTeam.has(row.team_id)) continue;
      firstLineupByTeam.set(row.team_id, {
        id: row.id,
        formation: row.formation,
        isOfficial: row.is_official === 1,
      });
    }
  }

  const lineupIds = [...firstLineupByTeam.values()].map((v) => v.id);
  const playersByLineup = new Map<string, Parameters<typeof buildLineupFeaturesFromPlayers>[1]>();
  if (lineupIds.length) {
    const placeholders = lineupIds.map(() => '?').join(',');
    const { results: playerRows } = await db
      .prepare(
        `SELECT lp.lineup_id, lp.is_starter, lp.position_slot, lp.role, p.position
         FROM lineup_players lp
         LEFT JOIN players p ON p.id = lp.player_id
         WHERE lp.lineup_id IN (${placeholders})`,
      )
      .bind(...lineupIds)
      .all<{
        lineup_id: string;
        is_starter: number;
        position_slot: string | null;
        role: string | null;
        position: string | null;
      }>();

    for (const row of playerRows ?? []) {
      const bucket = playersByLineup.get(row.lineup_id) ?? [];
      bucket.push({
        is_starter: row.is_starter,
        position_slot: row.position_slot,
        role: row.role,
        position: row.position,
      });
      playersByLineup.set(row.lineup_id, bucket);
    }
  }

  for (const raw of teams) {
    const team = applyEffectiveTeamProfile(raw);
    const historicalForm = formByTeam.get(team.id) ?? null;
    const lineupEntry = firstLineupByTeam.get(team.id);
    const lineupFeatures = lineupEntry
      ? buildLineupFeaturesFromPlayers(
          lineupEntry.formation,
          playersByLineup.get(lineupEntry.id) ?? [],
          lineupEntry.isOfficial,
        )
      : undefined;

    const collectiveStrength = team.collective_strength_rating ?? 0.75;
    const recentForm = historicalForm?.recentForm ?? collectiveStrength - 0.5 + 0.5;

    const base: Omit<TeamStrengthProfile, 'effectiveRating'> = {
      teamId: team.id,
      elo: team.elo_rating ?? 1500,
      collectiveStrength,
      recentForm: Math.max(0.15, Math.min(0.95, recentForm)),
      fifaRanking: team.fifa_ranking ?? 40,
      lineupModifier: lineupModifier(lineupFeatures),
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
