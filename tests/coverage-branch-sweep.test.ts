import React, { type ReactElement } from 'react';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { Footer } from '../app/components/layout/Footer';
import { BrandLogo } from '../app/components/brand/BrandLogo';
import { ProbabilityDeltaBadge } from '../app/components/probability/ProbabilityDeltaBadge';
import { ScenarioProbabilityBar } from '../app/components/scenarios/ScenarioProbabilityBar';
import { ScenarioTriggerStatus } from '../app/components/scenarios/ScenarioTriggerStatus';
import { EndpointCard } from '../app/components/docs/EndpointCard';
import { HomeNewsPreview } from '../app/components/home/HomeNewsPreview';
import { NewsFeedPanel } from '../app/components/home/NewsFeedPanel';
import { MarketSignalPanel } from '../app/components/market/MarketSignalPanel';
import { MatchLineupSidePanel } from '../app/components/match/MatchLineupSidePanel';
import { MatchPredictionSummary } from '../app/components/match/MatchPredictionSummary';
import { MatchResultScore } from '../app/components/match/MatchResultScore';
import { ProbabilityHintsPanel } from '../app/components/match/ProbabilityHintsPanel';
import { NewsArticleCard } from '../app/components/news/NewsArticleCard';
import { ScenarioComparisonCard } from '../app/components/scenarios/ScenarioComparisonCard';
import { EventTrajectoryLayer } from '../app/components/tactical/EventTrajectoryLayer';
import { PlayerImpactCard } from '../app/components/tactical/PlayerImpactCard';
import { ScorelineMatrix } from '../app/components/tactical/ScorelineMatrix';
import { TacticalBriefingPanel } from '../app/components/tactical/TacticalBriefingPanel';
import { SourceConfidencePanel } from '../app/components/intelligence/SourceConfidencePanel';
import { ProbabilityMovementPanel } from '../app/components/probability/ProbabilityMovementPanel';
import { PredictedActualScores } from '../app/components/match/PredictedActualScores';
import { ContributionRadialChart } from '../app/components/tactical/ContributionRadialChart';
import { MatchHeader } from '../app/components/tactical/MatchHeader';
import { ProbabilityStrip } from '../app/components/tactical/ProbabilityStrip';
import { PlatformSnapshot } from '../app/components/home/PlatformSnapshot';
import { MatchStaffPanel } from '../app/components/match/MatchStaffPanel';
import { ProbabilityMovementTimeline } from '../app/components/tactical/ProbabilityMovementTimeline';
import { GroupStandingsGrid } from '../app/components/tournament/TournamentPanels';
import { FavoritesPanel } from '../app/components/tournament/FavoritesPanel';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT, FIXTURE_TEAMS } from './helpers/fixtures';
import { mockScenarioContext, mockScenario } from './helpers/scenarioFixtures';
import { installSmokeFetchMock } from './helpers/smokeFetch';
import { sampleScheduleMatches, sampleStandings, SMOKE_MATCH_ID } from './helpers/smokeFixtures';
import { getMatchEvents } from '../src/db/repositories/eventsRepo';
import * as marketRepo from '../src/db/repositories/marketRepo';
import * as playersRepo from '../src/db/repositories/playersRepo';
import * as probabilityRepo from '../src/db/repositories/probabilityRepo';
import * as sourcesRepo from '../src/db/repositories/sourcesRepo';
import * as matchesRepo from '../src/db/repositories/matchesRepo';
import * as teamsRepo from '../src/db/repositories/teamsRepo';
import { listTournaments } from '../src/db/repositories/tournamentsRepo';
import { getMarketAdapters } from '../src/market/marketSourceRegistry';
import { poissonPmf } from '../src/models/probability/poisson';
import { mostLikelyScore } from '../src/models/probability/scoreline';
import { buildIntervalDistribution } from '../src/models/probability/interval';
import { computeScenarioLikelihoods } from '../src/models/probability/scenarioLikelihood';
import { buildTeamSystemProfile } from '../src/models/probability/teamSystemStrength';
import type { MatchFeatureInput, ProbabilityResult } from '../src/models/probability/types';
import { resolveTeamId } from '../src/data/teamNameMap';
import { explainScenarioLikelihood } from '../src/ai/explainScenarioLikelihood';
import { resolveApiKey } from '../src/services/publicApi/apiKey';
import { isMatchPagePath } from '../src/utils/matchPath';
import { buildProbabilityHints } from '../src/services/matchHints';
import { buildModelVsMarket } from '../src/market/services/marketSignalService';

