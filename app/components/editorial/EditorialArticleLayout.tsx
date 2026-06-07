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
  /** Override kicker label (default: editorial.mode) */
  kicker?: string;
};

function EditorialContextCard({
  context,
  compact = false,
}: {
  context: StickyContext;
  compact?: boolean;
}) {
  const { t, mode } = useI18n();

  return (
    <div
      className={
        compact
          ? 'editorial-context-mobile panel-dense border-cyan/20'
          : 'panel-dense border-cyan/20 lg:sticky lg:top-[4.5rem]'
      }
    >
      <p className="label-tactical text-cyan">{t('editorial.context')}</p>
      <p
        className={`font-display mt-2 tracking-wide text-foreground ${
          compact ? 'text-base leading-snug' : 'text-lg leading-snug sm:text-2xl'
        }`}
      >
        {formatLocalizedVersus(context.home, context.away, mode)}
      </p>
      <div className={`mt-2 flex flex-wrap items-end gap-x-3 gap-y-1 ${compact ? '' : 'sm:gap-x-4'}`}>
        <p className={`font-mono-data tabular-nums text-foreground ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>
          {context.score}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted sm:text-xs">{context.status}</p>
      </div>
      {context.probLine && (
        <p
          className={`mt-2 break-words font-mono-data leading-relaxed text-cyan ${
            compact ? 'text-[10px] sm:text-[11px]' : 'text-[11px] sm:text-xs'
          }`}
        >
          {context.probLine}
        </p>
      )}
    </div>
  );
}

export function EditorialArticleLayout({
  title,
  subtitle,
  children,
  sidebar,
  meta,
  stickyContext,
  takeaways,
  kicker,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="editorial-layout mx-auto max-w-[1200px]">
      {stickyContext && (
        <div className="mb-4 lg:hidden">
          <EditorialContextCard context={stickyContext} compact />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,300px)] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="min-w-0">
          <header className="mb-6 border-b border-border/60 pb-5 sm:mb-8 sm:pb-6">
            <p className="label-tactical text-magenta">{kicker ?? t('editorial.mode')}</p>
            <h1 className="font-heading mt-2 text-2xl leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
              {title}
            </h1>
            {meta && <div className="mt-3 text-sm text-muted">{meta}</div>}
            {subtitle && (
              <p className="mt-3 text-base leading-relaxed text-muted sm:mt-4 sm:text-lg">{subtitle}</p>
            )}
          </header>

          {takeaways && takeaways.length > 0 && (
            <aside className="takeaway-card mb-6 sm:mb-8">
              <p className="label-tactical mb-3 text-lime">{t('editorial.takeaways')}</p>
              <ul className="space-y-2 text-sm leading-relaxed text-foreground/90 sm:text-editorial">
                {takeaways.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-lime/80">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <div className="editorial-prose max-w-none lg:max-w-editorial">{children}</div>
        </article>

        {(stickyContext || sidebar) && (
          <aside className="editorial-sidebar min-w-0 space-y-4">
            {stickyContext && (
              <div className="hidden lg:block">
                <EditorialContextCard context={stickyContext} />
              </div>
            )}
            {sidebar}
          </aside>
        )}
      </div>
    </div>
  );
}
