import { useI18n } from '../../lib/i18n/I18nContext';

export type ArticleLang = 'vi' | 'en';

type Props = {
  lang: ArticleLang;
  onChange: (lang: ArticleLang) => void;
};

export function NewsArticleLangToggle({ lang, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div
      className="inline-flex rounded-lg border border-border/80 bg-panel2/80 p-0.5"
      role="group"
      aria-label={t('news.articleLangLabel')}
    >
      {(
        [
          { id: 'vi' as const, label: 'Tiếng Việt' },
          { id: 'en' as const, label: 'English' },
        ] as const
      ).map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            lang === m.id
              ? m.id === 'vi'
                ? 'bg-cyan/20 text-cyan'
                : 'bg-magenta/20 text-magenta'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
