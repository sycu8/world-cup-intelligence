import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  title?: string;
};

export function WorldCupCountdown({ title }: Props) {
  const { t } = useI18n();
  const heading = title ?? t('wc.title');

  return (
    <section className="rounded-panel border border-border/80 bg-panel2/60 p-4 shadow-tactical md:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/95 p-1.5 shadow-sm">
          <span className="text-2xl leading-none" aria-hidden>
            🏆
          </span>
        </div>
        <p className="font-heading text-lg font-extrabold tracking-tight text-foreground md:text-xl">
          {heading}
        </p>
      </div>
      <p className="mt-4 text-center text-sm font-medium text-cyan">{t('wc.underway')}</p>
    </section>
  );
}
