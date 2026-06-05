import type { MatchRow, TeamRow } from '../db/schema';
import type { LineupFeatures, MatchFeatureInput, TeamFeatures } from '../models/probability/types';
import type { AppEnv } from '../env';
import {
  blendFormWithBase,
  getTeamFormSnapshot,
  type TeamFormSnapshot,
} from './teamFormStats';
import { buildLineupFeaturesFromPlayers } from './lineupFeatures';

function teamToFeatures(team: TeamRow, form?: TeamFormSnapshot | null): TeamFeatures {
  const elo = team.elo_rating ?? 1700;
  const rank = team.fifa_ranking ?? 20;
  const strength = team.collective_strength_rating ?? 0.75;
  const recentForm = form?.recentForm ?? strength - 0.5;
  const xgFor = form ? blendFormWithBase(1.2 + strength * 0.5, form.xgForPerGame) : 1.2 + strength * 0.5;
  const xgAgainst = form
    ? blendFormWithBase(1.1 - strength * 0.3, form.xgAgainstPerGame)
    : 1.1 - strength * 0.3;
  const xgDiff = xgFor - xgAgainst;

  return {
    teamId: team.id,
    eloRating: elo,
    fifaRanking: rank,
    recentForm,
    goalDifference: form
      ? form.goalsForPerGame - form.goalsAgainstPerGame
      : (strength - 0.5) * 10,
    xgDifference: xgDiff,
    xgFor,
    xgAgainst,
    possessionProfile: 0.45 + strength * 0.2,
    fieldTilt: 0.5 + (strength - 0.5) * 0.3,
    ppda: 10 - strength * 3,
    highTurnovers: strength * 0.8,
    transitionThreat: strength * 0.7,
    setPieceXg: 0.2 + strength * 0.15,
    setPieceXga: 0.18,
    defensiveCompactness: strength,
    formationStability: strength,
    benchDepth: strength * 0.9,
    goalkeeperStrength: strength * 0.85,
    restDays: 4,
  };
}

export function buildMatchFeatures(
  match: MatchRow,
  home: TeamRow,
  away: TeamRow,
  tournamentYear: number,
  form?: { home?: TeamFormSnapshot | null; away?: TeamFormSnapshot | null },
): MatchFeatureInput {
  const homeForm = form?.home;
  const awayForm = form?.away;
  const formConfidence = Math.max(
    homeForm?.sourceConfidence ?? 0,
    awayForm?.sourceConfidence ?? 0,
  );
  const baseConfidence = tournamentYear >= 2026 ? 0.88 : 0.82;

  return {
    matchId: match.id,
    tournamentYear,
    stage: match.stage ?? 'Group',
    minute: match.minute,
    second: 0,
    homeTeam: teamToFeatures(home, homeForm),
    awayTeam: teamToFeatures(away, awayForm),
    currentScore: { home: match.home_score, away: match.away_score },
    sourceConfidence: formConfidence > 0 ? Math.max(baseConfidence, formConfidence) : baseConfidence,
  };
}

async function loadLineupFeaturesForTeam(
  db: D1Database,
  matchId: string,
  teamId: string,
): Promise<LineupFeatures | undefined> {
  const lineup = await db
    .prepare(
      `SELECT id, formation, is_official FROM lineups WHERE match_id = ? AND team_id = ?`,
    )
    .bind(matchId, teamId)
    .first<{ id: string; formation: string; is_official: number }>();

  if (!lineup) return undefined;

  const { results } = await db
    .prepare(
      `SELECT lp.is_starter, lp.position_slot, lp.role, p.position
       FROM lineup_players lp
       LEFT JOIN players p ON p.id = lp.player_id
       WHERE lp.lineup_id = ?`,
    )
    .bind(lineup.id)
    .all<{
      is_starter: number;
      position_slot: string | null;
      role: string | null;
      position: string | null;
    }>();

  return buildLineupFeaturesFromPlayers(
    lineup.formation,
    results ?? [],
    lineup.is_official === 1,
  );
}

export async function buildMatchFeaturesWithForm(
  env: AppEnv,
  match: MatchRow,
  home: TeamRow,
  away: TeamRow,
  tournamentYear: number,
): Promise<MatchFeatureInput> {
  const [homeForm, awayForm, homeLineup, awayLineup] = await Promise.all([
    getTeamFormSnapshot(env.DB, home.id),
    getTeamFormSnapshot(env.DB, away.id),
    loadLineupFeaturesForTeam(env.DB, match.id, home.id),
    loadLineupFeaturesForTeam(env.DB, match.id, away.id),
  ]);

  const features = buildMatchFeatures(match, home, away, tournamentYear, {
    home: homeForm,
    away: awayForm,
  });

  if (homeLineup) features.homeLineup = homeLineup;
  if (awayLineup) features.awayLineup = awayLineup;

  const lineupConfidence =
    (homeLineup ? 0.04 : 0) + (awayLineup ? 0.04 : 0);
  if (lineupConfidence > 0) {
    features.sourceConfidence = Math.min(0.98, features.sourceConfidence + lineupConfidence);
  }

  return features;
}
