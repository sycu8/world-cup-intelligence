import type { MatchScenarioContext, ScenarioFeatureGroup, ScenarioFeatureSelection, ScenarioType } from './types';

const BASELINE_GROUPS: ScenarioFeatureGroup[] = [
  'team_system',
  'lineup',
  'recent_form',
  'tactical_matchup',
  'weather_venue',
  'historical_tournament',
  'market_signal',
];

const GROUPS_BY_TYPE: Partial<Record<ScenarioType, ScenarioFeatureGroup[]>> = {
  baseline_expected_flow: BASELINE_GROUPS,
  early_goal_swing: ['transition', 'pressing', 'game_state', 'event_flow', 'team_system'],
  transition_dominance: ['transition', 'tactical_matchup', 'pressing', 'team_system'],
  pressing_breakthrough: ['pressing', 'transition', 'defensive_block', 'team_system'],
  low_block_frustration: ['defensive_block', 'tactical_matchup', 'transition', 'team_system'],
  set_piece_decider: ['set_piece', 'lineup', 'team_system'],
  red_card_disruption: ['event_flow', 'game_state', 'player_availability', 'bench_depth'],
  low_event_controlled_match: ['team_system', 'defensive_block', 'recent_form'],
  high_event_open_match: ['team_system', 'pressing', 'transition', 'recent_form'],
  late_bench_impact: ['bench_depth', 'game_state', 'team_system'],
  extra_time_path: ['historical_tournament', 'game_state', 'team_system'],
  penalty_shootout_path: ['historical_tournament', 'game_state', 'team_system'],
  lineup_surprise: ['lineup', 'player_availability', 'tactical_matchup'],
  key_player_absence: ['player_availability', 'lineup', 'bench_depth'],
};

const REQUIRED_BY_GROUP: Record<ScenarioFeatureGroup, string[]> = {
  team_system: ['homeSystem', 'awaySystem'],
  lineup: ['homeLineupSource', 'awayLineupSource'],
  player_availability: ['features.homeLineup', 'features.awayLineup'],
  recent_form: ['features.homeTeam.recentForm', 'features.awayTeam.recentForm'],
  tactical_matchup: ['homeSystem', 'awaySystem', 'features'],
  game_state: ['minute', 'homeScore', 'awayScore'],
  event_flow: ['minute', 'status'],
  set_piece: ['homeSystem.setPieceScore', 'awaySystem.setPieceScore'],
  transition: ['homeSystem.transitionScore', 'awaySystem.transitionScore'],
  pressing: ['homeSystem.pressingScore', 'awaySystem.pressingScore'],
  defensive_block: ['homeSystem.defensiveCompactnessScore', 'awaySystem.defensiveCompactnessScore'],
  bench_depth: ['homeSystem.benchDepthScore', 'awaySystem.benchDepthScore'],
  weather_venue: ['features.sourceConfidence'],
  market_signal: ['marketImplied'],
  historical_tournament: ['tournamentYear', 'stage'],
};

export function hasPath(ctx: MatchScenarioContext, path: string): boolean {
  if (path === 'homeSystem') return !!ctx.homeSystem;
  if (path === 'awaySystem') return !!ctx.awaySystem;
  if (path === 'homeLineupSource') return ctx.homeLineupSource !== 'unknown';
  if (path === 'awayLineupSource') return ctx.awayLineupSource !== 'unknown';
  if (path === 'minute') return ctx.minute >= 0;
  if (path === 'homeScore' || path === 'awayScore' || path === 'status') return true;
  if (path === 'marketImplied') return !!ctx.marketImplied;
  if (path === 'tournamentYear' || path === 'stage') return true;
  if (path.startsWith('features.')) {
    const rest = path.slice('features.'.length);
    if (rest === 'homeLineup') return !!ctx.features.homeLineup;
    if (rest === 'awayLineup') return !!ctx.features.awayLineup;
    if (rest === 'homeTeam.recentForm') return Number.isFinite(ctx.features.homeTeam.recentForm);
    if (rest === 'awayTeam.recentForm') return Number.isFinite(ctx.features.awayTeam.recentForm);
    if (rest === 'sourceConfidence') return ctx.features.sourceConfidence > 0;
    return false;
  }
  if (path.startsWith('homeSystem.') || path.startsWith('awaySystem.')) return true;
  return false;
}

export function selectScenarioFeatures(
  scenarioType: ScenarioType,
  context: MatchScenarioContext,
): ScenarioFeatureSelection {
  const selectedFeatureGroups = GROUPS_BY_TYPE[scenarioType] ?? BASELINE_GROUPS;
  const requiredInputs = selectedFeatureGroups.flatMap((g) => REQUIRED_BY_GROUP[g]);
  const optionalInputs = ['marketImplied', 'features.homeLineup', 'features.awayLineup'];
  const missingInputs = [...new Set(requiredInputs)].filter((p) => !hasPath(context, p));
  const inputQualityScore = Math.max(
    0.35,
    1 - missingInputs.length * 0.08,
  );
  const confidencePenalty = missingInputs.length * 0.06;
  const reason =
    missingInputs.length === 0
      ? [`All required inputs available for ${scenarioType}.`]
      : [`Missing inputs reduce model confidence: ${missingInputs.join(', ')}.`];

  return {
    scenarioType,
    selectedFeatureGroups,
    requiredInputs: [...new Set(requiredInputs)],
    optionalInputs,
    missingInputs,
    inputQualityScore,
    confidencePenalty,
    reason,
  };
}
