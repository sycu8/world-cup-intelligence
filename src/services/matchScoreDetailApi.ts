import type { MatchScoreDetail } from './matchScoreDetail';
import { parseScoreDetailJson, resolveMatchScoreDetail } from './matchScoreDetail';

export type WithScoreDetail<T> = T & { scoreDetail: MatchScoreDetail | null };

export function attachParsedScoreDetail<T extends Record<string, unknown>>(
  row: T,
): T & { scoreDetail: MatchScoreDetail | null } {
  const raw = row.score_detail_json;
  return {
    ...row,
    scoreDetail: parseScoreDetailJson(typeof raw === 'string' ? raw : null),
  };
}

export async function attachResolvedScoreDetail<
  T extends {
    id: string;
    home_team_id: string;
    away_team_id: string;
    score_detail_json?: string | null;
  },
>(db: D1Database, row: T): Promise<WithScoreDetail<T>> {
  return {
    ...row,
    scoreDetail: await resolveMatchScoreDetail(db, row),
  };
}
