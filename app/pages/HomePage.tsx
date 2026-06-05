import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { api, type DashboardData, type NewsArticle, type ScheduleMatch } from '../lib/api';
import { consumeHomePrefetch } from '../lib/homePrefetch';
import { FeaturedMatchHero } from '../components/home/FeaturedMatchHero';
import { WorldCupCountdown } from '../components/home/WorldCupCountdown';
import { PlatformSnapshot } from '../components/home/PlatformSnapshot';
import { NewUserQuickStart } from '../components/home/NewUserQuickStart';
import { HomePageSkeleton } from '../components/home/HomePageSkeleton';
import { Bilingual } from '../components/i18n/Bilingual';
import { useI18n } from '../lib/i18n/I18nContext';

const HomeNewsPreview = lazy(() =>
  import('../components/home/HomeNewsPreview').then((m) => ({ default: m.HomeNewsPreview })),
);
const MatchScheduleCalendar = lazy(() =>
  import('../components/home/MatchScheduleCalendar').then((m) => ({
    default: m.MatchScheduleCalendar,
  })),
);

const REFRESH_MS = 30_000;
const WC2026_TOTAL = 104;
const WC2026_START = '2026-06-11T14:00:00Z';

function SectionFallback({ className = 'min-h-[12rem]' }: { className?: string }) {
  return <div className={`panel animate-pulse rounded-panel bg-panel2/30 ${className}`} aria-hidden />;
}

export function HomePage() {
  const { t } = useI18n();
  const [schedule, setSchedule] = useState<Record<string, ScheduleMatch[]>>({});
  const [matches, setMatches] = useState<ScheduleMatch[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [hotNews, setHotNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const applyHome = useCallback((payload: Awaited<ReturnType<typeof api.home>>) => {
    setSchedule(payload.data.schedule.byDate);
    setMatches(payload.data.schedule.matches);
    setDashboard(payload.data.dashboard);
    setHotNews(payload.data.hotNews.slice(0, 3));
  }, []);

  const load = useCallback(async () => {
    try {
      const prefetched = await consumeHomePrefetch();
      if (prefetched) {
        applyHome(prefetched);
        return;
      }
      applyHome(await api.home());
    } catch {
      setSchedule({});
      setMatches([]);
      setDashboard(null);
      setHotNews([]);
    } finally {
      setLoading(false);
    }
  }, [applyHome]);

  useEffect(() => {
    load();
    let interval: ReturnType<typeof setInterval> | undefined;
    const delay = window.setTimeout(() => {
      interval = window.setInterval(load, REFRESH_MS);
    }, REFRESH_MS);
    return () => {
      window.clearTimeout(delay);
      if (interval) window.clearInterval(interval);
    };
  }, [load]);

  const tournamentStart = dashboard?.tournamentStartUtc ?? WC2026_START;
  const featured = dashboard?.featuredMatch ?? null;

  return (
    <div className="space-y-8">
      <header>
        <Bilingual
          k="home.calendarTitle"
          as="h1"
          className="font-heading text-4xl tracking-tight md:text-5xl"
        />
        <Bilingual k="home.calendarSubtitle" as="p" className="mt-3 max-w-2xl text-base text-foreground/80" />
        <p className="mt-2 text-sm text-muted-dim">
          {t('home.newUserHint')}{' '}
          <Link to="/guide" className="text-cyan hover:underline">
            {t('home.newUserHintLink')}
          </Link>{' '}
          {t('home.newUserHintTail')}
        </p>
      </header>

      {loading ? (
        <HomePageSkeleton />
      ) : (
        <>
          <PlatformSnapshot dashboard={dashboard} />
          <NewUserQuickStart />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            <WorldCupCountdown targetUtc={tournamentStart} />
            {featured ? (
              <FeaturedMatchHero match={featured} />
            ) : (
              <div className="panel flex min-h-[17rem] items-center justify-center text-muted">
                <Bilingual k="home.noFeatured" />
              </div>
            )}
          </div>
          <Suspense fallback={<SectionFallback />}>
            <HomeNewsPreview initialHot={hotNews} />
          </Suspense>
          <Suspense fallback={<SectionFallback className="min-h-[24rem]" />}>
            <MatchScheduleCalendar
              byDate={schedule}
              matches={matches}
              totalExpected={WC2026_TOTAL}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}
