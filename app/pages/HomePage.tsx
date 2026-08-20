import { useEffect, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { api, type LeagueCatalogPayload } from '../lib/api';
import { usePageMeta } from '../lib/usePageMeta';
import { useI18n } from '../lib/i18n/I18nContext';
import { HomeLandingHero } from '../components/home/HomeLandingHero';
import { HomeLandingValue } from '../components/home/HomeLandingValue';
import { HomeLeaguePulse } from '../components/home/HomeLeaguePulse';
import { HomeWorldCupStrip } from '../components/home/HomeWorldCupStrip';
import { LeagueCard } from '../components/leagues/LeagueCard';

const HomeNewsPreview = lazy(() =>
  import('../components/home/HomeNewsPreview').then((m) => ({ default: m.HomeNewsPreview })),
);

function SectionFallback({ className = 'min-h-[10rem]' }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-panel2/30 ${className}`} aria-hidden />;
}

export function HomePage() {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState<LeagueCatalogPayload | null>(null);
  const [ready, setReady] = useState(false);

  usePageMeta({
    title: t('home.landing.metaTitle'),
    description: t('home.landing.metaDescription'),
  });

  useEffect(() => {
    let cancelled = false;
    void api
      .leagues()
      .then((res) => {
        if (!cancelled) {
          setCatalog(res.data);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog(null);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const leagues = catalog?.leagues ?? [];
  const liveCount = leagues.reduce((sum, l) => sum + (l.liveCount ?? 0), 0);

  return (
    <div className="home-landing">
      <HomeLandingHero liveCount={liveCount} leagueCount={leagues.length || 5} />

      <div className="home-landing-body space-y-14 sm:space-y-16">
        <section className="home-landing-section" aria-labelledby="home-leagues-title">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="home-leagues-title" className="font-heading text-2xl tracking-tight sm:text-3xl">
                {t('home.landing.leaguesTitle')}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted sm:text-base">{t('home.landing.leaguesSubtitle')}</p>
            </div>
            <Link to="/leagues" className="shrink-0 text-sm font-medium text-cyan hover:underline">
              {t('leagues.choose')} →
            </Link>
          </div>
          {!ready ? (
            <SectionFallback className="min-h-[12rem]" />
          ) : leagues.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {leagues.map((league) => (
                <LeagueCard key={league.id} league={league} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{t('home.landing.leaguesEmpty')}</p>
          )}
        </section>

        <HomeLandingValue />

        {ready ? <HomeLeaguePulse leagues={leagues} /> : <SectionFallback />}

        <HomeWorldCupStrip />

        <section className="home-landing-section" aria-labelledby="home-news-title">
          <h2 id="home-news-title" className="font-heading text-2xl tracking-tight sm:text-3xl">
            {t('home.landing.newsTitle')}
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted">{t('home.landing.newsSubtitle')}</p>
          <Suspense fallback={<SectionFallback />}>
            <HomeNewsPreview />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
