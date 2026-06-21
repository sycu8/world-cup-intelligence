import { describe, expect, it } from 'vitest';
import * as marketRepo from '../src/db/repositories/marketRepo';
import * as lineupsRepo from '../src/db/repositories/lineupsRepo';
import * as matchesRepo from '../src/db/repositories/matchesRepo';
import * as probabilityRepo from '../src/db/repositories/probabilityRepo';
import * as teamsRepo from '../src/db/repositories/teamsRepo';
import * as sourcesRepo from '../src/db/repositories/sourcesRepo';
import {
  getScenarioById,
  getLatestComparison,
  listActiveScenariosForMatch,
} from '../src/db/repositories/matchPredictionScenarioRepo';
import { createMockDb } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT, FIXTURE_TEAMS } from './helpers/fixtures';
import { mockScenario } from './helpers/scenarioFixtures';
import { WC2026_TOURNAMENT_ID } from '../src/constants/tournament';
import type { ProbabilityResult } from '../src/models/probability/types';

describe('marketRepo', () => {
  it('saveMarketOddsBatch inserts each normalized row', async () => {
    const runCalls: string[] = [];
    const db = createMockDb({
      run: (sql) => {
        runCalls.push(sql);
        return { success: true };
      },
    });

    await marketRepo.saveMarketOddsBatch(db, [
      {
        matchId: 'm-1',
        sourceId: 'mkt-manual',
        marketType: '1x2',
        selection: 'home',
        oddsDecimal: 2.1,
        impliedProbability: 0.476,
        normalizedProbability: 0.45,
        overround: 1.05,
        lineValue: null,
        retrievedAt: '2026-06-01T00:00:00Z',
        rawR2Key: 'raw/1',
      },
    ]);

    expect(runCalls.some((sql) => sql.includes('INSERT INTO market_odds_snapshots'))).toBe(true);
  });

  it('saveMarketSignalAnalysis returns new analysis id', async () => {
    const id = await marketRepo.saveMarketSignalAnalysis(createMockDb(), 'm-1', {
      model: { home: 0.5, draw: 0.25, away: 0.25 },
      market: { home: 0.45, draw: 0.3, away: 0.25 },
      edge: { home: 0.05, draw: -0.05, away: 0 },
      volatilityScore: 0.05,
    });
    expect(id).toMatch(/^msa-/);
  });

  it('getLatestMarketSignal and getLatestMarketOdds read D1', async () => {
    const db = createMockDb({
      first: () => ({ id: 'msa-1', match_id: 'm-1' }),
      all: () => ({
        results: [{ selection: 'home', normalized_probability: 0.45 }],
      }),
    });
    expect(await marketRepo.getLatestMarketSignal(db, 'm-1')).toMatchObject({ id: 'msa-1' });
    expect(await marketRepo.getLatestMarketOdds(db, 'm-1')).toHaveLength(1);
  });
});

describe('lineupsRepo', () => {
  it('upsertMatchLineup writes lineup and player rows', async () => {
    const runCalls: string[] = [];
    const db = createMockDb({
      run: (sql) => {
        runCalls.push(sql);
        return { success: true };
      },
    });

    const lineupId = await lineupsRepo.upsertMatchLineup(db, {
      matchId: 'm-1',
      teamId: 'team-usa',
      formation: '4-3-3',
      sourceType: 'match_official',
      isOfficial: true,
      players: [
        { playerId: 'p-1', isStarter: true, positionSlot: '1', shirtNumber: 1 },
        { playerId: 'p-2', isStarter: false },
      ],
    });

    expect(lineupId).toBe('lu-m-1-team-usa');
    expect(runCalls.some((sql) => sql.includes('INSERT INTO lineups'))).toBe(true);
    expect(runCalls.some((sql) => sql.includes('DELETE FROM lineup_players'))).toBe(true);
    expect(runCalls.filter((sql) => sql.includes('INSERT INTO lineup_players'))).toHaveLength(2);
  });

  it('getMatchLineupRow returns lineup metadata', async () => {
    const db = createMockDb({
      first: () => ({
        id: 'lu-m-1-team-usa',
        formation: '4-3-3',
        is_official: 1,
        source_type: 'match_official',
      }),
    });
    const row = await lineupsRepo.getMatchLineupRow(db, 'm-1', 'team-usa');
    expect(row?.formation).toBe('4-3-3');
  });

  it('getMatchLineups enriches players for each lineup', async () => {
    const db = createMockDb({
      all: (sql) => {
        if (sql.includes('FROM lineups WHERE match_id')) {
          return { results: [{ id: 'lu-1', match_id: 'm-1', team_id: 'team-usa' }] };
        }
        if (sql.includes('FROM lineup_players')) {
          return { results: [{ player_id: 'p-1', player_name: 'Player One', is_starter: 1 }] };
        }
        return { results: [] };
      },
    });

    const lineups = await lineupsRepo.getMatchLineups(db, 'm-1');
    expect(lineups).toHaveLength(1);
    expect(lineups[0]?.players).toHaveLength(1);
  });
});