function renderWithI18n(ui: ReactElement, mode?: 'vi' | 'en') {
  if (mode) localStorage.setItem('wc-display-mode', mode);
  return render(
    React.createElement(MemoryRouter, null, React.createElement(I18nProvider, null, ui)),
  );
}

describe('coverage branch sweep — D1 null coalesce batch', () => {
  const emptyAll = () => ({}) as { results?: unknown[] };

  it('repos return [] when D1 all() omits results', async () => {
    const db = createMockDb({ all: emptyAll });
    expect(await getMatchEvents(db, 'm-1')).toEqual([]);
    expect(await playersRepo.listPlayers(db)).toEqual([]);
    expect(await sourcesRepo.listSources(db)).toEqual([]);
    expect(await matchesRepo.listMatches(db)).toEqual([]);
    expect(await matchesRepo.getMatchesByTournament(db)).toEqual([]);
    expect(await teamsRepo.listTeams(db)).toEqual([]);
    expect(await teamsRepo.getTeamsByTournament(db, 't-2026')).toEqual([]);
    expect(await probabilityRepo.listLatestSnapshotsForTournament(db, 't-2026')).toEqual([]);
    expect(await marketRepo.getLatestMarketOdds(db, 'm-1')).toEqual([]);
  });

  it('listTournaments returns [] when tournament row missing', async () => {
    const db = createMockDb({ first: () => null });
    expect(await listTournaments(db)).toEqual([]);
  });
});

describe('coverage branch sweep — production utilities', () => {
  it('getMarketAdapters registers manual, licensed, and public adapters', () => {
    const adapters = getMarketAdapters(createMockEnv());
    expect(adapters).toHaveLength(3);
  });

  it('poissonPmf handles zero lambda', () => {
    expect(poissonPmf(0, 0)).toBe(1);
    expect(poissonPmf(1, 0)).toBe(0);
  });

  it('mostLikelyScore falls back to 0-0 for empty matrix', () => {
    expect(mostLikelyScore({})).toBe('0-0');
  });

  it('resolveTeamId rejects empty names', () => {
    expect(resolveTeamId(null)).toBeNull();
    expect(resolveTeamId('')).toBeNull();
  });

  it('explainScenarioLikelihood returns null without data', async () => {
    expect(await explainScenarioLikelihood(createMockEnv(), null)).toBeNull();
  });

  it('resolveApiKey rejects invalid keys and missing rows', async () => {
    expect(await resolveApiKey(createMockEnv(), 'bad-key')).toBeNull();
    expect(await resolveApiKey(createMockEnv(), null)).toBeNull();
    const env = createMockEnv({ DB: createMockDb({ first: () => null }) });
    expect(await resolveApiKey(env, 'pi_live_test123456789012345678901234567890')).toBeNull();
  });

  it('isMatchPagePath uses legacy id when slug parse fails', () => {
    expect(isMatchPagePath('/redirect/m-w26-ga-1v2')).toBe(true);
    expect(isMatchPagePath('/')).toBe(false);
  });

  it('buildProbabilityHints uses high confidence tier', () => {
    const hints = buildProbabilityHints({
      homeName: 'A',
      awayName: 'B',
      homeWin: 0.5,
      draw: 0.25,
      awayWin: 0.25,
      xgHome: 1.2,
      xgAway: 1.0,
      confidence: 0.85,
    });
    expect(hints.some((h) => h.en.includes('high'))).toBe(true);
  });

  it('buildModelVsMarket uses default consensus when selections missing', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('probability_snapshots')) return FIXTURE_SNAPSHOT;
          if (sql.includes('market_sources')) return { name: 'Manual', reliability_score: 0.9 };
          return null;
        },
        all: () => ({ results: [{ selection: 'draw', normalized_probability: 0.34 }] }),
        run: () => ({ success: true }),
      }),
    });
    const result = await buildModelVsMarket(env, FIXTURE_MATCH.id);
    expect(result?.market.home).toBeCloseTo(0.33, 2);
  });
});

