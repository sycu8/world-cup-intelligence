/**
 * WC 2026 kickoff times from FIFA Match Centre API (UTC).
 * @see https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures
 */
import fifaKickoffs from './wc2026-fifa-kickoffs.json' with { type: 'json' };

export const FIFA_KICKOFF_SOURCE =
  'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures';

/** @typedef {{ fifaNumber: number; kickoffUtc: string; fifaMatchId: string; completed?: boolean; homeScore?: number | null; awayScore?: number | null }} FifaKickoffRow */

/** @type {Map<number, FifaKickoffRow>} */
const byFifaNumber = new Map(fifaKickoffs.map((row) => [row.fifaNumber, row]));

/** @param {number} fifaNumber 1–104 */
export function kickoffUtcForFifaNumber(fifaNumber) {
  const row = byFifaNumber.get(fifaNumber);
  if (!row) {
    throw new Error(`Missing FIFA kickoff for match #${fifaNumber}`);
  }
  return row.kickoffUtc;
}

/** @param {number} fifaNumber 1–104 */
export function fifaMatchIdForFifaNumber(fifaNumber) {
  const row = byFifaNumber.get(fifaNumber);
  if (!row) {
    throw new Error(`Missing FIFA match id for match #${fifaNumber}`);
  }
  return row.fifaMatchId;
}

/** @returns {FifaKickoffRow[]} */
export function allFifaKickoffs() {
  return [...fifaKickoffs].sort((a, b) => a.fifaNumber - b.fifaNumber);
}

/** @returns {FifaKickoffRow[]} */
export function completedFifaMatches() {
  return allFifaKickoffs().filter((row) => row.completed);
}

if (byFifaNumber.size !== 104) {
  throw new Error(`Expected 104 FIFA kickoffs, got ${byFifaNumber.size}`);
}
