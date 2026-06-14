import type { AppEnv } from '../env';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import type { TeamRow } from '../db/schema';
import { lineupModifier } from '../models/probability/playerAvailability';
import { isWc2026HostTeam } from '../models/probability/matchContext';
import { applyEffectiveTeamProfile } from './teamProfile';
import { loadHistoricalFormForTeams } from './teamFormStats';
import { buildLineupFeaturesFromPlayers } from './lineupFeatures';
import {
  loadGroupHalfTimeSignals,
  loadTournamentGroupFormForTeams,
  type HalfTimeSignal,
} from './tournamentMcSignals';

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
  attackRate: number;
  defenseRate: number;
  firstHalfLeadRate: number;
};

const HISTORICAL_FORM_WEIGHT = 0.35;
const TOURNAMENT_FORM_WEIGHT = 0.65;

function blendFormScore(a: number, b: number, hasTournament: boolean): number {
  if (!hasTournament) return a;
  return a * HISTORICAL_FORM_WEIGHT + b * TOURNAMENT_FORM_WEIGHT;
}

function attackDefenseRates(
  formGoalsFor: number,
  formGoalsAgainst: number,
  half: HalfTimeSignal | undefined,
  collectiveStrength: number,
  fifaRanking: number,
): { attackRate: number; defenseRate: number; firstHalfLeadRate: number } {
  const htAttack = (half?.firstHalfGoalsFor ?? 0.35) + (half?.secondHalfGoalsFor ?? 0.35) * 0.45;
  const htDefense = (half?.firstHalfGoalsAgainst ?? 0.35) + (half?.secondHalfGoalsAgainst ?? 0.35) * 0.3;
  const baseAttack = 0.85 + formGoalsFor * 0.42 + htAttack * 0.35;
  const baseDefense = 0.85 + formGoalsAgainst * 0.38 + htDefense * 0.3;
  const eliteAttackBoost = fifaRanking <= 12 ? 0.22 : fifaRanking <= 20 ? 0.12 : 0;
  const eliteDefenseBoost = fifaRanking <= 12 ? 0.08 : 0;

  return {
    attackRate: Math.max(0.55, Math.min(2.4, baseAttack + eliteAttackBoost + (collectiveStrength - 0.75) * 0.6)),
    defenseRate: Math.max(0.45, Math.min(1.8, baseDefense - eliteDefenseBoost - (collectiveStrength - 0.75) * 0.35)),
    firstHalfLeadRate: half?.firstHalfLeadRate ?? 0.22,
  };
}

function computeEffectiveRating(
  profile: Omit<TeamStrengthProfile, 'effectiveRating'>,
): number {
  const formBonus = (profile.recentForm - 0.5) * 220;
  const collectiveBonus = (profile.collectiveStrength - 0.75) * 420;
  const rankBonus = Math.max(-80, Math.min(80, (25 - profile.fifaRanking) * 3));
  const htBonus = (profile.firstHalfLeadRate - 0.25) * 120;
  const eliteBonus = profile.fifaRanking <= 12 ? 35 : profile.fifaRanking <= 20 ? 18 : 0;
  const base = profile.elo + formBonus + collectiveBonus + rankBonus + htBonus + eliteBonus;
  return base * profile.lineupModifier;
}

export function estimateTripleFromTeamStrength(
  home: TeamStrengthProfile,
  away: TeamStrengthProfile,
  knockout: boolean,
): { homeWin: number; draw: number; awayWin: number } {
  const homeAdv = home.isHost ? 55 : 28;
  const homeElo = home.effectiveRating + homeAdv + (home.firstHalfLeadRate - away.firstHalfLeadRate) * 80;
  const awayElo = away.effectiveRating + (away.attackRate - home.defenseRate) * 45;
  const expHome = 1 / (1 + 10 ** ((awayElo - homeElo) / 400));
  const draw = knockout ? 0.18 : 0.22;
  const scale = 1 - draw;
  const sum = expHome * scale + draw + (1 - expHome) * scale;
  return {
    homeWin: (expHome * scale) / sum,
    draw: draw / sum,
    awayWin: ((1 - expHome) * scale) / sum,
  };
}