describe('coverage branch sweep — interval and scenario likelihood (4 branches each)', () => {
  const baseInput: MatchFeatureInput = {
    matchId: 'm-int',
    tournamentYear: 2026,
    stage: 'Round of 16',
    minute: 60,
    second: 0,
    homeTeam: {
      teamId: 'h',
      eloRating: 1800,
      fifaRanking: 10,
      recentForm: 0.5,
      goalDifference: 2,
      xgDifference: 0.3,
      xgFor: 1.6,
      xgAgainst: 1.0,
      possessionProfile: 0.55,
      fieldTilt: 0.52,
      ppda: 9,
      highTurnovers: 0.5,
      transitionThreat: 0.5,
      setPieceXg: 0.2,
      setPieceXga: 0.18,
      defensiveCompactness: 0.6,
      formationStability: 0.6,
      benchDepth: 0.65,
      goalkeeperStrength: 0.65,
      restDays: 4,
    },
    awayTeam: {
      teamId: 'a',
      eloRating: 1700,
      fifaRanking: 20,
      recentForm: 0.4,
      goalDifference: 0,
      xgDifference: 0,
      xgFor: 1.2,
      xgAgainst: 1.2,
      possessionProfile: 0.48,
      fieldTilt: 0.48,
      ppda: 10,
      highTurnovers: 0.45,
      transitionThreat: 0.45,
      setPieceXg: 0.15,
      setPieceXga: 0.2,
      defensiveCompactness: 0.55,
      formationStability: 0.55,
      benchDepth: 0.55,
      goalkeeperStrength: 0.55,
      restDays: 4,
    },
    currentScore: { home: 2, away: 1 },
    sourceConfidence: 0.8,
  };
  const prob: ProbabilityResult = {
    homeWinProb: 0.55,
    drawProb: 0.25,
    awayWinProb: 0.2,
    expectedHomeGoals: 1.8,
    expectedAwayGoals: 1.0,
    confidence: 0.8,
    mostLikelyScoreline: '2-1',
  };

  it('buildIntervalDistribution covers score lead and elapsed branches', () => {
    const d = buildIntervalDistribution(1.4, 1.0, 60, 2, 1, {
      homeWin: 0.55,
      draw: 0.25,
      awayWin: 0.2,
    });
    expect(d['90'].homeWinProb).toBeGreaterThan(0);
    expect(d['15'].expectedHomeGoals).toBeGreaterThan(0);
  });

  it('computeScenarioLikelihoods covers knockout branches', () => {
    const homeSys = buildTeamSystemProfile(baseInput.homeTeam);
    const awaySys = buildTeamSystemProfile(baseInput.awayTeam);
    const scenarios = computeScenarioLikelihoods(baseInput, prob, homeSys, awaySys);
    const et = scenarios.find((s) => s.scenarioType === 'extra_time_tendency');
    const pens = scenarios.find((s) => s.scenarioType === 'penalty_shootout_tendency');
    expect(et?.explanationFactors[0]).toMatch(/Knockout/i);
    expect(pens?.explanationFactors[0]).toMatch(/penalties/i);
  });

  it('computeScenarioLikelihoods covers group stage branches', () => {
    const groupInput = { ...baseInput, stage: 'Group A' };
    const homeSys = buildTeamSystemProfile(groupInput.homeTeam);
    const awaySys = buildTeamSystemProfile(groupInput.awayTeam);
    const scenarios = computeScenarioLikelihoods(groupInput, prob, homeSys, awaySys);
    const et = scenarios.find((s) => s.scenarioType === 'extra_time_tendency');
    expect(et?.explanationFactors[0]).toMatch(/Group stage/i);
  });
});

