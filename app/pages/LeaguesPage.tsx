import { useEffect, useState } from 'react';
import { api, type LeagueCatalogPayload } from '../lib/api';
import { LeagueCard } from '../components/leagues/LeagueCard';
import { Bilingual } from '../components/i18n/Bilingual';
import { useI18n } from '../lib/i18n/I18nContext';

export function LeaguesPage() {
  const { t, mode } = useI18n();
  const [data, setData] = useState<LeagueCatalogPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .leagues()
      .then((res) => setData(res.data))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <Bilingual k="leagues.pageTitle" as="h1" className="font-heading text-3xl tracking-tight sm:text-4xl" />
        <Bilingual k="leagues.pageSubtitle" as="p" className="mt-2 text-sm text-muted sm:text-base" />
      </header>

      {error ? <p className="text-sm text-muted">{t('leagues.emptyMatches')}</p> : null}

      {data?.featured ? (
        <section>
          <h2 className="mb-3 font-heading text-sm uppercase tracking-wide text-muted">{t('leagues.featured')}</h2>
          <LeagueCard league={data.featured} featured />
        </section>
      ) : null}

      {data?.regions.map((region) => (
        <section key={region.region}>
          <h2 className="mb-3 font-heading text-xl">
            {mode === 'vi' ? region.label.vi : region.label.en}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {region.leagues.map((league) => (
              <LeagueCard key={league.id} league={league} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
