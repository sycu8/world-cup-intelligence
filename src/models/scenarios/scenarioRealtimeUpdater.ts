import type { MatchPredictionScenario } from './types';
import { runScenarioProbabilityModel } from './scenarioEngine';
import { selectScenarioFeatures } from './scenarioFeatureSelector';
import type { MatchScenarioContext } from './types';

export type RealtimeScenarioUpdateInput = {
  matchId: string;
  eventId: string;
  eventType: string;
  minute: number;
};

export type RealtimeScenarioUpdateResult = {
  scenarios: MatchPredictionScenario[];
  snapshots: Array<{
    scenarioId: string;
    deltaFromPrevious: number;
    updateReason: string;
  }>;
  rankChanged: boolean;
  invalidatedIds: string[];
  explanationRequired: boolean;
};

const EXPLANATION_DELTA_THRESHOLD = 0.05;

export function applyRealtimeEventToScenarios(
  context: MatchScenarioContext,
  scenarios: MatchPredictionScenario[],
  input: RealtimeScenarioUpdateInput,
): RealtimeScenarioUpdateResult {
  const prevRanks = scenarios.map((s) => s.id);
  const snapshots: RealtimeScenarioUpdateResult['snapshots'] = [];
  const invalidatedIds: string[] = [];
  let explanationRequired = false;

  const updated = scenarios.map((scenario) => {
    const selection = selectScenarioFeatures(scenario.scenarioType, context);
    const output = runScenarioProbabilityModel(scenario.scenarioType, context, selection);
    const prevProb = scenario.scenarioProbability;
    let status = scenario.status;

    if (input.eventType === 'red_card' || input.eventType === 'red_card_disruption') {
      if (scenario.scenarioType === 'red_card_disruption') {
        output.scenarioProbability = Math.min(0.95, output.scenarioProbability + 0.15);
      }
    }
    if (input.eventType === 'goal' && input.minute <= 30 && scenario.scenarioType === 'early_goal_swing') {
      output.scenarioProbability = Math.min(0.92, output.scenarioProbability + 0.18);
      output.triggerConditions = output.triggerConditions.map((t) => {
        if (!t.condition.includes('First goal')) return t;
        return { ...t, status: 'triggered' as const };
      });
    }
    if (input.eventType === 'lineup_confirmed' && scenario.scenarioType === 'lineup_surprise') {
      status = 'invalidated';
      invalidatedIds.push(scenario.id);
      explanationRequired = true;
    }

    const delta = output.scenarioProbability - prevProb;
    if (Math.abs(delta) >= EXPLANATION_DELTA_THRESHOLD) explanationRequired = true;

    snapshots.push({
      scenarioId: scenario.id,
      deltaFromPrevious: delta,
      updateReason: `${input.eventType}@${input.minute}`,
    });

    return {
      ...scenario,
      ...output,
      triggerConditions: output.triggerConditions,
      invalidationConditions: output.invalidationConditions,
      initialConditions: output.initialConditions,
      keyDrivers: output.keyDrivers,
      riskFactors: output.riskFactors,
      featureSelection: selection,
      status,
      updatedAt: new Date().toISOString(),
    };
  });

  const sorted = [...updated].sort((a, b) => b.scenarioProbability - a.scenarioProbability);
  sorted.forEach((s, i) => {
    s.scenarioRank = i + 1;
  });
  const rankChanged = sorted.some((s, i) => s.id !== prevRanks[i]);

  return {
    scenarios: sorted,
    snapshots,
    rankChanged,
    invalidatedIds,
    explanationRequired: explanationRequired || rankChanged || invalidatedIds.length > 0,
  };
}
