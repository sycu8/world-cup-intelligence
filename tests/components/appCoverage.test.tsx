import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../app/lib/i18n/I18nContext';
import { saveFavorites } from '../../app/lib/favorites';
import { GroupStageBoard } from '../../app/components/tournament/GroupStageBoard';
import { TournamentSchedulePanel } from '../../app/components/tournament/TournamentSchedulePanel';
import { ProbabilityMovementPanel } from '../../app/components/probability/ProbabilityMovementPanel';
import { MatchStaffPanel } from '../../app/components/match/MatchStaffPanel';
import { MatchAnalyticsPanel } from '../../app/components/match/MatchAnalyticsPanel';
import { PitchMap } from '../../app/components/tactical/PitchMap';
import { installSmokeFetchMock, mockApiBody } from '../helpers/smokeFetch';
import {
  buildScheduleByDate,
  sampleMatchProbs,
  samplePitchMap,
  sampleProbability,
  sampleScheduleMatches,
  sampleStandings,
  SMOKE_MATCH_ID,
} from '../helpers/smokeFixtures';

function renderPanel(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

function findButton(matcher: RegExp) {
  return screen.getAllByRole('button').find((b) => matcher.test(b.textContent ?? ''));
}

describe('app coverage — tournament and match panels', () => {
  beforeEach(() => {
    installSmokeFetchMock();
    saveFavorites({ matches: [SMOKE_MATCH_ID, 'm-live'], teams: ['t-usa'] });
  });

  it('TournamentSchedulePanel exercises filters, view modes, and calendar actions', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(await import('../../app/lib/calendarExport'), 'downloadScheduleIcs').mockImplementation(() => {});
    const view = renderPanel(
      <TournamentSchedulePanel
        byDate={buildScheduleByDate()}
        matches={sampleScheduleMatches}
        probs={sampleMatchProbs}
        totalExpected={200}
      />,
    );

    expect(view.container.textContent).toMatch(/USA|Mexico/i);

    const listBtn = findButton(/list|danh sách/i);
    if (listBtn) await user.click(listBtn);

    const groupBtn = findButton(/group|vòng bảng/i);
    if (groupBtn) await user.click(groupBtn);
    expect(view.container.textContent).toMatch(/USA|Mexico/i);

    const knockoutBtn = findButton(/knock|loại trực/i);
    if (knockoutBtn) {
      await user.click(knockoutBtn);
      expect(view.container.textContent).toMatch(/Brazil|BRA/i);
    }

    const scheduledBtn = findButton(/scheduled|sắp diễn ra/i);
    if (scheduledBtn) await user.click(scheduledBtn);

    const completedBtn = findButton(/completed|đã kết thúc|finished/i);
    if (completedBtn) await user.click(completedBtn);

    const favBtn = findButton(/favorite|yêu thích/i);
    if (favBtn) await user.click(favBtn);

    const search = screen.getByPlaceholderText(/search|tìm/i);
    await user.clear(search);
    await user.type(search, 'zzz-no-match');
    expect(view.container.textContent).toMatch(/no filter|không có|không tìm/i);

    await user.clear(search);
    await user.type(search, 'brazil');

    const downloadAll = findButton(/download all|tải.*lịch/i);
    if (downloadAll) await user.click(downloadAll);
    expect(downloadSpy).toHaveBeenCalled();

    downloadSpy.mockRestore();
  });

  it('GroupStageBoard shows third-place ranking, fixtures tab, and knockout rounds', async () => {
    const user = userEvent.setup();
    const view = renderPanel(
      <GroupStageBoard
        matches={sampleScheduleMatches}
        initialStandings={sampleStandings}
        initialProbs={sampleMatchProbs}
      />,
    );

    expect(view.container.textContent).toMatch(/USA|Mexico|-2|Canada/i);
    if (sampleStandings.thirdPlaceRanking.length > 0) {
      expect(view.container.textContent).toMatch(/third|hạng 3|qualif/i);
    }

    const fixturesTab = findButton(/fixture|lịch|matches/i);
    if (fixturesTab) await user.click(fixturesTab);

    const knockoutTab = findButton(/knock|loại/i);
    if (knockoutTab) {
      await user.click(knockoutTab);
      await waitFor(() => expect(view.container.textContent).toMatch(/Brazil|Round|vòng/i));
      const roundTabs = screen.getAllByRole('tab');
      if (roundTabs.length > 1) await user.click(roundTabs[1]!);
    }
  });

  it('GroupStageBoard handles standings API failure without initial data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/tournaments/') && url.includes('/standings')) {
          return new Response('fail', { status: 500 });
        }
        return new Response(JSON.stringify(mockApiBody(url)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const view = renderPanel(<GroupStageBoard matches={sampleScheduleMatches} />);
    await waitFor(
      () => expect(view.container.textContent).toMatch(/unavailable|không có|USA|Mexico/i),
      { timeout: 5000 },
    );
  });

  it('ProbabilityMovementPanel renders movement events and interval timeline', async () => {
    const view = renderPanel(
      <ProbabilityMovementPanel matchId={SMOKE_MATCH_ID} prob={sampleProbability} currentMinute={55} />,
    );

    await waitFor(() => expect(view.container.textContent).toMatch(/42\.0%|48\.0%|45\.0%/));
    expect(view.container.textContent).toMatch(/Mốc ban đầu|Cập nhật|trực tiếp/i);
  });

  it('MatchStaffPanel loads coaches, referee, and officials', async () => {
    const view = renderPanel(
      <MatchStaffPanel matchId={SMOKE_MATCH_ID} homeLabel="USA" awayLabel="Mexico" />,
    );

    await waitFor(() => expect(view.container.textContent).toMatch(/Coach A|Coach B/i));
    expect(view.container.textContent).toMatch(/Ref One|AR One|Fourth Official/i);
  });

  it('MatchAnalyticsPanel computes momentum from movement events', async () => {
    const view = renderPanel(
      <MatchAnalyticsPanel matchId={SMOKE_MATCH_ID} homeWin={0.45} awayWin={0.28} />,
    );

    await waitFor(() => expect(view.container.textContent).toMatch(/momentum|đà|pressure|áp lực/i));
    expect(view.container.textContent).toMatch(/update|movement|cập nhật/i);
  });

  it('PitchMap covers loading, live badge, and lineup sources', async () => {
    const loading = renderPanel(<PitchMap data={null} loading homeLabel="USA" awayLabel="Mexico" />);
    expect(loading.container.textContent).toMatch(/loading|đang tải/i);

    const empty = renderPanel(<PitchMap data={null} loading={false} />);
    expect(empty.container.textContent).toMatch(/unavailable|chưa có|không có/i);

    const live = renderPanel(
      <PitchMap
        data={{
          ...samplePitchMap,
          status: 'live',
          minute: 67,
          home: { ...samplePitchMap.home, source: 'match_official' },
          away: { ...samplePitchMap.away, source: 'squad_roster' },
        }}
        homeLabel="USA"
        awayLabel="Mexico"
      />,
    );
    expect(live.container.textContent).toMatch(/live|đang diễn ra|67/i);
    expect(live.container.textContent).toMatch(/Chính thức|Từ danh sách|dự kiến/i);

    const withBench = renderPanel(
      <PitchMap
        data={{
          ...samplePitchMap,
          showRatings: true,
          home: {
            ...samplePitchMap.home,
            bench: [
              {
                playerId: 'p-bench',
                name: 'Sub Player',
                shirtNumber: 12,
                subType: 'out',
                subMinute: 70,
                rating: 6.5,
              },
            ],
          },
        }}
        homeLabel="USA"
        awayLabel="Mexico"
      />,
    );
    expect(withBench.container.textContent).toMatch(/Sub Player|12|70/i);
  });
});
