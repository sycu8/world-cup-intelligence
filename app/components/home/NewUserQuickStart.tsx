import { useState } from 'react';
import { Link } from 'react-router-dom';
import { quickStartSteps, pickGuide } from '../../lib/guideContent';
import { useI18n } from '../../lib/i18n/I18nContext';

const accentClass: Record<string, string> = {
  cyan: 'border-cyan/30 hover:border-cyan/60',
  magenta: 'border-magenta/30 hover:border-magenta/60',
  yellow: 'border-yellow/30 hover:border-yellow/60',
  live: 'border-live/30 hover:border-live/60',
};

const activeTabClass: Record<string, string> = {
  cyan: 'bg-cyan/15 text-cyan ring-1 ring-cyan/30',
  magenta: 'bg-magenta/15 text-magenta ring-1 ring-magenta/30',
  yellow: 'bg-yellow/15 text-yellow ring-1 ring-yellow/30',
  live: 'bg-live/15 text-live ring-1 ring-live/30',
};

export function NewUserQuickStart() {
  const { mode, t } = useI18n();
  const [activeStep, setActiveStep] = useState(0);
  const step = quickStartSteps[activeStep]!;

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

          <div className="mt-4 w-full space-y-3">
            <nav
              className="grid grid-cols-4 gap-1 md:gap-2"
              role="tablist"
              aria-label={t('home.quickStart')}
            >
              {quickStartSteps.map((item, index) => {
                const active = activeStep === index;
                const shortLabel = pickGuide(item.title, mode).replace(/^\d+\.\s*/, '');
                return (
                  <button
                    key={item.to}
                    type="button"
                    role="tab"
                    id={`home-quick-start-tab-${index}`}
                    aria-selected={active}
                    aria-controls={`home-quick-start-panel-${index}`}
                    onClick={() => setActiveStep(index)}
                    className={`w-full rounded-lg px-1.5 py-2.5 text-center text-xs font-semibold transition md:px-2 md:text-sm ${
                      active
                        ? activeTabClass[item.accent]
                        : 'bg-panel2/40 text-muted hover:bg-panel2/70 hover:text-foreground'
                    }`}
                  >
                    <span className="md:hidden">{index + 1}</span>
                    <span className="hidden truncate md:inline">{shortLabel}</span>
                  </button>
                );
              })}
            </nav>

            <div
              id={`home-quick-start-panel-${activeStep}`}
              role="tabpanel"
              aria-labelledby={`home-quick-start-tab-${activeStep}`}
            >
              <Link
                to={step.to}
                className={`block w-full rounded-card border bg-panel2/30 p-4 transition sm:p-5 ${accentClass[step.accent]}`}
              >
                <p className="font-medium text-foreground sm:text-lg">{pickGuide(step.title, mode)}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{pickGuide(step.desc, mode)}</p>
              </Link>
            </div>
          </div>
        </details>

        <Link to="/guide" className="shrink-0 pt-0.5 text-sm font-medium text-cyan hover:underline">
          {t('common.fullGuide')} →
        </Link>
      </div>
    </section>
  );
}