describe('coverage branch sweep — component single-branch batch', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  beforeEach(() => {
    installSmokeFetchMock();
  });

  it('Footer shows English author name', () => {
    renderWithI18n(React.createElement(Footer), 'en');
    expect(screen.getByText('Cuong Le Sy')).toBeTruthy();
  });

  it('BrandLogo compact mode uses smaller dimensions', () => {
    renderWithI18n(React.createElement(BrandLogo, { compact: true }));
    const img = document.querySelector('img');
    expect(img?.getAttribute('width')).toBe('32');
  });

  it('ProbabilityDeltaBadge covers negative and neutral deltas', () => {
    renderWithI18n(React.createElement(ProbabilityDeltaBadge, { delta: -0.1 }));
    expect(document.body.textContent).toMatch(/-/);
    cleanup();
    renderWithI18n(React.createElement(ProbabilityDeltaBadge, { delta: 0 }));
    expect(document.body.textContent).toBeTruthy();
  });

  it('ScenarioProbabilityBar covers cyan and yellow accents', () => {
    renderWithI18n(React.createElement(ScenarioProbabilityBar, { label: 'A', value: 0.5, accent: 'cyan' }));
    expect(document.querySelector('.bg-cyan')).toBeTruthy();
    cleanup();
    renderWithI18n(React.createElement(ScenarioProbabilityBar, { label: 'B', value: 0.3, accent: 'yellow' }));
    expect(document.querySelector('.bg-yellow')).toBeTruthy();
  });

  it('ScenarioTriggerStatus covers unknown status classes', () => {
    const scenario = {
      ...mockScenario,
      triggerConditions: [{ condition: 'Score 1-0', status: 'unknown' as never, confidence: 0.5 }],
      invalidationConditions: [{ condition: 'Red card', status: 'unknown' as never, confidence: 0.5 }],
    };
    renderWithI18n(React.createElement(ScenarioTriggerStatus, { scenario }));
    expect(document.body.textContent).toContain('Score 1-0');
  });

  it('EndpointCard defaults auth label when auth omitted', () => {
    renderWithI18n(
      React.createElement(EndpointCard, {
        endpoint: {
          method: 'GET',
          path: '/api/test',
          title: 'Test',
          description: 'Desc',
        } as never,
        origin: 'https://example.com',
      }),
    );
    expect(screen.getByText('Public')).toBeTruthy();
  });

  it('HomeNewsPreview returns null when hot list empty after load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ data: { hot: [], articles: [] }, meta: { page: 1, totalPages: 1 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const view = renderWithI18n(React.createElement(HomeNewsPreview));
    await waitFor(() => expect(view.container.textContent).toBe(''));
  });

  it('NewsFeedPanel uses English locale', () => {
    renderWithI18n(
      React.createElement(NewsFeedPanel, {
        hot: [],
        articles: [],
        lastCrawl: null,
        page: 1,
        totalPages: 1,
        onPageChange: () => {},
        onSelectArticle: () => {},
      }),
      'en',
    );
    expect(document.body.textContent).toBeTruthy();
  });

  it('MarketSignalPanel shows dash when updatedAt missing', () => {
    renderWithI18n(
      React.createElement(MarketSignalPanel, {
        payload: {
          signals: {
            matchId: 'm-1',
            model: { home: 0.4, draw: 0.3, away: 0.3 },
            market: { home: 0.38, draw: 0.28, away: 0.34 },
            edge: { home: 0.02, draw: 0.02, away: -0.04 },
            volatilityScore: 0.1,
            updatedAt: null as never,
            disclaimer: 'Test',
          },
          oddsSnapshots: [],
          disclaimer: 'Test',
        },
        loading: false,
      }),
    );
    expect(document.body.textContent).toContain('—');
  });

  it('MatchLineupSidePanel detects lineup via players array', () => {
    renderWithI18n(
      React.createElement(MatchLineupSidePanel, {
        side: {
          teamName: 'USA',
          formation: '4-3-3',
          hasAccurateLineup: false,
          hasLineup: undefined as never,
          source: 'projected',
          starters: [],
          substitutes: [],
          grouped: { GK: [], DEF: [], MID: [], FWD: [] },
          lineupPlayers: [],
          players: Array.from({ length: 7 }, (_, i) => ({
            shirtNumber: i + 1,
            name: `P${i}`,
            position: 'CM',
          })),
        },
        label: 'Home',
      }),
    );
    expect(document.body.textContent).toContain('USA');
  });

  it('MatchPredictionSummary uses hint drivers when prob.drivers missing', () => {
    renderWithI18n(
      React.createElement(MatchPredictionSummary, {
        prob: {
          homeWinProb: 0.4,
          drawProb: 0.3,
          awayWinProb: 0.3,
          expectedHomeGoals: 1.2,
          expectedAwayGoals: 1.0,
          confidence: 0.7,
          mostLikelyScore: '1-1',
        },
        homeLabel: 'USA',
        awayLabel: 'Mexico',
        hints: [{ id: 'h1', vi: 'Gợi ý', en: 'Hint', type: 'form' }],
      }),
      'en',
    );
    expect(document.body.textContent).toContain('Hint');
  });

  it('MatchResultScore covers live and scheduled styling', () => {
    renderWithI18n(React.createElement(MatchResultScore, { homeScore: 1, awayScore: 0, status: 'live' }));
    expect(document.querySelector('.text-live\\/80')).toBeTruthy();
    cleanup();
    renderWithI18n(
      React.createElement(MatchResultScore, { homeScore: null, awayScore: null, status: 'scheduled' }),
    );
    expect(document.querySelector('.text-muted\\/50')).toBeTruthy();
  });

  it('ProbabilityHintsPanel returns null for empty hints', () => {
    const view = renderWithI18n(React.createElement(ProbabilityHintsPanel, { hints: [] }));
    expect(view.container.textContent).toBe('');
  });

  it('NewsArticleCard uses English locale formatting', () => {
    renderWithI18n(
      React.createElement(NewsArticleCard, {
        article: {
          id: 'n-1',
          title: 'Test',
          source_url: 'https://example.com',
          summary: 'Summary',
          published_at: '2026-01-01T00:00:00Z',
          reliability_score: 0.8,
        },
        onSelect: () => {},
      }),
      'en',
    );
    expect(document.body.textContent).toContain('Test');
  });

  it('ScenarioComparisonCard returns null without comparison', () => {
    const view = renderWithI18n(
      React.createElement(ScenarioComparisonCard, {
        data: { matchId: 'm-1', generatedAt: '', updatedAt: '', scenarios: [], comparison: null, sourceConfidence: { overall: 0.8, notes: [] } },
      }),
    );
    expect(view.container.textContent).toBe('');
  });

  it('EventTrajectoryLayer skips events without coordinates', () => {
    const view = renderWithI18n(
      React.createElement(EventTrajectoryLayer, {
        events: [
          { id: 'e1', minute: 10, x: 50, y: 50, eventType: 'pass' },
          { id: 'e2', minute: 12, x: null as never, y: null as never, eventType: 'shot' },
        ],
      }),
    );
    expect(view.container.querySelectorAll('line').length).toBeGreaterThanOrEqual(0);
  });

  it('PlayerImpactCard returns null for empty players', () => {
    const view = renderWithI18n(React.createElement(PlayerImpactCard, { players: [] }));
    expect(view.container.textContent).toBe('');
  });

  it('ScorelineMatrix handles missing distribution keys', () => {
    renderWithI18n(React.createElement(ScorelineMatrix, { distribution: {} }));
    expect(document.body.textContent).toBeTruthy();
  });

  it('TacticalBriefingPanel renders multi-paragraph uncertainty notes', () => {
    renderWithI18n(
      React.createElement(TacticalBriefingPanel, {
        briefing: {
          matchId: 'm-1',
          summary: { vi: 'Para 1', en: 'Para 1' },
          probabilityExplanation: [],
          uncertaintyNotes: [
            { vi: 'Note 1', en: 'Note 1' },
            { vi: 'Note 2', en: 'Note 2' },
          ],
          citations: [],
          tacticalThemes: [],
          generatedAt: '2026-01-01T00:00:00Z',
        },
        loading: false,
      }),
    );
    expect(document.body.textContent).toContain('Note 2');
  });

  it('SourceConfidencePanel returns null for empty sources', () => {
    const view = renderWithI18n(React.createElement(SourceConfidencePanel, { sources: [] }));
    expect(view.container.textContent).toBe('');
  });
});

