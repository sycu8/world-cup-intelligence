import type { MatchRow, TeamRow } from '../db/schema';
import type { LineupFeatures, MatchFeatureInput, TeamFeatures } from '../models/probability/types';
import type { AppEnv } from '../env';
import {
  blendFormWithBase,
  getTeamFormSnapshot,
  type TeamFormSnapshot,
} from './teamFormStats';
import { buildLineupFeaturesFromPlayers } from './lineupFeatures';
import { predictionMatchState } from '../models/probability/matchState';
import { isWc2026HostTeam } from '../models/probability/matchContext';
import { loadStaffFeaturesForMatch } from './matchStaff';
import {
  hasUsableLiveStats,
  type LiveSideStats,
} from '../models/probability/liveMatchStatsModifier';
import {
  getWorldCupHeadToHeadBetween,
  summarizePairFromPerspective,
} from './matchHistory';
import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import {
  buildGroupPointsPressure,
  type GroupPointsPressureSnapshot,
} from '../models/probability/groupPointsPressure';
import {
  buildKnockoutCompetitiveSpirit,
  type KnockoutCompetitiveSpiritSnapshot,
} from '../models/probability/knockoutCompetitiveSpirit';
import { isKnockoutStage } from './matchLifecycle';
import type { GroupStageMatchRow } from './tournamentProgression';

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
  const state = predictionMatchState(match.status, match.minute, match.home_score, match.away_score);

  return {
    matchId: match.id,
    tournamentYear,
    stage: match.stage ?? 'Group',
    minute: state.minute,
    second: 0,
    homeTeam: teamToFeatures(home, homeForm),
    awayTeam: teamToFeatures(away, awayForm),
    currentScore: { home: state.home, away: state.away },
    sourceConfidence: formConfidence > 0 ? Math.max(baseConfidence, formConfidence) : baseConfidence,
    isHomeHost: isWc2026HostTeam(home.country_code),
    homeCountryCode: home.country_code ?? undefined,
    awayCountryCode: away.country_code ?? undefined,
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

  const { results = [] } = await db
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
    results,
    lineup.is_official === 1,
  );
}

async function loadLiveMatchStats(
  db: D1Database,
  match: MatchRow,
): Promise<import('../models/probability/liveMatchStatsModifier').LiveMatchStatsInput | undefined> {
  if (match.status !== 'live') return undefined;

  const { results } = await db
    .prepare(
      `SELECT team_id, possession, shots, shots_on_target, xg, passes, pass_accuracy
       FROM team_match_stats WHERE match_id = ?`,
    )
    .bind(match.id)
    .all<{
      team_id: string;
      possession: number | null;
      shots: number | null;
      shots_on_target: number | null;
      xg: number | null;
      passes: number | null;
      pass_accuracy: number | null;
    }>();

  const byTeam = new Map((results ?? []).map((row) => [row.team_id, row]));
  const homeRow = byTeam.get(match.home_team_id);
  const awayRow = byTeam.get(match.away_team_id);
  if (!homeRow && !awayRow) return undefined;

  const mapSide = (row: (typeof results)[number] | undefined): LiveSideStats => ({
    possession: row?.possession ?? null,
    shots: row?.shots ?? null,
    shotsOnTarget: row?.shots_on_target ?? null,
    xg: row?.xg ?? null,
    passes: row?.passes ?? null,
    passAccuracy: row?.pass_accuracy ?? null,
  });

  const home = mapSide(homeRow);
  const away = mapSide(awayRow);
  if (!hasUsableLiveStats(home, away)) return undefined;

  return {
    home,
    away,
    minute: match.minute ?? 0,
  };
}

async function loadGroupPointsPressure(
  db: D1Database,
  match: MatchRow,
): Promise<GroupPointsPressureSnapshot | undefined> {
  if (match.stage !== 'Group' || !match.group_code) return undefined;

  const { results } = await db
    .prepare(
      `SELECT group_code, home_team_id, away_team_id, home_score, away_score, status
       FROM matches
       WHERE tournament_id = ? AND stage = 'Group' AND group_code = ?`,
    )
    .bind(match.tournament_id ?? WC2026_TOURNAMENT_ID, match.group_code)
    .all<GroupStageMatchRow>();

  const snapshot = buildGroupPointsPressure(
    results ?? [],
    match.group_code,
    match.home_team_id,
    match.away_team_id,
  );
  if (!snapshot) return undefined;
  if (snapshot.homePressure <= 0 && snapshot.awayPressure <= 0) return undefined;
  return snapshot;
}

