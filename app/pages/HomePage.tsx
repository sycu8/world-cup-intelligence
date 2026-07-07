import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import type { GroupStandingsPayload } from '../lib/api';
import {
  api,
  type DashboardData,
  type NewsArticle,
  type ScheduleMatch,
  type ChampionOddsPayload,
  type PredictionAccuracyReport,
  type UpcomingProbabilityVerification,
  type TopScorersPayload,
} from '../lib/api';
import { consumeHomePrefetch } from '../lib/homePrefetch';
import { FeaturedMatchHero } from '../components/home/FeaturedMatchHero';
import { HomeLivePulse } from '../components/home/HomeLivePulse';
import { HomeUpcomingStrip } from '../components/home/HomeUpcomingStrip';
import { HomeSidebarInsights } from '../components/home/HomeSidebarInsights';
import { TopScorersPanel } from '../components/home/TopScorersPanel';
import { PredictionAccuracyPanel } from '../components/home/PredictionAccuracyPanel';
import { PlatformSnapshot } from '../components/home/PlatformSnapshot';
import { Bilingual } from '../components/i18n/Bilingual';
import { useI18n } from '../lib/i18n/I18nContext';

const HomeNewsPreview = lazy(() =>
  import('../components/home/HomeNewsPreview').then((m) => ({ default: m.HomeNewsPreview })),
);
const GroupStageBoard = lazy(() =>
  import('../components/tournament/GroupStageBoard').then((m) => ({ default: m.GroupStageBoard })),
);

const REFRESH_MS = 30_000;

function SectionFallback({ className = 'min-h-[10rem]' }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-panel2/30 ${className}`} aria-hidden />;
}

export function HomePage() {
  const { t } = useI18n();
  const [matches, setMatches] = useState<ScheduleMatch[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [hotNews, setHotNews] = useState<NewsArticle[]>([]);
  const [standings, setStandings] = useState<GroupStandingsPayload | null>(null);
  const [championOdds, setChampionOdds] = useState<ChampionOddsPayload | null>(null);
  const [topScorers, setTopScorers] = useState<TopScorersPayload | null>(null);
  const [predictionAccuracy, setPredictionAccuracy] = useState<PredictionAccuracyReport | null>(null);
  const [upcomingVerification, setUpcomingVerification] = useState<UpcomingProbabilityVerification | null>(null);
  const [probs, setProbs] = useState<Record<string, { mostLikelyScore?: string }>>({});
  const [predictionLoading, setPredictionLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const applyHome = useCallback((payload: Awaited<ReturnType<typeof api.home>>) => {
    setMatches(payload.data.schedule.matches);
    setDashboard(payload.data.dashboard);
    setHotNews(payload.data.hotNews.slice(0, 3));
    setStandings(payload.data.standings ?? null);
    setChampionOdds(payload.data.championOdds ?? null);
    if (!payload.data.championOdds?.top.length) {
      void api
        .tournamentChampionOdds(2026)
        .then((res) => {
          if (res.data.top.length) setChampionOdds(res.data);
        })
        .catch(() => undefined);
    }
    setTopScorers(payload.data.topScorers ?? null);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const prefetched = await consumeHomePrefetch();
        if (cancelled) return;
        if (prefetched) {
          applyHome(prefetched);
          return;
        }
        applyHome(await api.home());
      } catch {
        if (!cancelled) {
          setDashboard(null);
          setHotNews([]);
          setChampionOdds(null);
          setTopScorers(null);
          setReady(true);
        }
      }
    };

    void run();
    const interval = window.setInterval(() => {
      void api.home().then((payload) => {
        if (!cancelled) applyHome(payload);
      }).catch(() => undefined);
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyHome]);

  useEffect(() => {
    let cancelled = false;
    void api
      .tournamentMatchProbabilities(2026)
      .then((res) => {
        if (!cancelled) setProbs(res.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPredictionInsights = async () => {
      try {
        const [accuracyRes, upcomingRes] = await Promise.all([
          api.tournamentPredictionAccuracy(2026),
          api.tournamentUpcomingProbabilityVerification(2026, true),
        ]);
        if (!cancelled) {
          setPredictionAccuracy(accuracyRes.data);
          setUpcomingVerification(upcomingRes.data);
        }
      } catch {
        if (!cancelled) {
          setPredictionAccuracy(null);
          setUpcomingVerification(null);
        }
      } finally {
        if (!cancelled) setPredictionLoading(false);
      }
    };
    void loadPredictionInsights();
    const timer = window.setInterval(loadPredictionInsights, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const featured = dashboard?.featuredMatch ?? null;

  return (
    <div className="layout-contained space-y-6 sm:space-y-8">
      <header className="max-w-2xl">
        <Bilingual
          k="home.calendarTitle"
          as="h1"
          className="font-heading text-2xl tracking-tight sm:text-4xl"
        />
        <Bilingual
          k="home.calendarSubtitle"
          as="p"
          className="mt-2 text-sm leading-relaxed text-muted sm:text-base"
        />
      </header>

      {!ready ? (
        <SectionFallback className="min-h-[4rem]" />
      ) : (
        <HomeLivePulse dashboard={dashboard} />
      )}

      {!ready ? (
        <SectionFallback className="min-h-[20rem]" />
      ) : (
        <div className="home-dashboard layout-contained">
          <div className="min-w-0">
            {featured ? (
              <FeaturedMatchHero match={featured} />
            ) : (
              <div className="home-section flex min-h-[16rem] items-center justify-center text-muted">
                <Bilingual k="home.noFeatured" />
              </div>
            )}
          </div>
          <HomeSidebarInsights
            dashboard={dashboard}
            championOdds={championOdds}
            topScorers={topScorers}
            loading={!ready}
          />
        </div>
      )}

      {ready && <HomeUpcomingStrip matches={matches} probs={probs} />}

      <section className="home-section layout-contained">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="section-title">{t('groupBoard.title')}</h2>
            <p className="section-subtitle">{t('groupBoard.subtitle')}</p>
          </div>
          <Link to="/matches?tab=standings" className="btn-ghost shrink-0 self-start text-sm sm:self-auto">
            {t('home.exploreStandings')}
          </Link>
        </div>
        {!ready ? (
          <SectionFallback className="min-h-[16rem]" />
        ) : (
          <Suspense fallback={<SectionFallback className="min-h-[16rem]" />}>
            <GroupStageBoard
              mode="home"
              matches={matches}
              initialStandings={standings}
            />
          </Suspense>
        )}
      </section>

      {ready && (
        <details className="home-insights-panel layout-contained group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 marker:content-none sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="font-heading text-base text-foreground">{t('home.moreInsights')}</span>
            <span className="text-muted transition-transform group-open:rotate-180" aria-hidden>
              ▼
            </span>
          </summary>
          <div className="space-y-4 border-t border-border/40 px-4 py-4 sm:px-5 sm:py-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <TopScorersPanel data={topScorers} loading={false} />
              <PlatformSnapshot dashboard={dashboard} />
            </div>
            <PredictionAccuracyPanel
              accuracy={predictionAccuracy}
              upcoming={upcomingVerification}
              loading={predictionLoading}
            />
            <Suspense fallback={<SectionFallback />}>
              <HomeNewsPreview initialHot={hotNews} />
            </Suspense>
          </div>
        </details>
      )}
    </div>
  );
}
