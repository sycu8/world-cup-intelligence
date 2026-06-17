import { Link } from 'react-router-dom';
import { quickStartSteps, pickGuide } from '../../lib/guideContent';
import { useI18n } from '../../lib/i18n/I18nContext';

const accentClass: Record<string, string> = {
  cyan: 'border-cyan/30 hover:border-cyan/60',
  magenta: 'border-magenta/30 hover:border-magenta/60',
  yellow: 'border-yellow/30 hover:border-yellow/60',
  live: 'border-live/30 hover:border-live/60',
};

export function NewUserQuickStart() {
  const { mode, t } = useI18n();

  return (
    <section className="panel-dense">
      <div className="flex items-start justify-between gap-3">
        <details className="group min-w-0 flex-1">
          <summary className="flex cursor-pointer list-none items-center gap-2 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="font-heading text-base text-foreground sm:text-lg">{t('home.quickStart')}</span>
            <span
              className="text-xs text-muted transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {quickStartSteps.map((step) => (
              <Link
                key={step.to}
                to={step.to}
                className={`rounded-card border bg-panel2/30 p-4 transition ${accentClass[step.accent]}`}
              >
                <p className="font-medium text-foreground">{pickGuide(step.title, mode)}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{pickGuide(step.desc, mode)}</p>
              </Link>
            ))}
          </div>
        </details>
        <Link to="/guide" className="shrink-0 text-sm font-medium text-cyan hover:underline">
          {t('common.fullGuide')}
        </Link>
      </div>
    </section>
  );
}
