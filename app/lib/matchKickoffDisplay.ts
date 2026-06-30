/** Canonical WC 2026 schedule timezone (Vietnam, GMT+7). */
export const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

/** Primary timezone for kickoff display and schedule grouping. */
export const SCHEDULE_TZ = VIETNAM_TZ;

export const VN_SCHEDULE_SOURCE =
  'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures';

export function getViewerTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || SCHEDULE_TZ;
  } catch {
    return SCHEDULE_TZ;
  }
}

/** Device locale for date/time formatting; falls back to app language. */
export function getViewerLocale(fallbackLocale: string): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || fallbackLocale;
  } catch {
    return fallbackLocale;
  }
}

export function isVietnamTimezone(timeZone: string): boolean {
  return timeZone === VIETNAM_TZ;
}

/** YYYY-MM-DD in the given IANA timezone. */
export function localDateKey(kickoffUtc: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(kickoffUtc));
}

export function formatKickoffTime(
  kickoffUtc: string,
  timeZone: string,
  locale: string,
): string {
  return new Date(kickoffUtc).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  });
}

export function formatKickoffDate(
  kickoffUtc: string,
  timeZone: string,
  locale: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Date(kickoffUtc).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    ...opts,
  });
}

export function formatKickoffDateLong(
  kickoffUtc: string,
  timeZone: string,
  locale: string,
): string {
  return new Date(kickoffUtc).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  });
}

export function formatKickoffDateTime(
  kickoffUtc: string,
  locale: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Date(kickoffUtc).toLocaleString(locale, {
    timeZone: SCHEDULE_TZ,
    ...opts,
  });
}

/** Short label like "GMT+7" or "EST" for the active timezone. */
export function timezoneShortLabel(timeZone: string, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date());
  const offset = parts.find((p) => p.type === 'timeZoneName')?.value;
  if (offset) return offset;
  return (
    new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  );
}

export type KickoffDisplayParts = {
  date: string;
  time: string;
  gmt7Label: string;
  localTime?: string;
  localTzLabel?: string;
  showLocalReference: boolean;
};

/** GMT+7 primary kickoff; device local time when viewer TZ differs. */
export function kickoffDisplayParts(
  kickoffUtc: string,
  viewerTz: string,
  locale: string,
): KickoffDisplayParts {
  const inScheduleTz = isVietnamTimezone(viewerTz);
  return {
    date: formatKickoffDate(kickoffUtc, SCHEDULE_TZ, locale),
    time: formatKickoffTime(kickoffUtc, SCHEDULE_TZ, locale),
    gmt7Label: timezoneShortLabel(SCHEDULE_TZ, locale),
    localTime: inScheduleTz ? undefined : formatKickoffTime(kickoffUtc, viewerTz, locale),
    localTzLabel: inScheduleTz ? undefined : timezoneShortLabel(viewerTz, locale),
    showLocalReference: !inScheduleTz,
  };
}
