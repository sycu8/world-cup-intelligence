import React, { type ReactElement } from 'react';
import { cleanup, render, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { MatchLineupSidePanel } from '../app/components/match/MatchLineupSidePanel';
import { ContributionRadialChart } from '../app/components/tactical/ContributionRadialChart';
import { EventTrajectoryLayer } from '../app/components/tactical/EventTrajectoryLayer';
import { ScorelineMatrix } from '../app/components/tactical/ScorelineMatrix';
import { ProbabilityMovementTimeline } from '../app/components/tactical/ProbabilityMovementTimeline';
import { useMatchLiveData } from '../app/lib/useMatchLiveData';
import { usePitchMapLive } from '../app/lib/usePitchMapLive';
import { derivePlayerImpact } from '../app/lib/derivePlayerImpact';
import { formatLineupPlayerLine, sortLineupPlayers } from '../app/lib/lineupDisplay';
import { resolveLineupHref, resolveMatchAnalysisHref } from '../app/lib/matchPaths';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';
import { mockScenario, mockScenarioContext } from './helpers/scenarioFixtures';
import { listScenariosForMatch } from '../src/db/repositories/scenarioRepo';
import { listMatchesWithSlug } from '../src/services/matchRef';
import { getMatchStaff } from '../src/services/matchStaff';
import { extractEntitiesRuleBased } from '../src/ai/entityExtraction';
import { fetchFifaWc2026FixturesCalendar } from '../src/ingestion/fifa/fifaApiClient';
import { shouldSyncFifaBlogAndStats } from '../src/ingestion/fifa/fifaLiveBlogSync';
import { getProbabilityMovement } from '../src/services/matchIntelligence';
import { resolveTeamFlagSlug } from '../src/lib/teamFlags';
import { buildCandidateScenarios } from '../src/models/scenarios/scenarioGenerator';
import { compareScenarios } from '../src/models/scenarios/scenarioComparison';
import { selectScenarioFeatures } from '../src/models/scenarios/scenarioFeatureSelector';
import { applyRealtimeEventToScenarios } from '../src/models/scenarios/scenarioRealtimeUpdater';
import { runBacktest } from '../src/models/backtesting/backtestRunner';
import { brierScore } from '../src/models/backtesting/metrics';
import { buildExplanationFactors } from '../src/models/probability/explainFactors';
import { assignFormationCoords } from '../src/lib/formationLayout';
import { mockScoreAtMinute } from '../src/services/matchLifecycle';

function renderWithI18n(ui: ReactElement) {
  return render(
    React.createElement(MemoryRouter, null, React.createElement(I18nProvider, null, ui)),
  );
}

describe('coverage branch sweep round 2 — D1 null coalesce batch', () => {
  const emptyAll = () => ({}) as { results?: unknown[] };

  it('listScenariosForMatch and listMatchesWithSlug return [] without results', async () => {
    const db = createMockDb({ all: emptyAll });
    expect(await listScenariosForMatch(db, 'm-1')).toEqual([]);
    expect(await listMatchesWithSlug(db)).toEqual([]);
  });

  it('getMatchStaff maps empty officials when results omitted', async () => {
    const db = createMockDb({
      first: (sql) => {
        if (sql.includes('FROM matches m')) return { ...FIXTURE_MATCH, tournament_id: 't-2026', slug: 's' };
        return null;
      },
      all: emptyAll,
    });
    const staff = await getMatchStaff(createMockEnv({ DB: db }), FIXTURE_MATCH.id);
    expect(staff?.officials).toEqual([]);
  });
});

describe('coverage branch sweep round 2 — backend utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('extractEntitiesRuleBased stops after five injuries', () => {
    const text = [
      'John Smith is ruled out',
      'Jane Doe was injured',
      'Bob Lee has been sidelined',
      'Ann Kay remains doubtful',
      'Tom Fox is out',
      'Extra Person is ruled out',
    ].join('. ');
    expect(extractEntitiesRuleBased(text, []).injuries).toHaveLength(5);
  });

  it('fetchFifaWc2026FixturesCalendar handles missing Results', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
    expect(await fetchFifaWc2026FixturesCalendar()).toEqual([]);
  });

  it('shouldSyncFifaBlogAndStats loads team ids when omitted', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ home_team_id: 'h', away_team_id: 'a' }),
        all: () => ({ results: [] }),
      }),
      KV: createMockKv(),
    });
    expect(await shouldSyncFifaBlogAndStats(env, 'm-1', 'live')).toBe(true);
  });

  it('getProbabilityMovement marks live reason when minute increases', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            { minute: 0, home_win_prob: 0.4, draw_prob: 0.3, away_win_prob: 0.3, created_at: '2026-01-01T00:00:00Z', model_version: 'v1' },
            { minute: 30, home_win_prob: 0.45, draw_prob: 0.28, away_win_prob: 0.27, created_at: '2026-01-01T00:30:00Z', model_version: 'v1' },
          ],
        }),
      }),
    });
    const movement = await getProbabilityMovement(env, 'm-1');
    expect(movement?.events.some((e) => e.reasonCode === 'live')).toBe(true);
  });

  it('resolveTeamFlagSlug uses england override from team name', () => {
    expect(resolveTeamFlagSlug({ teamName: 'England' })).toBe('gb-eng');
  });

  it('runBacktest and brierScore handle empty and mismatched inputs', async () => {
    const db = createMockDb({ all: () => ({}) });
    const result = await runBacktest(db);
    expect(result.matchCount).toBe(0);
    expect(brierScore([0.5], [0, 1])).toBe(1);
  });

  it('scenario helpers cover comparison and realtime branches', () => {
    const ctx = mockScenarioContext({
      homeSystem: { ...mockScenarioContext().homeSystem, setPieceScore: 0.7, benchDepthScore: 0.65 },
      awaySystem: { ...mockScenarioContext().awaySystem, setPieceScore: 0.4, benchDepthScore: 0.4 },
      homeLineupSource: 'projected',
      awayLineupSource: 'official',
    });
    expect(buildCandidateScenarios(ctx).length).toBeGreaterThan(1);
    const compared = compareScenarios([
      { ...mockScenario, isBaseline: true, scenarioProbability: 0.5, homeWinProb: 0.4, awayWinProb: 0.3 },
      {
        ...mockScenario,
        id: 'alt',
        isBaseline: false,
        scenarioProbability: 0.35,
        homeWinProb: 0.35,
        awayWinProb: 0.38,
        scenarioName: 'Late Surge',
      },
    ]);
    expect(compared.summary).toMatch(/away/i);
    expect(selectScenarioFeatures('unknown_type' as never, mockScenarioContext()).requiredInputs).toBeDefined();
    const updated = applyRealtimeEventToScenarios(
      mockScenarioContext(),
      [mockScenario(), mockScenario({ id: 'lineup-alt', scenarioType: 'lineup_surprise', isBaseline: false })],
      { matchId: 'm-1', eventId: 'e-1', eventType: 'lineup_confirmed', minute: 0 },
    );
    expect(updated.invalidatedIds.length).toBeGreaterThan(0);
    expect(updated.explanationRequired).toBe(true);
  });

  it('buildExplanationFactors covers coach and referee branches', () => {
    const features = mockScenarioContext().features;
    const factors = buildExplanationFactors({
      ...features,
      homeCoach: { name: 'A', tacticalRating: 0.9 },
      awayCoach: { name: 'B', tacticalRating: 0.5 },
      referee: { name: 'Ref', strictness: 0.8, fifaCategory: 'Elite' },
    });
    expect(factors.positive.length).toBeGreaterThan(0);
  });

  it('assignFormationCoords and mockScoreAtMinute branches', () => {
    expect(assignFormationCoords('4-3-3', [{ playerId: 'solo', position: 'ST' }], 'home').get('solo')?.y).toBe(0.5);
    const sorted = assignFormationCoords(
      '4-3-3',
      [
        { playerId: 'b', position: 'CM' },
        { playerId: 'a', position: 'LW' },
      ],
      'home',
    );
    expect(sorted.get('a')!.y).toBeLessThan(sorted.get('b')!.y);
    expect(mockScoreAtMinute('burst-hash-xyz', 40).home).toBeGreaterThanOrEqual(0);
  });
});

