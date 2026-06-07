/**
 * WC 2026 kickoff times in Vietnam (GMT+7) — source: Thể Thao 247
 * @see https://thethao247.vn/world-cup/426-lich-thi-dau-world-cup-2026-d399919.html
 */
import vnKickoffs from './wc2026-vn-kickoffs.json' with { type: 'json' };

export const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';
export const VN_KICKOFF_SOURCE =
  'https://thethao247.vn/world-cup/426-lich-thi-dau-world-cup-2026-d399919.html';

/** @typedef {{ fifaNumber: number; vnDate: string; vnTime: string }} VnKickoffRow */

/** @type {Map<number, VnKickoffRow>} */
const byFifaNumber = new Map(vnKickoffs.map((row) => [row.fifaNumber, row]));

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

/** @param {number} fifaNumber 1–104 */
export function kickoffUtcForFifaNumber(fifaNumber) {
  const row = byFifaNumber.get(fifaNumber);
  if (!row) {
    throw new Error(`Missing VN kickoff for FIFA match #${fifaNumber}`);
  }
  return vnKickoffToUtc(row.vnDate, row.vnTime);
}

/** @returns {VnKickoffRow[]} */
export function allVnKickoffs() {
  return [...vnKickoffs].sort((a, b) => a.fifaNumber - b.fifaNumber);
}

if (byFifaNumber.size !== 104) {
  throw new Error(`Expected 104 VN kickoffs, got ${byFifaNumber.size}`);
}
