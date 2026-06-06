import { useI18n } from '../../lib/i18n/I18nContext';

export type ViewMode = 'tactical' | 'editorial';

type Props = {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
};

export function ViewModeToggle({ mode, onChange }: Props) {
  const { mode: lang, t } = useI18n();

  return (
    <div
      className="inline-flex rounded-lg border border-border/80 bg-panel2/80 p-0.5"
      role="group"
      aria-label={t('viewMode.label')}
    >
      {(
        [
          { id: 'tactical' as const, vi: 'Chiến thuật', en: 'Tactical' },
          { id: 'editorial' as const, vi: 'Đọc bài', en: 'Editorial' },
        ] as const
      ).map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            mode === m.id
              ? m.id === 'tactical'
                ? 'bg-cyan/20 text-cyan'
                : 'bg-magenta/20 text-magenta'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {lang === 'en' ? m.en : m.vi}
        </button>
      ))}
    </div>
  );
}