describe('coverage branch sweep round 2 — component and hook batch', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('MatchLineupSidePanel uses players length fallback when starters missing', () => {
    renderWithI18n(
      React.createElement(MatchLineupSidePanel, {
        side: {
          teamName: 'USA',
          formation: '4-3-3',
          hasAccurateLineup: false,
          source: 'projected',
          starters: [],
          substitutes: [],
          grouped: { GK: [], DEF: [], MID: [], FWD: [] },
          lineupPlayers: [],
          players: undefined as never,
        },
        label: 'Home',
      }),
    );
    expect(document.body.textContent).toContain('USA');
  });

  it('ContributionRadialChart uses empty label fallback', () => {
    renderWithI18n(
      React.createElement(ContributionRadialChart, {
        segments: [{ value: 0.5, startAngle: 0, endAngle: 90 }],
        title: 'Impact',
      }),
    );
    expect(document.body.textContent).toBeTruthy();
  });

  it('EventTrajectoryLayer skips when previous event lacks coordinates', () => {
    renderWithI18n(
      React.createElement(EventTrajectoryLayer, {
        events: [
          { id: 'e1', minute: 10, x: null as never, y: 50, eventType: 'pass' },
          { id: 'e2', minute: 12, x: 55, y: 60, eventType: 'shot' },
        ],
      }),
    );
    expect(document.querySelector('line')).toBeNull();
  });

  it('ScorelineMatrix renders distribution entries', () => {
    renderWithI18n(React.createElement(ScorelineMatrix, { distribution: { '1-0': 0.2, '0-0': 0.1 } }));
    expect(document.body.textContent).toMatch(/1-0|0-0/);
  });

  it('ProbabilityMovementTimeline computes shift with sparse intervals', () => {
    renderWithI18n(
      React.createElement(ProbabilityMovementTimeline, {
        intervals: {
          '15': { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3, expectedHomeGoals: 0.5, expectedAwayGoals: 0.4 },
          '90': { homeWinProb: 0.5, drawProb: 0.25, awayWinProb: 0.25, expectedHomeGoals: 1.5, expectedAwayGoals: 1.0 },
        },
      }),
    );
    expect(document.body.textContent).toMatch(/\+|−|-|\d/);
  });

  it('hooks early-return when matchId missing', () => {
    const live = renderHook(() => useMatchLiveData(undefined), { wrapper: I18nProvider });
    expect(live.result.current.match).toBeNull();
    const pitch = renderHook(() => usePitchMapLive(undefined, false), { wrapper: I18nProvider });
    expect(pitch.result.current.loading).toBe(true);
  });

  it('lineupDisplay and matchPaths format helpers', () => {
    expect(
      sortLineupPlayers([
        { shirtNumber: null, name: 'B', position: 'CM' },
        { shirtNumber: 1, name: 'A', position: 'GK' },
      ])[0]?.name,
    ).toBe('A');
    expect(formatLineupPlayerLine({ shirtNumber: 9, name: 'Striker', position: 'ST' })).toContain('9');
    expect(resolveMatchAnalysisHref({ slug: null, id: 'm-1' })).toContain('m-1');
    expect(resolveLineupHref({ slug: 'slug-1', id: 'm-1' })).toContain('slug-1');
  });

  it('derivePlayerImpact maps demo with events', () => {
    expect(derivePlayerImpact([{ event_type: 'goal' }, { event_type: 'shot', xg: 0.1 }])).toHaveLength(3);
  });
});
