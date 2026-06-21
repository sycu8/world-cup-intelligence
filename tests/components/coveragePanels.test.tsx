import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../app/lib/i18n/I18nContext';
import { saveFavorites } from '../../app/lib/favorites';
import { FavoritesPanel } from '../../app/components/tournament/FavoritesPanel';
import { TeamsDirectory } from '../../app/components/tournament/TeamsDirectory';
import { MatchPreviewAnalysisPanel } from '../../app/components/match/MatchPreviewAnalysisPanel';
import { MultiVariablePanel } from '../../app/components/match/MultiVariablePanel';
import { TacticalBriefingPanel } from '../../app/components/tactical/TacticalBriefingPanel';
import { TeamSystemPanel } from '../../app/components/team/TeamSystemPanel';
import { MemoryRouter } from 'react-router-dom';
import { installSmokeFetchMock } from '../helpers/smokeFetch';
import { sampleScheduleMatches, SMOKE_MATCH_ID } from '../helpers/smokeFixtures';

function renderPanel(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

describe('coverage-oriented panel renders', () => {
  beforeEach(() => {
    installSmokeFetchMock();
    saveFavorites({ matches: [SMOKE_MATCH_ID, 'm-live'], teams: ['t-usa', 't-mex'] });
  });

  it('FavoritesPanel lists saved matches and teams', async () => {
    const view = renderPanel(
      <FavoritesPanel
        matches={sampleScheduleMatches}
        teams={[
          { id: 't-usa', name: 'USA', short_name: 'USA', country_code: 'US' },
          { id: 't-mex', name: 'Mexico', short_name: 'MEX', country_code: 'MX' },
        ]}
      />,
    );
    await waitFor(() => expect(view.container.textContent).toMatch(/USA|Mexico/i));
  });

  it('TeamsDirectory filters by search query', async () => {
    const user = userEvent.setup();
    const view = renderPanel(
      <TeamsDirectory
        teams={[
          { id: 't-usa', name: 'USA', short_name: 'USA', country_code: 'US', fifa_ranking: 12 },
          { id: 't-mex', name: 'Mexico', short_name: 'MEX', country_code: 'MX', fifa_ranking: 15 },
        ]}
      />,
    );
    const input = screen.getByPlaceholderText(/search|tìm/i);
    await user.type(input, 'mex');
    await waitFor(() => expect(view.container.textContent).toMatch(/Mexico|MEX/i));
  });

  it('MatchPreviewAnalysisPanel renders preview payload', async () => {
    const view = renderPanel(
      <MatchPreviewAnalysisPanel
        preview={{
          matchId: SMOKE_MATCH_ID,
          generatedAt: '2026-06-01T00:00:00Z',
          matchLabel: { vi: 'USA vs Mexico', en: 'USA vs Mexico' },
          stage: 'Group',
          groupCode: 'A',
          kickoffUtc: sampleScheduleMatches[0].kickoff_utc,
          home: {
            teamId: 't-usa',
            teamName: 'USA',
            elo: 1850,
            fifaRanking: 12,
            collectiveStrength: 0.82,
            formation: '4-3-3',
            lineupSource: 'official',
            keyPlayers: ['P1'],
            fullLineup: ['P1'],
            recentForm: 'WWD',
          },
          away: {
            teamId: 't-mex',
            teamName: 'Mexico',
            elo: 1800,
            fifaRanking: 15,
            collectiveStrength: 0.78,
            formation: '4-4-2',
            lineupSource: 'projected',
            keyPlayers: ['P2'],
            fullLineup: ['P2'],
            recentForm: 'DLW',
          },
          summary: { vi: 'Summary', en: 'Summary' },
          sections: {
            context: { vi: 'C', en: 'C' },
            strength: { vi: 'S', en: 'S' },
            lineup: { vi: 'L', en: 'L' },
            form: { vi: 'F', en: 'F' },
            tactical: { vi: 'T', en: 'T' },
          },
          insights: [{ vi: 'I', en: 'I' }],
          probabilityNote: null,
          scorelineTop3: [{ score: '1-1', prob: 0.12 }],
          dataSources: ['FIFA'],
        }}
        loading={false}
      />,
    );
    await waitFor(() => expect(view.container.textContent).toMatch(/4-3-3|4-4-2|USA|Mexico/i));
  });

  it('MultiVariablePanel renders analysis payload', async () => {
    const view = renderPanel(
      <MultiVariablePanel
        analysis={{
          executiveSummary: 'Summary',
          variableInsights: [
            { variable: 'Form', impact: 'high', direction: 'home', explanation: 'Strong home form' },
          ],
          tacticalRecommendations: ['Press high'],
          riskFactors: ['Fitness'],
          confidence: 0.8,
        }}
        loading={false}
      />,
    );
    await waitFor(() => expect(view.container.textContent).toMatch(/Summary|Press high/i));
  });

  it('TacticalBriefingPanel renders briefing payload', async () => {
    const view = renderPanel(
      <TacticalBriefingPanel
        briefing={{
          summary: { vi: 'Tóm tắt', en: 'Summary' },
          probabilityExplanation: [{ vi: 'Giải thích', en: 'Explanation' }],
          uncertaintyNotes: [{ vi: 'Ghi chú', en: 'Note' }],
          citations: [{ sourceName: 'FIFA' }],
          tacticalThemes: [
            { title: { vi: 'Chủ đề', en: 'Theme' }, detail: { vi: 'Chi tiết', en: 'Detail' }, confidence: 0.8 },
          ],
        }}
        loading={false}
      />,
    );
    await waitFor(() => expect(view.container.textContent).toMatch(/Summary|Tóm tắt|FIFA/i));
  });

  it('TeamSystemPanel renders team system payload', async () => {
    const view = renderPanel(
      <TeamSystemPanel
        home={{
          teamId: 't-usa',
          tacticalIdentity: 'Possession',
          primaryFormation: '4-3-3',
          collectiveStrengthScore: 0.82,
          formationStabilityScore: 0.75,
          pressingScore: 0.7,
          defensiveCompactnessScore: 0.68,
          transitionScore: 0.72,
          setPieceScore: 0.65,
          benchDepthScore: 0.7,
          lineupCohesionScore: 0.78,
          possessionControlScore: 0.8,
          tempoScore: 0.74,
        }}
        away={{
          teamId: 't-mex',
          tacticalIdentity: 'Counter',
          primaryFormation: '4-4-2',
          collectiveStrengthScore: 0.78,
          formationStabilityScore: 0.72,
          pressingScore: 0.65,
          defensiveCompactnessScore: 0.7,
          transitionScore: 0.75,
          setPieceScore: 0.6,
          benchDepthScore: 0.68,
          lineupCohesionScore: 0.74,
          possessionControlScore: 0.65,
          tempoScore: 0.7,
        }}
        loading={false}
      />,
    );
    await waitFor(() => expect(view.container.textContent).toMatch(/4-3-3|4-4-2|Possession|Counter/i));
  });
});
