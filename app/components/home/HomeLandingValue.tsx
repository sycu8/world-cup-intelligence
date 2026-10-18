import { useI18n } from '../../lib/i18n/I18nContext';

const STEPS = [
  { titleKey: 'home.landing.valueFixtures' as const, bodyKey: 'home.landing.valueFixturesBody' as const },
  { titleKey: 'home.landing.valuePredict' as const, bodyKey: 'home.landing.valuePredictBody' as const },
  { titleKey: 'home.landing.valueIntel' as const, bodyKey: 'home.landing.valueIntelBody' as const },
];

/** One purpose: explain what PitchIntel delivers for club leagues. */
export function HomeLandingValue() {
  const { t } = useI18n();

  return (
    <section className="home-landing-section" aria-labelledby="home-value-title">
      <h2 id="home-value-title" className="font-heading text-2xl tracking-tight sm:text-3xl">
        {t('home.landing.valueTitle')}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
        {t('home.landing.valueSubtitle')}
      </p>
      <ul className="home-landing-value-list mt-8">
        {STEPS.map((step, index) => (
          <li key={step.titleKey} className="home-landing-value-item">
            <span className="home-landing-value-index" aria-hidden>
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className="font-heading text-lg text-foreground">{t(step.titleKey)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t(step.bodyKey)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
