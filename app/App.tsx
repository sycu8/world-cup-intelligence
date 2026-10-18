import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider, useI18n } from './lib/i18n/I18nContext';
import { AppShell } from './components/layout/AppShell';
import { AppErrorBoundary } from './components/layout/AppErrorBoundary';
import { SEO_PAGES } from './lib/seoPages';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
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
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage').then((m) => ({ default: m.ApiDocsPage })));
const MatchAnalysisPage = lazy(() =>
  import('./pages/MatchAnalysisPage').then((m) => ({ default: m.MatchAnalysisPage })),
);
const MatchesPage = lazy(() => import('./pages/MatchesPage').then((m) => ({ default: m.MatchesPage })));
const LeaguesPage = lazy(() => import('./pages/LeaguesPage').then((m) => ({ default: m.LeaguesPage })));
const LeagueHubPage = lazy(() => import('./pages/LeagueHubPage').then((m) => ({ default: m.LeagueHubPage })));
const SeoLandingPage = lazy(() =>
  import('./pages/SeoLandingPage').then((m) => ({ default: m.SeoLandingPage })),
);

function RouteFallback() {
  const { t } = useI18n();
  return (
    <div
      className="panel min-h-[40vh] animate-pulse rounded-panel bg-panel2/30"
      aria-busy
      aria-label={t('common.loading')}
    />
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <I18nProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
            <Route path="/docs/api" element={<ApiDocsPage />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/matches" element={<MatchesPage />} />
              <Route path="/leagues" element={<LeaguesPage />} />
              <Route path="/leagues/:slug" element={<LeagueHubPage />} />
              <Route path="/tournaments" element={<Navigate to="/leagues" replace />} />
              <Route path="/matches/:matchId/analysis" element={<MatchAnalysisPage />} />
              <Route path="/matches/:matchId" element={<MatchPage />} />
              <Route path="/teams/:teamId" element={<TeamPage />} />
              <Route path="/players/:playerId" element={<PlayerPage />} />
              <Route path="/lineups/:matchId" element={<LineupPage />} />
              <Route path="/news-intelligence" element={<NewsIntelligencePage />} />
              <Route path="/news-intelligence/:articleId" element={<NewsArticlePage />} />
              <Route path="/guide" element={<GuidePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              {SEO_PAGES.map((page) => (
                <Route key={page.path} path={page.path} element={<SeoLandingPage />} />
              ))}
              <Route path="/analyst/simulator" element={<Navigate to="/" replace />} />
              <Route path="/admin" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </I18nProvider>
    </AppErrorBoundary>
  );
}
