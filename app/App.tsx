import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider } from './lib/i18n/I18nContext';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';

const MatchPage = lazy(() => import('./pages/MatchPage').then((m) => ({ default: m.MatchPage })));
const TeamPage = lazy(() => import('./pages/TeamPage').then((m) => ({ default: m.TeamPage })));
const PlayerPage = lazy(() => import('./pages/PlayerPage').then((m) => ({ default: m.PlayerPage })));
const LineupPage = lazy(() => import('./pages/LineupPage').then((m) => ({ default: m.LineupPage })));
const NewsIntelligencePage = lazy(() =>
  import('./pages/NewsIntelligencePage').then((m) => ({ default: m.NewsIntelligencePage })),
);
const NewsArticlePage = lazy(() =>
  import('./pages/NewsArticlePage').then((m) => ({ default: m.NewsArticlePage })),
);
const GuidePage = lazy(() => import('./pages/GuidePage').then((m) => ({ default: m.GuidePage })));
const MatchAnalysisPage = lazy(() =>
  import('./pages/MatchAnalysisPage').then((m) => ({ default: m.MatchAnalysisPage })),
);
const MatchesPage = lazy(() => import('./pages/MatchesPage').then((m) => ({ default: m.MatchesPage })));

function RouteFallback() {
  return (
    <div className="panel min-h-[40vh] animate-pulse rounded-panel bg-panel2/30" aria-busy aria-label="Loading" />
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/matches" element={<MatchesPage />} />
              <Route path="/tournaments" element={<Navigate to="/" replace />} />
              <Route path="/matches/:matchId/analysis" element={<MatchAnalysisPage />} />
              <Route path="/matches/:matchId" element={<MatchPage />} />
              <Route path="/teams/:teamId" element={<TeamPage />} />
              <Route path="/players/:playerId" element={<PlayerPage />} />
              <Route path="/lineups/:matchId" element={<LineupPage />} />
              <Route path="/news-intelligence" element={<NewsIntelligencePage />} />
              <Route path="/news-intelligence/:articleId" element={<NewsArticlePage />} />
              <Route path="/guide" element={<GuidePage />} />
              <Route path="/analyst/simulator" element={<Navigate to="/" replace />} />
              <Route path="/admin" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </I18nProvider>
  );
}
