import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/I18nContext';

/** Secondary path to World Cup — not competing with the club-league hero. */
export function HomeWorldCupStrip() {
  const { t } = useI18n();

  return (
    <section className="home-landing-wc" aria-labelledby="home-wc-title">
      <div className="home-landing-wc__inner">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-yellow/90">
            {t('home.landing.wcEyebrow')}
          </p>
          <h2 id="home-wc-title" className="mt-1 font-heading text-xl tracking-tight sm:text-2xl">
            {t('home.landing.wcTitle')}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{t('home.landing.wcBody')}</p>
        </div>
        <Link to="/matches" className="btn-ghost shrink-0 border border-yellow/30 text-yellow">
          {t('home.landing.wcCta')}
        </Link>
      </div>
    </section>
  );
}
