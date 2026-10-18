import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { quickStartSteps, pickGuide } from '../../lib/guideContent';
import { useI18n } from '../../lib/i18n/I18nContext';

const STORAGE_KEY = 'pitchintel-quickstart-opened';
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
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const step = quickStartSteps[activeStep]!;

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, '1');
      }
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = open;
  }, [open]);

  return (
    <section className="panel-dense">
      <div className="flex items-start justify-between gap-3">
        <details
          ref={detailsRef}
          className="group min-w-0 flex-1"
          onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan/15 text-base" aria-hidden>
              ✨
            </span>
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
              className="grid grid-cols-4 gap-1.5 md:gap-2"
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
                    className={`mobile-touch-target w-full rounded-xl px-1.5 py-2 text-center text-xs font-semibold transition md:px-2 md:text-sm ${
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
                className={`surface-interactive block w-full rounded-card border bg-panel2/30 p-4 sm:p-5 ${accentClass[step.accent]}`}
              >
                <p className="font-medium text-foreground sm:text-lg">{pickGuide(step.title, mode)}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{pickGuide(step.desc, mode)}</p>
                <span className="mt-3 inline-block text-sm font-semibold text-cyan">→</span>
              </Link>
            </div>
          </div>
        </details>

        <Link to="/guide" className="btn-ghost shrink-0">
          {t('common.fullGuide')} →
        </Link>
      </div>
    </section>
  );
}