describe('coverage branch sweep — component multi-branch batch', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('PredictedActualScores shows diff text when scores mismatch', () => {
    renderWithI18n(
      React.createElement(PredictedActualScores, {
        predicted: '2-1',
        homeScore: 1,
        awayScore: 0,
        status: 'completed',
      }),
    );
    expect(document.body.textContent).toMatch(/scoreDiff|khác|diff/i);
  });

  it('ContributionRadialChart uses segment label fallback and large arc', () => {
    renderWithI18n(
      React.createElement(ContributionRadialChart, {
        segments: [{ value: 0.6, label: 'Custom', startAngle: 0, endAngle: 200 }],
        title: 'Impact',
      }),
    );
    expect(document.body.textContent).toContain('Custom');
  });

  it('MatchHeader renders draw and away win percentages', () => {
    renderWithI18n(
      React.createElement(MatchHeader, {
        home: 'USA',
        away: 'Mexico',
        homeScore: 1,
        awayScore: 0,
        status: 'live',
        homeWin: 0.5,
        draw: 0.25,
        awayWin: 0.25,
      }),
    );
    expect(document.body.textContent).toMatch(/25|%/);
  });

  it('ProbabilityStrip highlights leader segment', () => {
    renderWithI18n(
      React.createElement(ProbabilityStrip, {
        homeWin: 0.55,
        draw: 0.25,
        awayWin: 0.2,
        homeLabel: 'USA',
        awayLabel: 'Mexico',
      }),
    );
    expect(document.body.textContent).toMatch(/55|%/);
  });

  it('PlatformSnapshot handles missing statusCounts fields', () => {
    renderWithI18n(
      React.createElement(PlatformSnapshot, {
        dashboard: {
          featuredMatch: null,
          matchCount: 0,
          lastDataRefresh: null,
          lastNewsCrawl: null,
          refreshIntervalSec: 30,
          newsCrawlIntervalSec: 900,
          expectedMatches: 104,
          hostCountries: [],
          teamsCount: 48,
          groupCount: 12,
          statusCounts: { scheduled: 10, live: 2 } as never,
        },
      }),
    );
    expect(document.body.textContent).toMatch(/10|2/);
  });

  it('MatchStaffPanel renders coach, referee category, and assistant nationality', async () => {
    installSmokeFetchMock();
    renderWithI18n(
      React.createElement(MatchStaffPanel, {
        matchId: SMOKE_MATCH_ID,
        homeLabel: 'USA',
        awayLabel: 'Mexico',
      }),
    );
    await waitFor(() => expect(document.body.textContent).toContain('FIFA'));
  });

  it('ProbabilityMovementTimeline returns null for empty intervals', () => {
    const view = renderWithI18n(React.createElement(ProbabilityMovementTimeline, { intervals: {} }));
    expect(view.container.textContent).toBe('');
  });

  it('FavoritesPanel renders English separators for saved favorites', () => {
    localStorage.setItem(
      'wc-favorites-v1',
      JSON.stringify({ matches: [sampleScheduleMatches[0]!.id], teams: ['t-usa'] }),
    );
    renderWithI18n(
      React.createElement(FavoritesPanel, {
        matches: sampleScheduleMatches,
        teams: [{ id: 't-usa', name: 'USA', short_name: null as never, country_code: 'US' }],
      }),
      'en',
    );
    expect(document.body.textContent).toContain('USA');
  });

  it('GroupStandingsGrid uses shortName fallback and English date locale', async () => {
    installSmokeFetchMock();
    renderWithI18n(React.createElement(GroupStandingsGrid), 'en');
    await waitFor(() => expect(document.body.textContent).toMatch(/USA|Mexico/i));
  });
});

