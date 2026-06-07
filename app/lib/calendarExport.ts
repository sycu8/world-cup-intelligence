import type { ScheduleMatch } from './api';

function formatIcsUtc(utc: string): string {
  return new Date(utc).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function matchEndUtc(kickoffUtc: string): string {
  const end = new Date(kickoffUtc);
  end.setUTCHours(end.getUTCHours() + 2);
  return end.toISOString();
}

export function buildMatchIcsEvent(match: ScheduleMatch): string {
  const summary = `${match.home_name} vs ${match.away_name}`;
  const stage = match.group_code
    ? `Group ${match.group_code}`
    : match.stage
      ? match.stage
      : 'World Cup 2026';

  return [
    'BEGIN:VEVENT',
    `UID:wc2026-${match.id}@wcstat.orangecloud.vn`,
    `DTSTAMP:${formatIcsUtc(new Date().toISOString())}`,
    `DTSTART:${formatIcsUtc(match.kickoff_utc)}`,
    `DTEND:${formatIcsUtc(matchEndUtc(match.kickoff_utc))}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(`${stage} · FIFA World Cup 2026`)}`,
    'END:VEVENT',
  ].join('\r\n');
}

export function buildScheduleIcs(matches: ScheduleMatch[]): string {
  const events = matches.map((m) => buildMatchIcsEvent(m)).join('\r\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WC Tactical//World Cup 2026//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:FIFA World Cup 2026',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadScheduleIcs(matches: ScheduleMatch[], filename = 'world-cup-2026.ics'): void {
  downloadTextFile(filename, buildScheduleIcs(matches), 'text/calendar;charset=utf-8');
}

export function downloadMatchIcs(match: ScheduleMatch): void {
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WC Tactical//World Cup 2026//EN',
    buildMatchIcsEvent(match),
    'END:VCALENDAR',
  ].join('\r\n');
  downloadTextFile(`wc2026-${match.id}.ics`, body, 'text/calendar;charset=utf-8');
}

export function googleCalendarUrl(match: ScheduleMatch): string {
  const start = formatIcsUtc(match.kickoff_utc);
  const end = formatIcsUtc(matchEndUtc(match.kickoff_utc));
  const text = encodeURIComponent(`${match.home_name} vs ${match.away_name}`);
  const details = encodeURIComponent(
    `FIFA World Cup 2026${match.group_code ? ` · Group ${match.group_code}` : match.stage ? ` · ${match.stage}` : ''}`,
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
}
