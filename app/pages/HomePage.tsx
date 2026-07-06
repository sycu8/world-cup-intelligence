import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import type { GroupStandingsPayload } from '../lib/api';
import { api, type DashboardData, type NewsArticle, type ScheduleMatch, type ChampionOddsPayload, type PredictionAccuracyReport, type UpcomingProbabilityVerification, type TopScorersPayload } from '../lib/api';
import { consumeHomePrefetch } from '../lib/homePrefetch';
import { FeaturedMatchHero } from '../components/home/FeaturedMatchHero';
import { WorldCupCountdown } from '../components/home/WorldCupCountdown';
import { PlatformSnapshot } from '../components/home/PlatformSnapshot';
import { TopScorersPanel } from '../components/home/TopScorersPanel';
import { PredictionAccuracyPanel } from '../components/home/PredictionAccuracyPanel';
import { NewUserQuickStart } from '../components/home/NewUserQuickStart';
import { Bilingual } from '../components/i18n/Bilingual';

const HomeNewsPreview = lazy(() =>
  import('../components/home/HomeNewsPreview').then((m) => ({ default: m.HomeNewsPreview })),
);
const GroupStageBoard = lazy(() =>
  import('../components/tournament/GroupStageBoard').then((m) => ({ default: m.GroupStageBoard })),
);

const REFRESH_MS = 30_000;

function SectionFallback({ className = 'min-h-[12rem]' }: { className?: string }) {
  return <div className={`panel animate-pulse rounded-panel bg-panel2/30 ${className}`} aria-hidden />;
}

function BoardSkeleton() {
  return <SectionFallback className="min-h-[24rem]" />;
}

function HeroSkeleton() {
  return (
    <div className="page-hero-glow grid gap-4 lg:grid-cols-2" aria-hidden>
      <div className="panel min-h-[17rem] animate-pulse bg-panel2/35" />
      <div className="panel min-h-[12rem] animate-pulse bg-panel2/30" />
    </div>
  );
}

export function HomePage() {
  const [matches, setMatches] = useState<ScheduleMatch[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [hotNews, setHotNews] = useState<NewsArticle[]>([]);
  const [standings, setStandings] = useState<GroupStandingsPayload | null>(null);
  const [championOdds, setChampionOdds] = useState<ChampionOddsPayload | null>(null);
  const [topScorers, setTopScorers] = useState<TopScorersPayload | null>(null);
  const [predictionAccuracy, setPredictionAccuracy] = useState<PredictionAccuracyReport | null>(null);
  const [upcomingVerification, setUpcomingVerification] = useState<UpcomingProbabilityVerification | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(true);
  const [boardReady, setBoardReady] = useState(false);
  const [extrasReady, setExtrasReady] = useState(false);

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
    setBoardReady(true);
    setExtrasReady(true);
  }, []);

  const loadBoardFast = useCallback(async () => {
    const [scheduleRes, standingsRes] = await Promise.all([
      api.schedule().catch(() => null),
      api.tournamentStandings(2026).catch(() => null),
    ]);
    if (scheduleRes) setMatches(scheduleRes.data.matches);
    if (standingsRes) setStandings(standingsRes.data);
    if (scheduleRes || standingsRes) setBoardReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const fastBoard = loadBoardFast();
      try {
        const prefetched = await consumeHomePrefetch();
        if (cancelled) return;
        if (prefetched) {
          applyHome(prefetched);
          return;
        }
        await fastBoard;
        if (cancelled) return;
        applyHome(await api.home());
      } catch {
        if (cancelled) return;
        await fastBoard.catch(() => undefined);
        setDashboard(null);
        setHotNews([]);
        setChampionOdds(null);
        setTopScorers(null);
        setBoardReady(true);
        setExtrasReady(true);
      }
    };

    void run();
    let interval: ReturnType<typeof setInterval> | undefined;
    const delay = window.setTimeout(() => {
      interval = window.setInterval(() => {
        void api
          .home()
          .then((payload) => {
            if (!cancelled) applyHome(payload);
          })
          .catch(() => undefined);
      }, REFRESH_MS);
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(delay);
      if (interval) window.clearInterval(interval);
    };
  }, [applyHome, loadBoardFast]);

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
    <div className="space-y-6 sm:space-y-8">
      <header className="max-w-3xl">
        <Bilingual
          k="home.calendarTitle"
          as="h1"
          className="font-heading text-2xl tracking-tight sm:text-4xl md:text-5xl"
        />
        <Bilingual
          k="home.calendarSubtitle"
          as="p"
          className="mt-2 text-sm leading-relaxed text-foreground/85 sm:mt-3 sm:text-base"
        />
      </header>

      {!extrasReady ? (
        <HeroSkeleton />
      ) : (
        <div className="page-hero-glow grid gap-4 lg:grid-cols-2 lg:items-stretch xl:gap-5">
          <div className="order-1 lg:sticky lg:top-[4.5rem] lg:order-2">
            {featured ? (
              <FeaturedMatchHero match={featured} />
            ) : (
              <div className="panel flex min-h-[17rem] items-center justify-center text-muted">
                <Bilingual k="home.noFeatured" />
              </div>
            )}
          </div>
          <div className="order-2 lg:order-1">
            <WorldCupCountdown dashboard={dashboard} />
          </div>
        </div>
      )}

      <NewUserQuickStart />

      {!boardReady ? (
        <BoardSkeleton />
      ) : (
        <section className="panel-elevated">
          <Suspense fallback={<BoardSkeleton />}>
            <GroupStageBoard
              matches={matches}
              initialStandings={standings}
              championOdds={championOdds}
              championOddsLoading={!extrasReady}
            />
          </Suspense>
        </section>
      )}

      {!extrasReady ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-hidden>
          <SectionFallback className="min-h-[14rem]" />
          <SectionFallback className="min-h-[14rem]" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <TopScorersPanel data={topScorers} loading={!extrasReady} />
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
        </>
      )}
    </div>
  );
}