describe('matchesRepo', () => {
  it('listMatches returns tournament rows with defaults', async () => {
    const db = createMockDb({
      all: () => ({ results: [FIXTURE_MATCH] }),
    });
    const rows = await matchesRepo.listMatches(db);
    expect(rows[0]?.id).toBe(FIXTURE_MATCH.id);
  });

  it('getMatch scopes to WC2026 tournament', async () => {
    const db = createMockDb({
      first: () => FIXTURE_MATCH,
    });
    expect(await matchesRepo.getMatch(db, FIXTURE_MATCH.id)).toEqual(FIXTURE_MATCH);
  });

  it('getMatchesByTournament always uses WC2026 id', async () => {
    const binds: unknown[][] = [];
    const db = createMockDb({
      all: (sql, b) => {
        binds.push(b);
        return { results: [FIXTURE_MATCH] };
      },
    });
    await matchesRepo.getMatchesByTournament(db, 'other-tournament');
    expect(binds[0]?.[0]).toBe(WC2026_TOURNAMENT_ID);
  });
});

describe('probabilityRepo', () => {
  it('listLatestSnapshotsForTournament maps snapshot triples', async () => {
    const db = createMockDb({
      all: () => ({
        results: [
          {
            matchId: FIXTURE_MATCH.id,
            homeWinProb: 0.5,
            drawProb: 0.25,
            awayWinProb: 0.25,
          },
        ],
      }),
    });
    const rows = await probabilityRepo.listLatestSnapshotsForTournament(db, WC2026_TOURNAMENT_ID);
    expect(rows[0]?.matchId).toBe(FIXTURE_MATCH.id);
  });

  it('getLatestSnapshot returns probability row', async () => {
    const db = createMockDb({ first: () => FIXTURE_SNAPSHOT });
    expect(await probabilityRepo.getLatestSnapshot(db, FIXTURE_MATCH.id)).toEqual(FIXTURE_SNAPSHOT);
  });

  it('saveSnapshot inserts probability result', async () => {
    const runCalls: string[] = [];
    const db = createMockDb({
      run: (sql) => {
        runCalls.push(sql);
        return { success: true };
      },
    });
    const result: ProbabilityResult = {
      matchId: FIXTURE_MATCH.id,
      timestamp: '2026-06-01T00:00:00Z',
      minute: 0,
      second: 0,
      modelVersion: 'v1',
      inputHash: 'hash',
      homeWinProb: 0.5,
      drawProb: 0.25,
      awayWinProb: 0.25,
      expectedHomeGoals: 1.5,
      expectedAwayGoals: 1.0,
      mostLikelyScore: '2-1',
      scorelineDistribution: { '2-1': 0.1 },
      intervalDistribution: {},
      confidence: 0.8,
      topPositiveFactors: [],
      topNegativeFactors: [],
      sourceSummary: [],
      explanation: 'test',
    };
    const id = await probabilityRepo.saveSnapshot(db, result, 'r2/key');
    expect(id).toMatch(/^ps-/);
    expect(runCalls.some((sql) => sql.includes('INSERT INTO probability_snapshots'))).toBe(true);
  });
});

describe('teamsRepo', () => {
  it('listTeams returns ordered teams', async () => {
    const db = createMockDb({ all: () => ({ results: FIXTURE_TEAMS }) });
    expect(await teamsRepo.listTeams(db)).toHaveLength(2);
  });

  it('getTeam applies effective profile when row exists', async () => {
    const db = createMockDb({ first: () => FIXTURE_TEAMS[0] });
    const team = await teamsRepo.getTeam(db, FIXTURE_TEAMS[0].id);
    expect(team?.name).toBe('Mexico');
  });

  it('getTeam returns null when missing', async () => {
    const db = createMockDb({ first: () => null });
    expect(await teamsRepo.getTeam(db, 'missing')).toBeNull();
  });

  it('getTeamsByTournament returns draw-slot teams', async () => {
    const db = createMockDb({ all: () => ({ results: FIXTURE_TEAMS }) });
    expect(await teamsRepo.getTeamsByTournament(db, WC2026_TOURNAMENT_ID)).toHaveLength(2);
  });
});

