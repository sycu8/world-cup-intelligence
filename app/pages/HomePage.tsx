import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import type { GroupStandingsPayload } from '../lib/api';
import { Link } from 'react-router-dom';
import { api, type DashboardData, type NewsArticle, type ScheduleMatch, type ChampionOddsPayload } from '../lib/api';
import { consumeHomePrefetch } from '../lib/homePrefetch';
import { FeaturedMatchHero } from '../components/home/FeaturedMatchHero';
import { WorldCupCountdown } from '../components/home/WorldCupCountdown';
import { PlatformSnapshot } from '../components/home/PlatformSnapshot';
import { ChampionOddsPanel } from '../components/home/ChampionOddsPanel';
import { NewUserQuickStart } from '../components/home/NewUserQuickStart';
import { HomePageSkeleton } from '../components/home/HomePageSkeleton';
import { Bilingual } from '../components/i18n/Bilingual';
import { useI18n } from '../lib/i18n/I18nContext';

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

export function HomePage() {
  const { t } = useI18n();
  const [matches, setMatches] = useState<ScheduleMatch[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [hotNews, setHotNews] = useState<NewsArticle[]>([]);
  const [standings, setStandings] = useState<GroupStandingsPayload | null>(null);
  const [matchProbabilities, setMatchProbabilities] = useState<
    Record<string, { homeWin: number; draw: number; awayWin: number }>
  >({});
  const [championOdds, setChampionOdds] = useState<ChampionOddsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const applyHome = useCallback((payload: Awaited<ReturnType<typeof api.home>>) => {
    setMatches(payload.data.schedule.matches);
    setDashboard(payload.data.dashboard);
    setHotNews(payload.data.hotNews.slice(0, 3));
    setStandings(payload.data.standings ?? null);
    setMatchProbabilities(payload.data.matchProbabilities ?? {});
    setChampionOdds(payload.data.championOdds ?? null);
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
      setMatches([]);
      setDashboard(null);
      setHotNews([]);
      setStandings(null);
      setMatchProbabilities({});
      setChampionOdds(null);
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
          <NewUserQuickStart />
          <Suspense fallback={<SectionFallback className="min-h-[24rem]" />}>
            <GroupStageBoard
              matches={matches}
              initialStandings={standings}
              initialProbs={matchProbabilities}
            />
          </Suspense>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-stretch">
            <div className="flex flex-col gap-4">
              <WorldCupCountdown />
              <ChampionOddsPanel odds={championOdds} loading={!championOdds} />
              <PlatformSnapshot dashboard={dashboard} compact />
            </div>
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
        </>
      )}
    </div>
  );
}
