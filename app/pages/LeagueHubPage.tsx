import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type LeagueHubPayload } from '../lib/api';
import { LeagueTable } from '../components/leagues/LeagueTable';
import { LeagueMatchList } from '../components/leagues/LeagueMatchList';
import { NewsArticleCard } from '../components/news/NewsArticleCard';
import { useI18n } from '../lib/i18n/I18nContext';
import type { LocaleKey } from '../lib/i18n/locales';

type HubTab = 'overview' | 'standings' | 'fixtures' | 'results' | 'news';

const TABS: { id: HubTab; key: LocaleKey }[] = [
  { id: 'overview', key: 'leagues.tabOverview' },
  { id: 'standings', key: 'leagues.tabStandings' },
  { id: 'fixtures', key: 'leagues.tabFixtures' },
  { id: 'results', key: 'leagues.tabResults' },
  { id: 'news', key: 'leagues.tabNews' },
];

export function LeagueHubPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { t, mode } = useI18n();
  const [data, setData] = useState<LeagueHubPayload | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<HubTab>('overview');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setMissing(false);
    setTab('overview');
    api
      .league(slug)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setMissing(true);
        }
      });
    const timer = setInterval(() => {
      api
        .league(slug)
        .then((res) => {
          if (!cancelled) setData(res.data);
        })
        .catch(() => undefined);
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [slug]);

  if (missing) {
    return (
      <div className="space-y-4">
        <p>{t('leagues.notFound')}</p>
        <Link to="/leagues" className="text-cyan hover:underline">
          ← {t('leagues.back')}
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="panel min-h-[40vh] animate-pulse" aria-busy />;
  }

  const name = mode === 'vi' ? data.league.nameVi : data.league.name;
  const region = mode === 'vi' ? data.regionLabel.vi : data.regionLabel.en;
  const groups = Object.entries(data.standings);
  const probs = data.matchProbabilities;

  return (
    <div className="space-y-6">
      <header>
        <Link to="/leagues" className="text-sm text-cyan hover:underline">
          ← {t('leagues.back')}
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {region} · {t('leagues.season')} {data.league.season}
        </p>
        <h1 className="font-heading text-3xl tracking-tight sm:text-4xl">{name}</h1>
      </header>

      <div className="flex flex-wrap gap-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === item.id ? 'border-pressing bg-cyan/15 text-cyan' : 'text-foreground/75 hover:bg-panel2/60'
            }`}
          >
            {t(item.key)}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="panel lg:col-span-3">
            <h2 className="font-heading text-lg">{t('leagues.live')}</h2>
            <LeagueMatchList matches={data.live} probs={probs} />
            <h2 className="mt-6 font-heading text-lg">{t('leagues.upcoming')}</h2>
            <LeagueMatchList matches={data.upcoming} probs={probs} />
          </section>
          <aside className="space-y-4 lg:col-span-2">
            <section className="panel">
              <h2 className="mb-2 font-heading text-lg">{t('leagues.standings')}</h2>
              {groups.slice(0, 1).map(([key, rows]) => (
                <LeagueTable key={key} rows={rows} groupLabel={key === 'table' ? undefined : key} />
              ))}
            </section>
            <section className="panel">
              <h2 className="mb-2 font-heading text-lg">{t('leagues.scorers')}</h2>
              {data.topScorers.length ? (
                <ol className="space-y-2 text-sm">
                  {data.topScorers.map((row) => (
                    <li key={row.playerId} className="flex justify-between gap-2">
                      <span>
                        {row.rank}. {row.playerName}
                        <span className="text-muted"> · {row.teamName}</span>
                      </span>
                      <span className="font-mono-data text-cyan">{row.goals}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">{t('leagues.emptyScorers')}</p>
              )}
            </section>
          </aside>
        </div>
      ) : null}

      {tab === 'standings' ? (
        <section className="panel space-y-6">
          {groups.length ? (
            groups.map(([key, rows]) => (
              <LeagueTable key={key} rows={rows} groupLabel={groups.length > 1 ? key : undefined} />
            ))
          ) : (
            <p className="text-sm text-muted">{t('leagues.emptyStandings')}</p>
          )}
        </section>
      ) : null}

      {tab === 'fixtures' ? (
        <section className="panel">
          <LeagueMatchList matches={[...data.live, ...data.upcoming]} probs={probs} />
        </section>
      ) : null}

      {tab === 'results' ? (
        <section className="panel">
          <LeagueMatchList matches={data.results} probs={probs} />
        </section>
      ) : null}

      {tab === 'news' ? (
        <section className="space-y-3">
          {data.news.length ? (
            data.news.map((article) => (
              <NewsArticleCard
                key={article.id}
                article={article}
                onSelect={() => navigate(`/news-intelligence/${article.id}`)}
              />
            ))
          ) : (
            <p className="text-sm text-muted">{t('leagues.emptyNews')}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
