import { useMemo } from 'react';
import { useI18n } from '../../lib/i18n/I18nContext';
import {
  formatKickoffDate,
  getViewerLocale,
  getViewerTimezone,
  kickoffDisplayParts,
  SCHEDULE_TZ,
  timezoneShortLabel,
} from '../../lib/matchKickoffDisplay';

type Props = {
  kickoffUtc: string;
  showDate?: boolean;
  showLocalReference?: boolean;
  showGmt7Label?: boolean;
  className?: string;
  timeClassName?: string;
  dateClassName?: string;
};

export function MatchKickoffDisplay({
  kickoffUtc,
  showDate = false,
  showLocalReference = true,
  showGmt7Label = false,
  className = '',
  timeClassName = '',
  dateClassName = '',
}: Props) {
  const { mode, t } = useI18n();
  const appLocale = mode === 'en' ? 'en' : 'vi-VN';
  const locale = useMemo(() => getViewerLocale(appLocale), [appLocale]);
  const viewerTz = useMemo(() => getViewerTimezone(), []);
  const parts = useMemo(
    () => kickoffDisplayParts(kickoffUtc, viewerTz, locale),
    [kickoffUtc, viewerTz, locale],
  );

  return (
    <span className={className}>
      {showDate && (
        <span className={dateClassName}>
          {formatKickoffDate(kickoffUtc, SCHEDULE_TZ, locale)}
          <br />
        </span>
      )}
      <span className={timeClassName}>
        {parts.time}
        {showGmt7Label && (
          <span className="text-muted-dim"> {parts.gmt7Label}</span>
        )}
      </span>
      {showLocalReference && parts.showLocalReference && parts.localTime && (
        <span className="text-muted">
          {' '}
          ({t('schedule.localTimeShort').replace('{tz}', parts.localTzLabel ?? '')} {parts.localTime})
        </span>
      )}
    </span>
  );
}

export function ScheduleTimezoneBanner() {
  const { mode, t } = useI18n();
  const appLocale = mode === 'en' ? 'en' : 'vi-VN';
  const locale = useMemo(() => getViewerLocale(appLocale), [appLocale]);
  const viewerTz = useMemo(() => getViewerTimezone(), []);
  const gmt7Label = timezoneShortLabel(SCHEDULE_TZ, locale);
  const inScheduleTz = viewerTz === SCHEDULE_TZ;

  return (
    <p className="rounded-lg border border-border/50 bg-panel2/30 px-3 py-2 text-xs text-muted">
      {t('schedule.timezoneBannerGmt7').replace('{tz}', gmt7Label)}
      {!inScheduleTz && (
        <span className="text-muted-dim">
          {' '}
          · {t('schedule.localReference').replace('{tz}', timezoneShortLabel(viewerTz, locale))}
        </span>
      )}
    </p>
  );
}