async function loadLatestLineupFeaturesByTeam(
  db: D1Database,
  teamIds: string[],
): Promise<Map<string, ReturnType<typeof buildLineupFeaturesFromPlayers>>> {
  const out = new Map<string, ReturnType<typeof buildLineupFeaturesFromPlayers>>();
  if (!teamIds.length) return out;

  const chunkSize = 12;
  for (let offset = 0; offset < teamIds.length; offset += chunkSize) {
    const chunk = teamIds.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const { results: lineupMeta } = await db
      .prepare(
        `SELECT l.id, l.team_id, l.formation, l.is_official
         FROM lineups l
         INNER JOIN matches m ON m.id = l.match_id
         WHERE m.tournament_id = ? AND l.team_id IN (${placeholders})
         ORDER BY l.is_official DESC, m.kickoff_utc DESC`,
      )
      .bind(WC2026_TOURNAMENT_ID, ...chunk)
      .all<{ id: string; team_id: string; formation: string; is_official: number }>();

    const firstByTeam = new Map<string, { id: string; formation: string; isOfficial: boolean }>();
    for (const row of lineupMeta ?? []) {
      if (firstByTeam.has(row.team_id)) continue;
      firstByTeam.set(row.team_id, {
        id: row.id,
        formation: row.formation,
        isOfficial: row.is_official === 1,
      });
    }

    const lineupIds = [...firstByTeam.values()].map((v) => v.id);
    if (!lineupIds.length) continue;

    const lp = lineupIds.map(() => '?').join(',');
    const { results: playerRows } = await db
      .prepare(
        `SELECT lp.lineup_id, lp.is_starter, lp.position_slot, lp.role, p.position
         FROM lineup_players lp
         LEFT JOIN players p ON p.id = lp.player_id
         WHERE lp.lineup_id IN (${lp})`,
      )
      .bind(...lineupIds)
      .all<{
        lineup_id: string;
        is_starter: number;
        position_slot: string | null;
        role: string | null;
        position: string | null;
      }>();

    const playersByLineup = new Map<string, Parameters<typeof buildLineupFeaturesFromPlayers>[1]>();
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

    for (const [teamId, meta] of firstByTeam) {
      out.set(
        teamId,
        buildLineupFeaturesFromPlayers(
          meta.formation,
          playersByLineup.get(meta.id) ?? [],
          meta.isOfficial,
        ),
      );
    }
  }

  return out;
}

export async function loadTeamStrengthProfiles(
  env: AppEnv,
  teams: TeamRow[],
): Promise<Record<string, TeamStrengthProfile>> {
  const db = env.DB;
  const profiles: Record<string, TeamStrengthProfile> = {};
  const teamIds = teams.map((t) => t.id);

  const [historicalForm, tournamentForm, halfSignals, lineupByTeam] = await Promise.all([
    loadHistoricalFormForTeams(db, teamIds, 8, WC2026_TOURNAMENT_ID),
    loadTournamentGroupFormForTeams(db, teamIds, 4),
    loadGroupHalfTimeSignals(db, teamIds),
    loadLatestLineupFeaturesByTeam(db, teamIds),
  ]);

  for (const raw of teams) {
    const team = applyEffectiveTeamProfile(raw);
    const hist = historicalForm.get(team.id) ?? null;
    const current = tournamentForm.get(team.id) ?? null;
    const half = halfSignals.get(team.id);
    const lineupFeatures = lineupByTeam.get(team.id);

    const collectiveStrength = team.collective_strength_rating ?? 0.75;
    const hasTournament = !!current && current.matchesPlayed > 0;
    const recentForm = blendFormScore(
      hist?.recentForm ?? collectiveStrength - 0.5 + 0.5,
      current?.recentForm ?? hist?.recentForm ?? 0.5,
      hasTournament,
    );
    const goalsFor = blendFormScore(hist?.goalsForPerGame ?? 1.1, current?.goalsForPerGame ?? 1.1, hasTournament);
    const goalsAgainst = blendFormScore(
      hist?.goalsAgainstPerGame ?? 1.0,
      current?.goalsAgainstPerGame ?? 1.0,
      hasTournament,
    );
    const rates = attackDefenseRates(goalsFor, goalsAgainst, half, collectiveStrength, team.fifa_ranking ?? 40);

    const base: Omit<TeamStrengthProfile, 'effectiveRating'> = {
      teamId: team.id,
      elo: team.elo_rating ?? 1500,
      collectiveStrength,
      recentForm: Math.max(0.15, Math.min(0.95, recentForm)),
      fifaRanking: team.fifa_ranking ?? 40,
      lineupModifier: lineupModifier(lineupFeatures),
      countryCode: team.country_code ?? null,
      isHost: isWc2026HostTeam(team.country_code),
      ...rates,
    };

    profiles[team.id] = {
      ...base,
      effectiveRating: computeEffectiveRating(base),
    };
  }

  return profiles;
}