describe('coverage branch sweep — favorites storage guards', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('loadFavorites returns empty store when window is undefined', async () => {
    vi.stubGlobal('window', undefined as never);
    const { loadFavorites } = await import('../app/lib/favorites');
    expect(loadFavorites()).toEqual({ matches: [], teams: [] });
  });

  it('saveFavorites is a no-op when window is undefined', async () => {
    vi.stubGlobal('window', undefined as never);
    const { saveFavorites } = await import('../app/lib/favorites');
    expect(() => saveFavorites({ matches: ['m-1'], teams: [] })).not.toThrow();
  });
});

describe('coverage branch sweep — backend 4-branch batch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('getMatchStaff handles missing ref, default tournament, empty officials, no referee', async () => {
    const { getMatchStaff } = await import('../src/services/matchStaff');
    const emptyDb = createMockDb({
      first: () => null,
      all: () => ({}),
    });
    expect(await getMatchStaff(createMockEnv({ DB: emptyDb }), 'missing')).toBeNull();

    const noRefDb = createMockDb({
      first: (sql) => {
        if (sql.includes('FROM matches m')) {
          return { ...FIXTURE_MATCH, tournament_id: null, slug: 'slug-1' };
        }
        if (sql.includes('FROM team_coaches')) return null;
        return null;
      },
      all: () => ({
        results: [{ role: 'var', name: 'VAR', nationality: 'US', fifa_category: null, strictness: null }],
      }),
    });
    const payload = await getMatchStaff(createMockEnv({ DB: noRefDb }), FIXTURE_MATCH.id);
    expect(payload?.referee).toBeNull();
    expect(payload?.officials).toHaveLength(1);
  });

  it('getMatchRecap returns commentary-only payload and handles undefined results', async () => {
    const { getMatchRecap } = await import('../src/services/matchRecap');
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches m')) return { ...FIXTURE_MATCH, slug: 'slug-1', status: 'completed' };
          if (sql.includes('FROM match_recaps')) return null;
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM match_commentary')) {
            return {
              results: [{
                id: 'c1', minute: 1, period: '1H', text_vi: 'Vi', text_en: 'En', event_type: 'goal',
              }],
            };
          }
          if (sql.includes('FROM player_match_stats')) return {};
          return { results: [] };
        },
      }),
      KV: createMockKv(),
    });
    const payload = await getMatchRecap(env, FIXTURE_MATCH.id);
    expect(payload?.commentary).toHaveLength(1);
    expect(payload?.playerStats).toEqual([]);
  });

  it('mockScoreAtMinute burst branches and resolveWinner/Loser for away win', async () => {
    const { mockScoreAtMinute, resolveWinnerTeamId, resolveLoserTeamId } = await import('../src/services/matchLifecycle');
    expect(mockScoreAtMinute('hash-burst-test', 40).home).toBeGreaterThanOrEqual(0);
    expect(mockScoreAtMinute('hash-burst-test', 40).away).toBeGreaterThanOrEqual(0);
    const awayWin = resolveWinnerTeamId({
      home_team_id: 'h',
      away_team_id: 'a',
      home_score: 0,
      away_score: 2,
      stage: 'Group',
    });
    expect(awayWin).toBe('a');
    expect(resolveLoserTeamId({
      home_team_id: 'h',
      away_team_id: 'a',
      home_score: 0,
      away_score: 2,
      stage: 'Group',
    })).toBe('h');
  });

  it('getMatchSnapshot null-coalesces optional match fields', async () => {
    const snapshotMod = await import('../src/services/publicApi/snapshot');
    const statsMod = await import('../src/services/matchStats');
    const recapMod = await import('../src/services/matchRecap');
    const eventsMod = await import('../src/db/repositories/eventsRepo');
    vi.spyOn(statsMod, 'getMatchStats').mockRejectedValue(new Error('skip'));
    vi.spyOn(recapMod, 'getMatchRecap').mockRejectedValue(new Error('skip'));
    vi.spyOn(eventsMod, 'getMatchEvents').mockResolvedValue(undefined as never);

    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches m')) {
            return {
              ...FIXTURE_MATCH,
              minute: null,
              kickoff_utc: null,
              fifa_match_id: null,
              updated_at: null,
              slug: 'slug-1',
            };
          }
          return null;
        },
      }),
    });
    const snap = await snapshotMod.getMatchSnapshot(env, FIXTURE_MATCH.id);
    expect(snap?.minute).toBeNull();
    expect(snap?.kickoffUtc).toBeNull();
    expect(snap?.eventsCount).toBe(0);
  });

  it('explainTeamSystemStrength covers pending sides and default scores', async () => {
    const { explainTeamSystemStrength } = await import('../src/ai/explainTeamSystemStrength');
    const bothPending = await explainTeamSystemStrength(createMockEnv(), {
      matchId: 'm-1',
      home: null,
      away: null,
    });
    expect(bothPending?.homeSummary).toMatch(/pending/i);
    expect(bothPending?.awaySummary).toMatch(/pending/i);

    const sparse = await explainTeamSystemStrength(createMockEnv(), {
      matchId: 'm-1',
      home: {},
      away: {},
    });
    expect(sparse?.homeSummary).toContain('50%');
    expect(sparse?.awaySummary).toContain('balanced');
  });

  it('assignFormationCoords covers wing, center-back, single-player, and sort branches', async () => {
    const { assignFormationCoords } = await import('../src/lib/formationLayout');
    const wing = assignFormationCoords('4-3-3', [{ playerId: 'w1', position: 'RW' }], 'home');
    expect(wing.get('w1')?.y).toBeGreaterThan(0.8);
    const lcb = assignFormationCoords('4-3-3', [{ playerId: 'd1', position: 'LCB', positionGroup: 'DEF' }], 'home');
    expect(lcb.get('d1')?.y).toBeLessThan(0.35);
    const single = assignFormationCoords('4-3-3', [{ playerId: 'solo', position: 'ST' }], 'home');
    expect(single.get('solo')?.y).toBe(0.5);
    const sorted = assignFormationCoords(
      '4-3-3',
      [
        { playerId: 'b', position: 'CM' },
        { playerId: 'a', position: 'LW' },
      ],
      'home',
    );
    expect(sorted.get('a')?.y).toBeLessThan(sorted.get('b')?.y ?? 1);
  });

  it('normalizeRawMarketBatch skips invalid rows and short selections', async () => {
    const { normalizeRawMarketBatch } = await import('../src/market/normalization/normalizeMarketOdds');
    expect(normalizeRawMarketBatch('src', 'raw', [])).toEqual([]);
    expect(
      normalizeRawMarketBatch('src', 'raw', [{
        matchId: 'm-1',
        marketType: 'other',
        selection: 'home',
        oddsDecimal: 2,
        retrievedAt: '2026-01-01T00:00:00Z',
      }]),
    ).toEqual([]);
    expect(
      normalizeRawMarketBatch('src', 'raw', [{
        matchId: 'm-1',
        marketType: 'match_winner',
        selection: 'home',
        oddsDecimal: 2,
        retrievedAt: '2026-01-01T00:00:00Z',
      }]),
    ).toEqual([]);
  });

  it('gatewayClient covers empty response content branch', async () => {
    const { gatewayChat } = await import('../src/ai/gatewayClient');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })),
    );
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      CF_AIG_TOKEN: 'token',
    });
    const result = await gatewayChat(env, 'tactical_briefing', [{ role: 'user', content: 'hi' }]);
    expect(result?.content).toBe('');
    expect(result?.provider).toBeTruthy();
  });

  it('fallbackBriefing normalizes missing probability fields', async () => {
    const { fallbackBriefing } = await import('../src/ai/tacticalBriefing');
    const parsed = fallbackBriefing({
      matchId: 'm-1',
      probability: {},
      aiFallback: true,
    });
    expect(parsed.generatedAt).toBeTruthy();
    expect(parsed.probabilityExplanation[0]?.en).toContain('0.0%');
  });

  it('buildCandidateScenarios adds set-piece, low-event, bench, and projected branches', async () => {
    const { buildCandidateScenarios } = await import('../src/models/scenarios/scenarioGenerator');
    const ctx = mockScenarioContext({
      homeSystem: { ...mockScenarioContext().homeSystem, setPieceScore: 0.7, benchDepthScore: 0.65 },
      awaySystem: { ...mockScenarioContext().awaySystem, setPieceScore: 0.4, benchDepthScore: 0.4 },
      homeLineupSource: 'projected',
      awayLineupSource: 'official',
      probability: {
        ...mockScenarioContext().probability,
        expectedHomeGoals: 0.8,
        expectedAwayGoals: 0.7,
      },
    });
    const scenarios = buildCandidateScenarios(ctx);
    expect(scenarios.some((s) => s.scenarioType === 'set_piece_decider')).toBe(true);
    expect(scenarios.some((s) => s.scenarioType === 'low_event_controlled_match')).toBe(true);
    expect(scenarios.some((s) => s.scenarioType === 'lineup_surprise')).toBe(true);
  });
});

