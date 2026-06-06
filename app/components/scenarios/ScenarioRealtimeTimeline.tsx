import { useI18n } from '../../lib/i18n/I18nContext';

export function ScenarioRealtimeTimeline({ updatedAt }: { updatedAt: string }) {
  const { t, mode } = useI18n();
  const locale = mode === 'en' ? 'en' : 'vi-VN';
  return (
    <p className="font-mono-data text-[11px] text-muted-dim">
      {t('scenario.lastUpdated')} {new Date(updatedAt).toLocaleString(locale)}
    </p>
  );
}