function loadKnockoutCompetitiveSpirit(
  match: MatchRow,
  home: TeamRow,
  away: TeamRow,
  homeForm?: TeamFormSnapshot | null,
  awayForm?: TeamFormSnapshot | null,
): KnockoutCompetitiveSpiritSnapshot | undefined {
  if (!isKnockoutStage(match.stage)) return undefined;
  const homeFeatures = teamToFeatures(home, homeForm);
  const awayFeatures = teamToFeatures(away, awayForm);
  return buildKnockoutCompetitiveSpirit(match.stage ?? 'Knockout', homeFeatures, awayFeatures);
}

export async function buildMatchFeaturesWithForm(
  env: AppEnv,
  match: MatchRow,
  home: TeamRow,
  away: TeamRow,
  tournamentYear: number,
): Promise<MatchFeatureInput> {
  const [homeForm, awayForm, homeLineup, awayLineup, staff, liveMatchStats, h2hMeetings, groupPointsPressure] =
    await Promise.all([
    getTeamFormSnapshot(env.DB, home.id, 6, match.tournament_id),
    getTeamFormSnapshot(env.DB, away.id, 6, match.tournament_id),
    loadLineupFeaturesForTeam(env.DB, match.id, home.id),
    loadLineupFeaturesForTeam(env.DB, match.id, away.id),
    loadStaffFeaturesForMatch(
      env,
      match.id,
      match.tournament_id,
      home.id,
      away.id,
      home.country_code,
      away.country_code,
    ),
    loadLiveMatchStats(env.DB, match),
    getWorldCupHeadToHeadBetween(env, home.id, away.id, match.id),
    loadGroupPointsPressure(env.DB, match),
  ]);

  const knockoutCompetitiveSpirit = loadKnockoutCompetitiveSpirit(
    match,
    home,
    away,
    homeForm,
    awayForm,
  );

  const features = buildMatchFeatures(match, home, away, tournamentYear, {
    home: homeForm,
    away: awayForm,
  });

  if (homeLineup) features.homeLineup = homeLineup;
  if (awayLineup) features.awayLineup = awayLineup;
  if (staff.homeCoach) features.homeCoach = staff.homeCoach;
  if (staff.awayCoach) features.awayCoach = staff.awayCoach;
  if (staff.referee) features.referee = staff.referee;
  if (liveMatchStats) features.liveMatchStats = liveMatchStats;

  features.homeFormMatchesPlayed = homeForm?.matchesPlayed ?? 0;
  features.awayFormMatchesPlayed = awayForm?.matchesPlayed ?? 0;

  if (h2hMeetings.length) {
    const summary = summarizePairFromPerspective(h2hMeetings, home.id, away.id);
    features.h2h = {
      totalMatches: summary.totalMatches,
      avgGoalsHome: summary.avgGoalsHome,
      avgGoalsAway: summary.avgGoalsAway,
    };
  }
  if (groupPointsPressure) features.groupPointsPressure = groupPointsPressure;
  if (knockoutCompetitiveSpirit) features.knockoutCompetitiveSpirit = knockoutCompetitiveSpirit;

  const lineupConfidence =
    (homeLineup ? 0.04 : 0) + (awayLineup ? 0.04 : 0);
  const staffConfidence =
    (staff.homeCoach ? 0.02 : 0) + (staff.awayCoach ? 0.02 : 0) + (staff.referee ? 0.015 : 0);
  if (lineupConfidence + staffConfidence > 0) {
    features.sourceConfidence = Math.min(
      0.98,
      features.sourceConfidence + lineupConfidence + staffConfidence,
    );
  }
  if (liveMatchStats) {
    features.sourceConfidence = Math.min(0.99, features.sourceConfidence + 0.03);
  }

  return features;
}
