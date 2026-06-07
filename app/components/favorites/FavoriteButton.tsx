import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  active: boolean;
  onToggle: () => void;
  label: string;
  size?: 'sm' | 'md';
};

export function FavoriteButton({ active, onToggle, label, size = 'sm' }: Props) {
  const { t } = useI18n();
  const dim = size === 'md' ? 'h-9 w-9 text-lg' : 'h-7 w-7 text-base';

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={active ? t('favorites.remove') : t('favorites.add')}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border transition ${dim} ${
        active
          ? 'border-yellow/50 bg-yellow/15 text-yellow'
          : 'border-border/60 bg-panel2/40 text-muted hover:border-yellow/40 hover:text-yellow'
      }`}
    >
      <span aria-hidden>{active ? '★' : '☆'}</span>
    </button>
  );
}
