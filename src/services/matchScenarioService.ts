import type { AppEnv } from '../env';
import * as matchesRepo from '../db/repositories/matchesRepo';
import * as teamsRepo from '../db/repositories/teamsRepo';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import * as matchPredictionScenarioRepo from '../db/repositories/matchPredictionScenarioRepo';
import * as scenarioRepo from '../db/repositories/scenarioRepo';
import { buildMatchFeaturesWithForm } from './matchFeatures';
import { computeFullMatchProbability } from '../models/probability/fullMatchOutput';
import { buildTeamSystemProfile } from '../models/probability/teamSystemStrength';
import { getProjectedLineupForMatch } from './matchLineupProjection';
import { buildCandidateScenarios, ensureAtLeastTwoScenarios } from '../models/scenarios/scenarioGenerator';
import { selectScenarioFeatures } from '../models/scenarios/scenarioFeatureSelector';
import { runScenarioProbabilityModel } from '../models/scenarios/scenarioEngine';
import { compareScenarios } from '../models/scenarios/scenarioComparison';
import { assertValidScenarioSet } from '../models/scenarios/scenarioValidation';
import { buildScenarioExplanationFactors } from '../models/scenarios/scenarioExplanationFactors';
import {
  applyRealtimeEventToScenarios,
  type RealtimeScenarioUpdateInput,
} from '../models/scenarios/scenarioRealtimeUpdater';
import type {
  MatchPredictionScenario,
  MatchScenarioContext,
  MatchScenarioSet,
  ScenarioType,
} from '../models/scenarios/types';
import { SCENARIO_TYPE_LABELS } from '../models/scenarios/types';
import { newId } from '../utils/ids';
import { sha256Hex } from '../utils/hash';
import { logInfo } from '../utils/logger';
import { nowIso } from '../utils/time';
import * as marketRepo from '../db/repositories/marketRepo';

async function loadMarketImplied(env: AppEnv, matchId: string) {
  const latest = await marketRepo.getLatestMarketSignal(env.DB, matchId);
  if (!latest) return null;
  return {
    home: Number(latest.market_home_prob),
    draw: Number(latest.market_draw_prob),
    away: Number(latest.market_away_prob),
  };
}

export async function loadMatchScenarioContext(env: AppEnv, matchId: string): Promise<MatchScenarioContext | null> {
  const match = await matchesRepo.getMatch(env.DB, matchId);
  if (!match) return null;
  const home = await teamsRepo.getTeam(env.DB, match.home_team_id);
  const away = await teamsRepo.getTeam(env.DB, match.away_team_id);
  if (!home || !away) return null;

  const tournament = await env.DB.prepare('SELECT year FROM tournaments WHERE id = ?')
    .bind(match.tournament_id)
    .first<{ year: number }>();

  const features = await buildMatchFeaturesWithForm(env, match, home, away, tournament?.year ?? 2026);
  const [homeLu, awayLu] = await Promise.all([
    getProjectedLineupForMatch(env, matchId, home.id, home.name),
    getProjectedLineupForMatch(env, matchId, away.id, away.name),
  ]);

  const full = await computeFullMatchProbability(features, homeLu.formation, awayLu.formation);
  const marketImplied = await loadMarketImplied(env, matchId);

  return {
    matchId,
    tournamentYear: tournament?.year ?? 2026,
    stage: match.stage ?? 'Group',
    minute: match.minute ?? 0,
    homeScore: match.home_score ?? 0,
    awayScore: match.away_score ?? 0,
    status: match.status ?? 'scheduled',
    homeTeamName: home.name,
    awayTeamName: away.name,
    features,
    probability: full,
    homeSystem: full.teamSystemFactors.home,
    awaySystem: full.teamSystemFactors.away,
    homeLineupSource: homeLu.source,
    awayLineupSource: awayLu.source,
    marketImplied,
  };
}

async function saveFeatureSnapshot(
  env: AppEnv,
  matchId: string,
  scenarioId: string,
  inputHash: string,
  context: MatchScenarioContext,
  selection: ReturnType<typeof selectScenarioFeatures>,
): Promise<string> {
  const key = `scenarios/${matchId}/${scenarioId}/${inputHash.slice(0, 16)}.json`;
  await env.R2_ARTIFACTS.put(
    key,
    JSON.stringify({ context: { matchId, minute: context.minute, stage: context.stage }, selection }),
    { httpMetadata: { contentType: 'application/json' } },
  );
  return key;
}

