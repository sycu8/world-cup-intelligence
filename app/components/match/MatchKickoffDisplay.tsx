import { useMemo } from 'react';
import { useI18n } from '../../lib/i18n/I18nContext';
import {
  formatKickoffDate,
  getViewerTimezone,
  isVietnamTimezone,
  kickoffDisplayParts,
  timezoneShortLabel,
  VIETNAM_TZ,
} from '../../lib/matchKickoffDisplay';

type Props = {
  kickoffUtc: string;
  showDate?: boolean;
  showVnReference?: boolean;
  className?: string;
  timeClassName?: string;
  dateClassName?: string;
};

export function MatchKickoffDisplay({
  kickoffUtc,
  showDate = false,
  showVnReference = true,
  className = '',
  timeClassName = '',
  dateClassName = '',
}: Props) {
  const { mode, t } = useI18n();
  const locale = mode === 'en' ? 'en' : 'vi-VN';
  const viewerTz = useMemo(() => getViewerTimezone(), []);
  const parts = useMemo(
    () => kickoffDisplayParts(kickoffUtc, viewerTz, locale),
    [kickoffUtc, viewerTz, locale],
  );

  return (
    <span className={className}>
      {showDate && (
        <span className={dateClassName}>
          {formatKickoffDate(kickoffUtc, viewerTz, locale)}
          <br />
        </span>
      )}
      <span className={timeClassName}>{parts.time}</span>
      {showVnReference && parts.showVnReference && parts.vnTime && (
        <span className="text-muted">
          {' '}
          ({t('schedule.vnTimeShort')} {parts.vnTime})
        </span>
      )}
    </span>
  );
}

export function ScheduleTimezoneBanner() {
  const { mode, t } = useI18n();
  const locale = mode === 'en' ? 'en' : 'vi-VN';
  const viewerTz = useMemo(() => getViewerTimezone(), []);
  const tzLabel = timezoneShortLabel(viewerTz, locale);
  const inVn = isVietnamTimezone(viewerTz);

  return (
    <p className="rounded-lg border border-border/50 bg-panel2/30 px-3 py-2 text-xs text-muted">
      {inVn
        ? t('schedule.timezoneBannerVn')
        : t('schedule.timezoneBannerLocal').replace('{tz}', tzLabel)}
      {!inVn && (
        <span className="text-muted-dim">
          {' '}
          · {t('schedule.vnReference')} ({timezoneShortLabel(VIETNAM_TZ, locale)})
        </span>
      )}
    </p>
  );
}
