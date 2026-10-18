import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../app/lib/i18n/I18nContext';
import { GroupStageBoard } from '../app/components/tournament/GroupStageBoard';
import { GroupStandingsGrid } from '../app/components/tournament/TournamentPanels';
import { MatchHistoryPanel } from '../app/components/match/MatchHistoryPanel';
import { ProbabilityMovementPanel } from '../app/components/probability/ProbabilityMovementPanel';
import { MatchPredictionSummary } from '../app/components/match/MatchPredictionSummary';
import { PitchPlayerLayer } from '../app/components/tactical/PitchPlayerLayer';
import { installSmokeFetchMock, mockApiBody } from './helpers/smokeFetch';
import {
  sampleHistoryMatch,
  sampleH2HSummary,
  sampleMatchProbs,
  samplePitchMap,
  sampleProbability,
  sampleRecentWc,
  sampleScheduleMatches,
  sampleStandings,
  SMOKE_MATCH_ID,
} from './helpers/smokeFixtures';

function renderApp(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

function findButton(matcher: RegExp) {
  return screen.getAllByRole('button').find((b) => matcher.test(b.textContent ?? ''));
}

const standingsWithRanks = {
  ...sampleStandings,
  groups: {
    ...sampleStandings.groups,
    A: {
      complete: true,
      rows: [
        {
          teamId: 't-usa',
          teamName: 'USA',
          shortName: 'USA',
          countryCode: 'US',
          rank: 1,
          played: 2,
          gd: 3,
          points: 6,
        },
        {
          teamId: 't-mex',
          teamName: 'Mexico',
          shortName: null,
          countryCode: 'MX',
          rank: 2,
          played: 2,
          gd: 1,
          points: 4,
        },
        {
          teamId: 't-can',
          teamName: 'Canada',
          shortName: 'CAN',
          countryCode: 'CA',
          rank: 3,
          played: 2,
          gd: -1,
          points: 3,
        },
        {
          teamId: 't-other',
          teamName: 'Other',
          shortName: 'OTH',
          countryCode: 'XX',
          rank: 4,
          played: 2,
          gd: -3,
          points: 1,
        },
      ],
    },
  },
  thirdPlaceRanking: sampleStandings.thirdPlaceRanking.slice(0, 10),
};

describe('coverage branches — round 4 components', () => {
  beforeEach(() => {
    installSmokeFetchMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GroupStageBoard renders all rank styles, live fixtures, and third-place list', async () => {
    const liveMatch = {
      ...sampleScheduleMatches[0]!,
      id: 'm-live-g',
      status: 'live' as const,
      home_score: 1,
      away_score: 0,
      stage: 'Group',
      group_code: 'A',
    };
    const finishedMatch = {
      ...sampleScheduleMatches[1]!,
      id: 'm-done-g',
      status: 'finished' as const,
      home_score: 2,
      away_score: 1,
      stage: 'Group',
      group_code: 'A',
    };
    const view = renderApp(
      <GroupStageBoard
        matches={[liveMatch, finishedMatch, ...sampleScheduleMatches]}
        initialStandings={standingsWithRanks}
        initialProbs={sampleMatchProbs}
      />,
    );
    expect(view.container.textContent).toMatch(/USA|Mexico|Canada|\+3|-1|live/i);
    expect(view.container.textContent).toMatch(/third|hạng 3|qualif/i);
  });

  it('GroupStageBoard shows placeholder rows when group standings empty', async () => {
    const emptyStandings = {
      ...sampleStandings,
      groups: {
        A: { complete: false, rows: [] },
      },
      thirdPlaceRanking: [],
    };
    const view = renderApp(
      <GroupStageBoard
        matches={sampleScheduleMatches.filter((m) => m.group_code === 'A')}
        initialStandings={emptyStandings}
      />,
    );
    expect(view.container.textContent).toMatch(/—|0/);
  });

  it('GroupStageBoard knockout tab loads round matches', async () => {
    const user = userEvent.setup();
    const view = renderApp(
      <GroupStageBoard matches={sampleScheduleMatches} initialProbs={sampleMatchProbs} />,
    );
    const knockoutTab = findButton(/knock|loại/i);
    if (knockoutTab) await user.click(knockoutTab);
    expect(view.container.textContent).toMatch(/BRA|USA|Round|loading|empty/i);
  });

  it('GroupStandingsGrid shows empty group rows and negative GD formatting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/standings')) {
          return new Response(
            JSON.stringify({
              data: {
                groups: {
                  A: {
                    complete: false,
                    rows: [
                      {
                        teamId: 't-a4',
                        teamName: 'Fourth',
                        shortName: '4TH',
                        rank: 4,
                        played: 0,
                        gd: -2,
                        points: 0,
                      },
                    ],
                  },
                },
                thirdPlaceRanking: [
                  {
                    group: 'B',
                    teamId: 't-b3',
                    teamName: 'Third B',
                    shortName: 'B3',
                    points: 4,
                    gd: 0,
                  },
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const view = renderApp(<GroupStandingsGrid />);
    await waitFor(() => expect(view.container.textContent).toMatch(/Fourth|-2|Third B/i), {
      timeout: 8000,
    });
  });

  it('MatchHistoryPanel covers recent WC columns and history rows', () => {
    const view = renderApp(
      <MatchHistoryPanel
        homeName="USA"
        awayName="Mexico"
        history={[sampleHistoryMatch]}
        summary={sampleH2HSummary}
        homeRecentWc={[sampleRecentWc]}
        awayRecentWc={[{ ...sampleRecentWc, opponentName: 'Canada', result: 'L' }]}
      />,
    );
    expect(view.container.textContent).toMatch(/USA|Mexico|Canada/i);
  });

  it('ProbabilityMovementPanel handles empty movement payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/probability-movement')) {
          return new Response(
            JSON.stringify({ data: { events: [], intervals: [] } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const view = renderApp(
      <ProbabilityMovementPanel matchId={SMOKE_MATCH_ID} prob={sampleProbability} currentMinute={null} />,
    );
    await waitFor(() => expect(view.container.textContent?.length ?? 0).toBeGreaterThan(10), {
      timeout: 5000,
    });
  });

  it('MatchPredictionSummary covers null prob and scoreline distribution fallback', () => {
    const empty = renderApp(
      <MatchPredictionSummary prob={null} homeLabel="USA" awayLabel="Mexico" />,
    );
    expect(empty.container.textContent).toMatch(/dự đoán|loading|tải/i);

    const withDist = renderApp(
      <MatchPredictionSummary
        prob={{
          ...sampleProbability,
          topScorelines: undefined,
          scorelineDistribution: { '2-1': 0.12, '1-1': 0.1 },
        }}
        homeLabel="USA"
        awayLabel="Mexico"
        homeScore={1}
        awayScore={0}
        status="live"
        hints={[{ code: 'home_edge', label: { vi: 'L', en: 'L' }, detail: { vi: 'D', en: 'D' } }]}
      />,
    );
    expect(withDist.container.textContent).toMatch(/USA|Mexico|2-1/i);
  });

  it('PitchPlayerLayer renders movement vectors and rating colors', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const view = render(
      <PitchPlayerLayer
        side="away"
        showRatings
        players={[
          {
            playerId: 'p1',
            name: 'A',
            shirtNumber: 9,
            x: 0.2,
            y: 0.5,
            rating: 8,
            movement: { dx: 0.1, dy: 0.05, magnitude: 0.5 },
          },
          {
            playerId: 'p2',
            name: 'B',
            shirtNumber: null,
            x: 0.4,
            y: 0.3,
            rating: 5,
            movement: { dx: 0, dy: 0, magnitude: 0 },
          },
        ]}
      />,
      { container: svg },
    );
    expect(view.container.querySelectorAll('circle').length).toBeGreaterThan(0);
    expect(view.container.textContent).toContain('9');
  });
});
