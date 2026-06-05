import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type NewsArticle } from '../../lib/api';
import { NewsArticleCard } from '../news/NewsArticleCard';
import { useI18n } from '../../lib/i18n/I18nContext';

const REFRESH_MS = 30_000;
const POLL_MS = 5_000;
const MAX_POLLS = 6;
const POLL_START_DELAY_MS = 8_000;

type Props = {
  initialHot?: NewsArticle[];
};

export function HomeNewsPreview({ initialHot = [] }: Props) {
  const { mode, t } = useI18n();
  const navigate = useNavigate();
  const [hot, setHot] = useState<NewsArticle[]>(initialHot);
  const [loading, setLoading] = useState(initialHot.length === 0);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    setHot(initialHot);
    if (initialHot.length) setLoading(false);
  }, [initialHot]);

  const load = useCallback(async () => {
    try {
      const r = await api.news({ page: 1, pageSize: 3, hot: 3 });
      setHot(r.data.hot.slice(0, 3));
    } catch {
      setHot([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialHot.length) return;
    load();
  }, [initialHot.length, load, mode]);

  useEffect(() => {
    if (initialHot.length) return;
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [initialHot.length, load]);

  const needsVi = mode === 'vi' && hot.some((a) => !a.translated);

  useEffect(() => {
    if (!needsVi || polls >= MAX_POLLS) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setPolls((n) => n + 1);
        load();
      }, POLL_MS);
    }, POLL_START_DELAY_MS);
    return () => {
      window.clearTimeout(start);
      if (interval) window.clearInterval(interval);
    };
  }, [needsVi, polls, load]);

  if (loading && !hot.length) {
    return (
      <section className="panel min-h-[12rem] animate-pulse rounded-panel bg-panel2/30" aria-hidden />
    );
  }

  if (!hot.length) return null;

  return (
    <section className="panel min-h-[12rem] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="label-tactical text-yellow">{t('home.headlines')}</h2>
        <Link to="/news-intelligence" className="text-sm text-cyan hover:underline">
          {t('common.allNews')}
        </Link>
      </div>
      <ul className="space-y-3">
        {hot.map((a) => (
          <li key={a.id}>
            <NewsArticleCard
              article={a}
              variant="hot"
              onSelect={() => navigate(`/news-intelligence/${a.id}`)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
