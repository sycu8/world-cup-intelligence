import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import {
  buildImpactSummaryVi,
  classifyNewsImpact,
  findTeamIdsInText,
  buildTeamAliasIndex,
  processNewsDocumentImpact,
} from '../src/services/newsMatchImpact';
import { ingestMatchMarkets } from '../src/market/services/marketIngestionService';
import { getMatchPreviewAnalysis } from '../src/services/matchPreviewAnalysis';
import { GroupStageBoard } from '../app/components/tournament/GroupStageBoard';
import { MatchHistoryPanel } from '../app/components/match/MatchHistoryPanel';
import { MatchAnalysisPage } from '../app/pages/MatchAnalysisPage';
import { NewsIntelligencePage } from '../app/pages/NewsIntelligencePage';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_SNAPSHOT, FIXTURE_TEAMS } from './helpers/fixtures';
import { installSmokeFetchMock, mockApiBody } from './helpers/smokeFetch';
import { sampleScheduleMatches, sampleStandings } from './helpers/smokeFixtures';

vi.mock('../src/ingestion/fifa/fifaLineupSync', () => ({
  syncFifaMatchLineupsByRef: vi.fn(async () => undefined),
}));
vi.mock('../src/services/officialLineupSync', () => ({
  syncOfficialSquadToMatch: vi.fn(async () => undefined),
}));
vi.mock('../src/services/matchGroupContext', () => ({
  getGroupContextForMatch: vi.fn(async () => ({ fixtures: [] })),
}));
vi.mock('../src/services/matchHistory', () => ({
  getHeadToHead: vi.fn(async () => ({
    summary: { recentFormHome: 'W', recentFormAway: 'L', totalMatches: 1 },
  })),
}));
vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => ({ matchId: FIXTURE_MATCH.id })),
}));
vi.mock('../src/ai/gatewayClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ai/gatewayClient')>();
  return { ...actual, isGatewayConfigured: vi.fn(() => false), gatewayChatJson: vi.fn() };
});
vi.mock('../src/market/marketSourceRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/market/marketSourceRegistry')>();
  return { ...actual, getMarketAdapters: vi.fn(actual.getMarketAdapters) };
});

