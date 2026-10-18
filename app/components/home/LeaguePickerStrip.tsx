import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type LeagueCatalogPayload } from '../../lib/api';
import { LeagueCard } from '../leagues/LeagueCard';
import { Bilingual } from '../i18n/Bilingual';
import { useI18n } from '../../lib/i18n/I18nContext';

export function LeaguePickerStrip() {
  const { t } = useI18n();
  const [data, setData] = useState<LeagueCatalogPayload | null>(null);

  useEffect(() => {
    api
      .leagues()
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, []);

  if (!data?.leagues.length) return null;

  return (
    <section className="home-section layout-contained">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="section-title">{t('home.chooseLeague')}</h2>
          <Bilingual k="leagues.pageSubtitle" as="p" className="section-subtitle" />
        </div>
        <Link to="/leagues" className="shrink-0 text-sm font-medium text-cyan hover:underline">
          {t('leagues.choose')} →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.leagues.map((league) => (
          <LeagueCard key={league.id} league={league} />
        ))}
      </div>
    </section>
  );
}