export async function generateMatchScenarios(env: AppEnv, matchId: string): Promise<MatchScenarioSet | null> {
  const context = await loadMatchScenarioContext(env, matchId);
  if (!context) return null;

  const candidates = buildCandidateScenarios(context);
  const scored = candidates.map((candidate) => {
    const featureSelection = selectScenarioFeatures(candidate.scenarioType, context);
    const output = runScenarioProbabilityModel(candidate.scenarioType, context, featureSelection);
    return { ...candidate, featureSelection, output };
  });

  const filtered = scored.filter((s) => s.output.scenarioConfidence >= 0.35);
  const finalCandidates = ensureAtLeastTwoScenarios(filtered.length ? filtered : scored, context);
  const ts = nowIso();

  const scenarios: MatchPredictionScenario[] = [];
  for (let i = 0; i < finalCandidates.length; i++) {
    const item = finalCandidates[i];
    const { scenarioType, featureSelection, output } = item;

    const inputHash = await sha256Hex(
      JSON.stringify({ matchId, scenarioType, minute: context.minute, features: context.features.sourceConfidence }),
    );
    const id = newId('mps');
    const featureSnapshotR2Key = await saveFeatureSnapshot(env, matchId, id, inputHash, context, featureSelection);

    scenarios.push({
      id,
      matchId,
      scenarioType,
      scenarioName: item.scenarioName ?? SCENARIO_TYPE_LABELS[scenarioType],
      scenarioRank: i + 1,
      isBaseline: item.isBaseline ?? scenarioType === 'baseline_expected_flow',
      initialConditions: output.initialConditions,
      triggerConditions: output.triggerConditions,
      invalidationConditions: output.invalidationConditions,
      scenarioProbability: output.scenarioProbability,
      scenarioConfidence: output.scenarioConfidence,
      homeWinProb: output.homeWinProb,
      drawProb: output.drawProb,
      awayWinProb: output.awayWinProb,
      expectedHomeGoals: output.expectedHomeGoals,
      expectedAwayGoals: output.expectedAwayGoals,
      mostLikelyScore: output.mostLikelyScore,
      scorelineDistribution: output.scorelineDistribution,
      intervalDistribution: output.intervalDistribution,
      keyDrivers: output.keyDrivers,
      riskFactors: output.riskFactors,
      featureSelection,
      modelVersion: context.probability.modelVersion,
      inputHash,
      featureSnapshotR2Key,
      status: 'active',
      updatedAt: ts,
    });
  }

  assertValidScenarioSet(scenarios);
  const comparison = compareScenarios(scenarios);
  await matchPredictionScenarioRepo.replaceMatchScenarioSet(env.DB, matchId, scenarios, comparison);

  await scenarioRepo.replaceScenarioProbabilities(
    env.DB,
    matchId,
    scenarios.map((s) => ({
      scenarioType: s.scenarioType,
      probability: s.scenarioProbability,
      confidence: s.scenarioConfidence,
      explanationFactors: buildScenarioExplanationFactors(s),
    })),
    context.probability.modelVersion,
    context.probability.inputHash,
  );

  logInfo('match scenarios generated', { matchId, count: scenarios.length });

  return {
    matchId,
    generatedAt: ts,
    updatedAt: ts,
    scenarios,
    comparison,
    sourceConfidence: {
      overall: context.features.sourceConfidence,
      notes: context.marketImplied
        ? ['Market-implied probability used as analytical signal only.']
        : ['No market-implied probability on file.'],
    },
  };
}

export async function getMatchScenarioSet(env: AppEnv, matchId: string): Promise<MatchScenarioSet | null> {
  const scenarios = await matchPredictionScenarioRepo.listActiveScenariosForMatch(env.DB, matchId);
  if (scenarios.length < 2) {
    return generateMatchScenarios(env, matchId);
  }
  const comparison = (await matchPredictionScenarioRepo.getLatestComparison(env.DB, matchId)) ??
    compareScenarios(scenarios);
  const snap = await probabilityRepo.getLatestSnapshot(env.DB, matchId);
  return {
    matchId,
    generatedAt: scenarios[0]?.updatedAt ?? nowIso(),
    updatedAt: scenarios[0]?.updatedAt ?? nowIso(),
    scenarios,
    comparison,
    sourceConfidence: {
      overall: snap?.confidence ?? 0.7,
      notes: ['Scenario likelihoods are model estimates — analytical context only.'],
    },
  };
}

export async function updateScenariosFromRealtimeEvent(
  env: AppEnv,
  input: RealtimeScenarioUpdateInput,
): Promise<MatchScenarioSet | null> {
  const context = await loadMatchScenarioContext(env, input.matchId);
  if (!context) return null;

  let scenarios = await matchPredictionScenarioRepo.listActiveScenariosForMatch(env.DB, input.matchId);
  if (scenarios.length < 2) {
    const generated = await generateMatchScenarios(env, input.matchId);
    if (generated) scenarios = generated.scenarios;
  }

  const result = applyRealtimeEventToScenarios(context, scenarios, input);
  const comparison = compareScenarios(result.scenarios);
  await matchPredictionScenarioRepo.replaceMatchScenarioSet(env.DB, input.matchId, result.scenarios, comparison);

  for (const snap of result.snapshots) {
    const scenario = result.scenarios.find((s) => s.id === snap.scenarioId);
    if (scenario) {
      await matchPredictionScenarioRepo.saveScenarioSnapshot(env.DB, scenario, {
        minute: input.minute,
        deltaFromPrevious: snap.deltaFromPrevious,
        updateReason: snap.updateReason,
        eventId: input.eventId,
      });
    }
  }

  return getMatchScenarioSet(env, input.matchId);
}

export async function broadcastScenarioUpdate(env: AppEnv, matchId: string, payload: MatchScenarioSet): Promise<void> {
  const id = env.MATCH_ROOM.idFromName(matchId);
  const stub = env.MATCH_ROOM.get(id);
  await stub.fetch(
    new Request(`https://match-room/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'SCENARIO_UPDATE', payload }),
    }),
  );
}