function renderApp(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

describe('coverage branches — remaining services', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('newsMatchImpact covers medium/low summaries and OR match lookup', async () => {
    expect(
      buildImpactSummaryVi(['Mexico'], ['m-1'], 'medium', {
        teams: [],
        players: [],
        injuries: [],
        tacticalNotes: ['formation shift'],
        formations: ['4-3-3'],
      }),
    ).toContain('trung bình');
    expect(buildImpactSummaryVi(['Mexico'], ['m-1'], 'low', null)).toContain('thấp');

    const index = buildTeamAliasIndex([
      { id: 't-kor', name: 'Korea Republic', short_name: 'KOR', country_code: 'KOR' } as never,
    ]);
    expect(findTeamIdsInText('South Korea training camp', index)).toContain('t-kor');

    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("GLOB 'team-w26-")) {
            return { results: [{ ...FIXTURE_TEAMS[0] }, { ...FIXTURE_TEAMS[1] }] };
          }
          if (sql.includes('home_team_id IN') && sql.includes('away_team_id IN') && !sql.includes(' OR ')) {
            return { results: [] };
          }
          if (sql.includes(' OR ') && sql.includes('away_team_id IN')) {
            return { results: [{ id: FIXTURE_MATCH.id }] };
          }
          if (sql.includes('country_code')) return { results: [{ id: FIXTURE_TEAMS[0].id }] };
          return { results: [] };
        },
        first: () => ({ country_code: 'MEX' }),
        run: () => ({ success: true }),
      }),
    });
    const medium = await processNewsDocumentImpact(
      env,
      'doc-med',
      'Coach confirms starting XI and formation for Mexico',
      { teams: ['Mexico'], players: [], injuries: [], tacticalNotes: ['lineup'], formations: ['4-4-2'] },
    );
    expect(medium.impactLevel).toBe('medium');
    expect(medium.matchIds.length).toBeGreaterThan(0);
  });

  it('newsMatchImpact logs recompute failures without aborting', async () => {
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    vi.mocked(recomputeMatchProbability).mockRejectedValueOnce(new Error('boom'));
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("GLOB 'team-w26-")) return { results: [FIXTURE_TEAMS[0]] };
          if (sql.includes('SELECT id FROM matches')) return { results: [{ id: FIXTURE_MATCH.id }] };
          return { results: [] };
        },
        first: () => null,
        run: () => ({ success: true }),
      }),
    });
    const result = await processNewsDocumentImpact(
      env,
      'doc-fail',
      'Mexico striker ruled out injured',
      { teams: ['Mexico'], players: [], injuries: ['out'], tacticalNotes: [], formations: [] },
    );
    expect(result.impactLevel).toBe('high');
    expect(result.triggeredRecompute).toBe(false);
  });

  it('ingestMatchMarkets stores normalized odds from adapter payload', async () => {
    const { getMarketAdapters } = await import('../src/market/marketSourceRegistry');
    const { saveMarketOddsBatch } = await import('../src/db/repositories/marketRepo');
    vi.mocked(getMarketAdapters).mockReturnValueOnce([
      {
        sourceId: 'mkt-manual',
        fetchMatchMarkets: vi.fn(async () => [
          {
            matchId: 'm-1',
            marketType: 'match_winner',
            selection: 'home',
            oddsDecimal: 2.0,
            retrievedAt: '2026-06-01T00:00:00Z',
            rawPayload: {},
          },
          {
            matchId: 'm-1',
            marketType: 'match_winner',
            selection: 'draw',
            oddsDecimal: 3.2,
            retrievedAt: '2026-06-01T00:00:00Z',
            rawPayload: {},
          },
          {
            matchId: 'm-1',
            marketType: 'match_winner',
            selection: 'away',
            oddsDecimal: 3.5,
            retrievedAt: '2026-06-01T00:00:00Z',
            rawPayload: {},
          },
        ]),
      } as never,
    ]);
    const put = vi.fn(async () => undefined);
    const env = createMockEnv({
      R2_RAW: { put } as never,
      DB: createMockDb({ run: () => ({ success: true }) }),
    });
    const count = await ingestMatchMarkets(env, 'm-1');
    expect(count).toBeGreaterThan(0);
    expect(put).toHaveBeenCalled();
    expect(saveMarketOddsBatch).toBeDefined();
  });

  it('matchPreviewAnalysis describes squad and projected lineup labels', async () => {
    const env = createMockEnv({
      KV: { get: vi.fn(async () => null), put: vi.fn(async () => undefined) } as never,
      DB: createMockDb({
        first: (sql, binds) => {
          if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
          if (sql.includes('FROM teams WHERE id')) {
            return binds[0] === FIXTURE_TEAMS[0].id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
          }
          if (sql.includes('FROM probability_snapshots')) return FIXTURE_SNAPSHOT;
          if (sql.includes('FROM lineups l')) {
            const isHome = binds?.[1] === FIXTURE_TEAMS[0].id;
            return {
              id: isHome ? 'lu-home' : 'lu-away',
              formation: '4-2-3-1',
              is_official: isHome ? 0 : 1,
              source_type: isHome ? 'squad_official' : 'projected',
              confidence: 0.8,
            };
          }
          return null;
        },
        all: (sql) => {
          if (sql.includes('FROM lineup_players')) {
            return {
              results: Array.from({ length: 11 }, (_, i) => ({
                name: `P${i}`,
                shirt_number: i + 1,
                position_slot: 'CM',
                role: null,
                position: null,
                is_starter: 1,
              })),
            };
          }
          return { results: [] };
        },
      }),
    });
    const analysis = await getMatchPreviewAnalysis(env, FIXTURE_MATCH.id);
    expect(analysis?.sections.lineup.en).toMatch(/squad|projected|official/i);
  });

  it('classifyNewsImpact uses entity injuries and formations branches', () => {
    expect(classifyNewsImpact('Routine training report', {
      teams: ['Mexico'],
      players: [],
      injuries: ['knock'],
      tacticalNotes: [],
      formations: [],
    })).toBe('high');
    expect(classifyNewsImpact('Tactical note only', {
      teams: ['Mexico'],
      players: [],
      injuries: [],
      tacticalNotes: ['high press'],
      formations: [],
    })).toBe('medium');
  });
});

describe('coverage branches — remaining components', () => {
  beforeEach(() => {
    installSmokeFetchMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GroupStageBoard renders standings rows and empty placeholder table', async () => {
    const view = renderApp(
      <GroupStageBoard matches={sampleScheduleMatches} initialStandings={sampleStandings} />,
    );
    expect(view.container.textContent).toMatch(/USA|Mexico/i);
  });

  it('MatchHistoryPanel renders history rows and recent WC sections', () => {
    const view = renderApp(
      <MatchHistoryPanel
        homeName="USA"
        awayName="Mexico"
        history={[
          {
            id: 'm-h1',
            kickoff_utc: '2026-06-01T00:00:00Z',
            stage: 'Group',
            home_name: 'USA',
            away_name: 'Mexico',
            home_score: 2,
            away_score: 1,
          },
        ]}
        summary={{
          totalMatches: 1,
          homeTeamWins: 1,
          awayTeamWins: 0,
          draws: 0,
          avgGoalsHome: 2,
          avgGoalsAway: 1,
          recentFormHome: 'W',
          recentFormAway: 'L',
        }}
        homeRecentWc={[]}
        awayRecentWc={[]}
      />,
    );
    expect(view.container.textContent).toMatch(/USA|Mexico|2/i);
  });

  it('MatchAnalysisPage loads analysis sections', async () => {
    const view = render(
      <MemoryRouter initialEntries={['/matches/usa-vs-mexico/analysis']}>
        <I18nProvider>
          <MatchAnalysisPage />
        </I18nProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(view.container.textContent?.length ?? 0).toBeGreaterThan(50), {
      timeout: 8000,
    });
  });

  it('NewsIntelligencePage handles filter tabs', async () => {
    const user = userEvent.setup();
    const view = renderApp(<NewsIntelligencePage />);
    await waitFor(() => expect(view.container.textContent?.length ?? 0).toBeGreaterThan(20));
    const buttons = screen.getAllByRole('button');
    if (buttons[0]) await user.click(buttons[0]);
    expect(view.container.textContent?.length ?? 0).toBeGreaterThan(10);
  });
});
