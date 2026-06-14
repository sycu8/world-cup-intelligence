/**
 * Vietnam timezone helpers for WC 2026 kickoff display.
 * Kickoff UTC values come from FIFA Match Centre via wc2026-fifa-kickoffs.mjs.
 */
export { kickoffUtcForFifaNumber } from './wc2026-fifa-kickoffs.mjs';

export const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';
export const VN_KICKOFF_SOURCE =
  'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures';

/**
 * Parse dd/mm or dd/mm/yyyy + HH:mm (Vietnam local) → ISO UTC.
 * @param {string} vnDate
 * @param {string} vnTime
 */
export function vnKickoffToUtc(vnDate, vnTime) {
  const dateParts = vnDate.trim().split('/');
  const day = Number(dateParts[0]);
  const month = Number(dateParts[1]);
  const year = dateParts[2]?.length === 4 ? Number(dateParts[2]) : 2026;
  const [hh, mm] = vnTime.trim().split(':').map(Number);
  if (!day || !month || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error(`Invalid VN kickoff: ${vnDate} ${vnTime}`);
  }
  // Vietnam is UTC+7 year-round.
  const utcMs = Date.UTC(year, month - 1, day, hh - 7, mm, 0);
  return new Date(utcMs).toISOString().replace('.000Z', 'Z');
}