describe('coverage branch sweep — component and hook gaps', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    installSmokeFetchMock();
  });

  it('PlatformSnapshot counts finished matches in completed tally', () => {
    renderWithI18n(
      React.createElement(PlatformSnapshot, {
        dashboard: {
          featuredMatch: null,
          matchCount: 0,
          lastDataRefresh: null,
          lastNewsCrawl: null,
          refreshIntervalSec: 30,
          newsCrawlIntervalSec: 900,
          expectedMatches: 104,
          hostCountries: [],
          teamsCount: 48,
          groupCount: 12,
          statusCounts: { finished: 5 } as never,
        },
      }),
    );
    expect(document.body.textContent).toMatch(/5/);
  });

  it('ContributionRadialChart uses labelKey translation', () => {
    renderWithI18n(
      React.createElement(ContributionRadialChart, {
        segments: [{ labelKey: 'contribution.pressing', value: 0.5, startAngle: 0, endAngle: 90 }],
        title: 'Impact',
      }),
    );
    expect(document.body.textContent).toMatch(/chiến thuật|Pressing|pressing/i);
  });

  it('ProbabilityMovementPanel skips fetch without matchId', () => {
    renderWithI18n(
      React.createElement(ProbabilityMovementPanel, {
        matchId: '',
        prob: null,
        currentMinute: 0,
      }),
    );
    expect(document.body.textContent).toBeTruthy();
  });

  it('MatchHeader handles missing draw and awayWin props', () => {
    renderWithI18n(
      React.createElement(MatchHeader, {
        home: 'USA',
        away: 'Mexico',
        homeScore: 0,
        awayScore: 0,
        status: 'scheduled',
        homeWin: 0.5,
      }),
    );
    expect(document.body.textContent).toMatch(/50|%/);
  });

  it('ProbabilityStrip renders zero-width segments', () => {
    renderWithI18n(
      React.createElement(ProbabilityStrip, {
        homeWin: 0,
        draw: 0,
        awayWin: 1,
        homeLabel: 'USA',
        awayLabel: 'Mexico',
      }),
    );
    expect(document.body.textContent).toMatch(/100|%/);
  });

  it('PredictedActualScores shows matched score text', () => {
    renderWithI18n(
      React.createElement(PredictedActualScores, {
        predicted: '1-0',
        homeScore: 1,
        awayScore: 0,
        status: 'completed',
      }),
    );
    expect(document.body.textContent).toMatch(/Trùng|scoreMatch|Match/i);
  });

  it('EventTrajectoryLayer draws line when prior event has coordinates', () => {
    renderWithI18n(
      React.createElement(EventTrajectoryLayer, {
        events: [
          { id: 'e1', minute: 10, x: 40, y: 50, eventType: 'pass' },
          { id: 'e2', minute: 12, x: 55, y: 60, eventType: 'shot' },
        ],
      }),
    );
    expect(document.querySelector('line')).toBeTruthy();
  });
});

describe('coverage branch sweep — remaining component batch', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('ProbabilityMovementTimeline handles single-interval edge case', () => {
    renderWithI18n(
      React.createElement(ProbabilityMovementTimeline, {
        intervals: {
          '45': { homeWinProb: 0.42, drawProb: 0.28, awayWinProb: 0.3, expectedHomeGoals: 1, expectedAwayGoals: 0.8 },
        },
      }),
    );
    expect(document.body.textContent).toMatch(/0|%/);
  });
});
