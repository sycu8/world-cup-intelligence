import type { ProbabilityCalibration } from './calibration';
import {
  computeGroupStandingsFromMatchRows,
  type GroupStageMatchRow,
  type GroupStanding,
} from '../../services/tournamentProgression';

const MATCHES_PER_TEAM = 3;
const COMPLETED = new Set(['completed', 'finished']);

export type GroupPointsPressureSnapshot = {
  /** Share of group fixtures already finished (0–1). */
  groupProgress: number;
  /** Points-chase urgency for the home side (0–1). */
  homePressure: number;
  /** Points-chase urgency for the away side (0–1). */
  awayPressure: number;
};

function teamPointsPressure(
  team: GroupStanding | undefined,
  standings: GroupStanding[],
  groupProgress: number,
): number {
  if (!team || !standings.length) return 0;

  const maxPlayed = Math.max(0, ...standings.map((s) => s.played));
  const leaderPoints = Math.max(0, ...standings.map((s) => s.points));

  if (team.played === 0) {
    if (maxPlayed === 0) return 0;
    const waitLag = Math.min(1, maxPlayed / MATCHES_PER_TEAM);
    const tableHeat = leaderPoints > 0 ? Math.min(1, leaderPoints / 6) : 0.25;
    return Math.min(1, waitLag * 0.55 + groupProgress * 0.3 + tableHeat * 0.15);
  }

  const remaining = MATCHES_PER_TEAM - team.played;
  if (remaining <= 0) return 0;

  const gap = leaderPoints - team.points;
  if (gap <= 0) return 0;

  const urgency = 1 - remaining / MATCHES_PER_TEAM;
  return Math.min(
    1,
    (gap / 6) * (0.35 + urgency * 0.35 + groupProgress * 0.3) * 0.75,
  );
}

/** Derive group-stage points pressure from standings + fixture progress. */
export function buildGroupPointsPressure(
  rows: GroupStageMatchRow[],
  groupCode: string,
  homeTeamId: string,
  awayTeamId: string,
): GroupPointsPressureSnapshot | null {
  const groupRows = rows.filter((r) => r.group_code === groupCode);
  if (!groupRows.length) return null;

  const completed = groupRows.filter((r) => COMPLETED.has(r.status)).length;
  const groupProgress = completed / groupRows.length;
  const standings = computeGroupStandingsFromMatchRows(rows, groupCode);

  return {
    groupProgress,
    homePressure: teamPointsPressure(
      standings.find((s) => s.teamId === homeTeamId),
      standings,
      groupProgress,
    ),
    awayPressure: teamPointsPressure(
      standings.find((s) => s.teamId === awayTeamId),
      standings,
      groupProgress,
    ),
  };
}

export function groupPointsPressureModifier(
  snapshot: GroupPointsPressureSnapshot | undefined,
  calibration: ProbabilityCalibration,
): { home: number; away: number; drawInflationAdjust: number } {
  if (!snapshot) return { home: 1, away: 1, drawInflationAdjust: 0 };

  const maxBoost = calibration.groupPointsPressureMax;
  const home = 1 + snapshot.homePressure * maxBoost;
  const away = 1 + snapshot.awayPressure * maxBoost;
  const combined = (snapshot.homePressure + snapshot.awayPressure) / 2;
  const drawInflationAdjust = -combined * calibration.groupPointsPressureDrawDampen;

  return { home, away, drawInflationAdjust };
}