describe('sourcesRepo', () => {
  it('listSources and getSource query registry', async () => {
    const source = { id: 'src-1', source_name: 'BBC' };
    const db = createMockDb({
      all: () => ({ results: [source] }),
      first: () => source,
    });
    expect(await sourcesRepo.listSources(db)).toEqual([source]);
    expect(await sourcesRepo.getSource(db, 'src-1')).toEqual(source);
  });
});

describe('matchPredictionScenarioRepo extensions', () => {
  it('getScenarioById maps stored row', async () => {
    const scenario = mockScenario({ id: 'mps-found' });
    const db = createMockDb({
      first: () => ({
        id: scenario.id,
        match_id: scenario.matchId,
        scenario_type: scenario.scenarioType,
        scenario_name: scenario.scenarioName,
        scenario_rank: scenario.scenarioRank,
        is_baseline: 0,
        initial_conditions_json: JSON.stringify(scenario.initialConditions),
        trigger_conditions_json: JSON.stringify(scenario.triggerConditions),
        invalidation_conditions_json: JSON.stringify(scenario.invalidationConditions),
        scenario_probability: scenario.scenarioProbability,
        scenario_confidence: scenario.scenarioConfidence,
        home_win_prob: scenario.homeWinProb,
        draw_prob: scenario.drawProb,
        away_win_prob: scenario.awayWinProb,
        expected_home_goals: scenario.expectedHomeGoals,
        expected_away_goals: scenario.expectedAwayGoals,
        most_likely_score: scenario.mostLikelyScore,
        scoreline_distribution_json: JSON.stringify(scenario.scorelineDistribution),
        interval_distribution_json: JSON.stringify(scenario.intervalDistribution),
        key_drivers_json: JSON.stringify(scenario.keyDrivers),
        risk_factors_json: JSON.stringify(scenario.riskFactors),
        explanation_json: JSON.stringify({ featureSelection: scenario.featureSelection }),
        model_version: scenario.modelVersion,
        input_hash: scenario.inputHash,
        feature_snapshot_r2_key: scenario.featureSnapshotR2Key,
        status: scenario.status,
        generated_at: scenario.updatedAt,
        updated_at: scenario.updatedAt,
      }),
    });
    const found = await getScenarioById(db, 'mps-found');
    expect(found?.id).toBe('mps-found');
    expect(found?.isBaseline).toBe(false);
  });

  it('listActiveScenariosForMatch tolerates invalid JSON fields', async () => {
    const db = createMockDb({
      all: () => ({
        results: [
          {
            id: 'mps-bad-json',
            match_id: 'm-1',
            scenario_type: 'baseline_expected_flow',
            scenario_name: 'Baseline',
            scenario_rank: 1,
            is_baseline: 1,
            initial_conditions_json: 'not-json',
            trigger_conditions_json: null,
            invalidation_conditions_json: null,
            scenario_probability: 0.3,
            scenario_confidence: 0.7,
            home_win_prob: null,
            draw_prob: null,
            away_win_prob: null,
            expected_home_goals: null,
            expected_away_goals: null,
            most_likely_score: null,
            scoreline_distribution_json: null,
            interval_distribution_json: null,
            key_drivers_json: null,
            risk_factors_json: null,
            explanation_json: 'also-not-json',
            model_version: 'v1',
            input_hash: 'hash',
            feature_snapshot_r2_key: null,
            status: 'active',
            generated_at: '2026-06-01T00:00:00Z',
            updated_at: '2026-06-01T00:00:00Z',
          },
        ],
      }),
    });
    const scenarios = await listActiveScenariosForMatch(db, 'm-1');
    expect(scenarios[0]?.initialConditions).toEqual([]);
    expect(scenarios[0]?.featureSelection.scenarioType).toBe('baseline_expected_flow');
  });

  it('getLatestComparison handles null comparison_json', async () => {
    const db = createMockDb({
      first: () => ({
        scenario_a_id: 'a',
        scenario_b_id: 'b',
        probability_gap: 0.1,
        confidence_gap: 0.05,
        home_win_delta: 0.02,
        draw_delta: -0.01,
        away_win_delta: -0.01,
        xg_home_delta: 0.1,
        xg_away_delta: -0.05,
        comparison_summary: 'Summary',
        comparison_json: null,
      }),
    });
    const comparison = await getLatestComparison(db, 'm-1');
    expect(comparison?.keyDifferences).toEqual([]);
  });
});
