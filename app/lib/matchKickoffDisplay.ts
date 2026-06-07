/** Vietnam reference timezone for WC 2026 schedule (Thể Thao 247). */
export const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

export const VN_SCHEDULE_SOURCE =
  'https://thethao247.vn/world-cup/426-lich-thi-dau-world-cup-2026-d399919.html';

export function getViewerTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || VIETNAM_TZ;
  } catch {
    return VIETNAM_TZ;
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
  vnTime?: string;
  showVnReference: boolean;
};

export function kickoffDisplayParts(
  kickoffUtc: string,
  viewerTz: string,
  locale: string,
): KickoffDisplayParts {
  const inVn = isVietnamTimezone(viewerTz);
  return {
    date: formatKickoffDate(kickoffUtc, viewerTz, locale),
    time: formatKickoffTime(kickoffUtc, viewerTz, locale),
    vnTime: inVn ? undefined : formatKickoffTime(kickoffUtc, VIETNAM_TZ, locale),
    showVnReference: !inVn,
  };
}
