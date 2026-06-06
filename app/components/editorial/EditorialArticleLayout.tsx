import type { ReactNode } from 'react';
import { useI18n } from '../../lib/i18n/I18nContext';
import { formatLocalizedVersus } from '../../lib/i18n/stageLabels';

type StickyContext = {
  home: string;
  away: string;
  score: string;
  status: string;
  probLine?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  sidebar?: ReactNode;
  meta?: ReactNode;
  stickyContext?: StickyContext;
  takeaways?: string[];
};

export function EditorialArticleLayout({
  title,
  subtitle,
  children,
  sidebar,
  meta,
  stickyContext,
  takeaways,
}: Props) {
  const { t, mode } = useI18n();

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="min-w-0">
          <header className="mb-8 border-b border-border/60 pb-6">
            <p className="label-tactical text-magenta">
              {t('editorial.mode')}
            </p>
            <h1 className="font-heading mt-2 text-4xl leading-none tracking-tight text-foreground md:text-5xl">
              {title}
            </h1>
            {subtitle && (
              <p className="editorial-prose mt-4 text-muted">{subtitle}</p>
            )}
            {meta && <div className="mt-4">{meta}</div>}
          </header>

          {takeaways && takeaways.length > 0 && (
            <aside className="takeaway-card mb-8">
              <p className="label-tactical mb-3 text-lime">
                {t('editorial.takeaways')}
              </p>
              <ul className="space-y-2 text-editorial text-foreground/90">
                {takeaways.map((t, i) => (
                  <li key={i}>• {t}</li>
                ))}
              </ul>
            </aside>
          )}

          <div className="editorial-prose max-w-editorial">{children}</div>
        </article>

        <aside className={`space-y-4 ${meta ? 'hidden lg:block' : ''}`}>
          {stickyContext && (
            <div className="panel-dense border-cyan/20 lg:sticky lg:top-[4.5rem]">
              <p className="label-tactical text-cyan">
                {t('editorial.context')}
              </p>
              <p className="font-display mt-2 text-2xl tracking-wide">
                {formatLocalizedVersus(stickyContext.home, stickyContext.away, mode)}
              </p>
              <p className="font-mono-data mt-2 text-3xl text-foreground">{stickyContext.score}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-muted">
                {stickyContext.status}
              </p>
              {stickyContext.probLine && (
                <p className="mt-3 font-mono-data text-xs text-cyan">{stickyContext.probLine}</p>
              )}
            </div>
          )}
          {sidebar}
        </aside>
      </div>
    </div>
  );
}
