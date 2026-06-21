import type { AppEnv } from '../env';
import * as matchesRepo from '../db/repositories/matchesRepo';
import * as teamSystemRepo from '../db/repositories/teamSystemRepo';
import * as scenarioRepo from '../db/repositories/scenarioRepo';
export { getMarketSignalsPayload, buildModelVsMarket } from '../market/services/marketSignalService';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import type { TeamSystemProfile } from '../models/probability/teamSystemStrength';

export function mapTeamSystemRow(row: Record<string, unknown> | null, fallback?: TeamSystemProfile) {
  if (!row && fallback) {
    return {
      teamId: fallback.teamId,
      tacticalIdentity: fallback.tacticalIdentity,
      primaryFormation: fallback.primaryFormation,
      collectiveStrengthScore: fallback.collectiveStrengthScore,
      formationStabilityScore: fallback.formationStabilityScore,
      pressingScore: fallback.pressingScore,
      defensiveCompactnessScore: fallback.defensiveCompactnessScore,
      transitionScore: fallback.transitionScore,
      setPieceScore: fallback.setPieceScore,
      benchDepthScore: fallback.benchDepthScore,
      lineupCohesionScore: fallback.lineupCohesionScore,
      possessionControlScore: fallback.possessionControlScore,
      tempoScore: fallback.tempoScore,
      explanationFactors: fallback.explanationFactors,
      confidence: fallback.confidence,
      modelVersion: 'wc-prob-v2',
    };
  }
  if (!row) return null;
  return {
    teamId: String(row.team_id),
    tacticalIdentity: String(row.tactical_identity ?? 'balanced_block'),
    primaryFormation: String(row.primary_formation ?? '4-3-3'),
    collectiveStrengthScore: Number(row.collective_strength_score ?? 0.5),
    formationStabilityScore: Number(row.formation_stability_score ?? 0.5),
    pressingScore: Number(row.pressing_score ?? 0.5),
    defensiveCompactnessScore: Number(row.defensive_compactness_score ?? 0.5),
    transitionScore: Number(row.transition_score ?? 0.5),
    setPieceScore: Number(row.set_piece_score ?? 0.5),
    benchDepthScore: Number(row.bench_depth_score ?? 0.5),
    lineupCohesionScore: Number(row.lineup_cohesion_score ?? 0.5),
    possessionControlScore: Number(row.possession_control_score ?? 0.5),
    tempoScore: Number(row.tempo_score ?? 0.5),
    explanationFactors: [] as string[],
    confidence: 0.7,
    modelVersion: String(row.model_version ?? 'wc-prob-v2'),
    sourceId: row.source_id ? String(row.source_id) : null,
  };
}

export async function getTeamSystemPayload(env: AppEnv, matchId: string) {
  const match = await matchesRepo.getMatch(env.DB, matchId);
  if (!match) return null;
  const systems = await teamSystemRepo.getTeamSystemsForMatch(
    env.DB,
    match.home_team_id,
    match.away_team_id,
    match.tournament_id,
  );
  return {
    matchId,
    home: mapTeamSystemRow(systems.home),
    away: mapTeamSystemRow(systems.away),
    disclaimer: 'Team metrics describe collective tactical structure, not individual player ratings alone.',
  };
}

export async function getScenariosPayload(env: AppEnv, matchId: string) {
  const scenarios = await scenarioRepo.listScenariosForMatch(env.DB, matchId);
  return {
    matchId,
    scenarios,
    disclaimer: 'Scenario likelihoods are model estimates — not outcome guarantees.',
  };
}

export async function getProbabilityMovement(env: AppEnv, matchId: string) {
  const { results } = await env.DB.prepare(
    `SELECT minute, home_win_prob, draw_prob, away_win_prob, created_at, model_version
     FROM probability_snapshots WHERE match_id = ? ORDER BY created_at ASC LIMIT 30`,
  )
    .bind(matchId)
    .all<{
      minute: number;
      home_win_prob: number;
      draw_prob: number;
      away_win_prob: number;
      created_at: string;
      model_version: string;
    }>();

  const rows = results ?? [];
  const PROB_EPS = 0.005;
  const events: {
    label: string;
    timestamp: string;
    minute?: number;
    homeWinBefore: number;
    homeWinAfter: number;
    drawBefore: number;
    drawAfter: number;
    awayBefore: number;
    awayAfter: number;
    deltaHome: number;
    reasonCode: 'baseline' | 'live' | 'recalc';
  }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i];
    const prev = rows[i - 1];

    if (i > 0 && prev) {
      const unchanged =
        Math.abs(cur.home_win_prob - prev.home_win_prob) < PROB_EPS &&
        Math.abs(cur.draw_prob - prev.draw_prob) < PROB_EPS &&
        Math.abs(cur.away_win_prob - prev.away_win_prob) < PROB_EPS;
      if (unchanged) continue;
    }

    const reasonCode: 'baseline' | 'live' | 'recalc' =
      i === 0
        ? 'baseline'
        : cur.minute > (prev?.minute ?? 0)
          ? 'live'
          : 'recalc';

    events.push({
      label: i === 0 ? 'baseline' : `update-${events.length}`,
      timestamp: cur.created_at,
      minute: cur.minute,
      homeWinBefore: prev?.home_win_prob ?? cur.home_win_prob,
      homeWinAfter: cur.home_win_prob,
      drawBefore: prev?.draw_prob ?? cur.draw_prob,
      drawAfter: cur.draw_prob,
      awayBefore: prev?.away_win_prob ?? cur.away_win_prob,
      awayAfter: cur.away_win_prob,
      deltaHome: cur.home_win_prob - (prev?.home_win_prob ?? cur.home_win_prob),
      reasonCode,
    });
  }

  return { matchId, events, modelVersion: rows[0]?.model_version ?? null };
}

