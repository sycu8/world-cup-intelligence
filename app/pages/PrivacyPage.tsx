import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n/I18nContext';
import { pickPrivacy, privacyEffectiveDate, privacySections } from '../lib/privacyContent';

export function PrivacyPage() {
  const { mode, t } = useI18n();
  const p = (b: { vi: string; en: string }) => pickPrivacy(b, mode);

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-8">
      <header className="space-y-3">
        <Link to="/" className="text-sm text-muted hover:text-cyan">
          ← {t('common.backHome')}
        </Link>
        <h1 className="font-heading text-4xl tracking-tight text-foreground">{t('privacy.title')}</h1>
        <p className="text-sm text-muted-dim">
          {t('privacy.effective')}: {privacyEffectiveDate}
        </p>
        <p className="text-lg leading-relaxed text-muted">{t('privacy.intro')}</p>
      </header>

      {privacySections.map((section) => (
        <section key={section.id} id={section.id} className="space-y-3">
          <h2 className="font-heading text-2xl text-foreground">{p(section.title)}</h2>
          <p className="leading-relaxed text-muted">{p(section.body)}</p>
          {'bullets' in section && section.bullets && (
            <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/90">
              {section.bullets.map((bullet, i) => (
                <li key={i}>{p(bullet)}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="panel border-cyan/20">
        <p className="text-sm leading-relaxed text-muted">{t('privacy.disclaimer')}</p>
      </section>
    </div>
  );
}
