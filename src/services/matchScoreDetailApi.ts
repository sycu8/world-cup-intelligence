import type { MatchScoreDetail } from './matchScoreDetail';
import { parseScoreDetailJson, resolveMatchScoreDetail } from './matchScoreDetail';

export type WithScoreDetail<T> = T & { scoreDetail: MatchScoreDetail | null };

export function attachParsedScoreDetail<T extends { score_detail_json?: string | null }>(
  row: T,
): WithScoreDetail<T> {
  return {
    ...row,
    scoreDetail: parseScoreDetailJson(row.score_detail_json ?? null),
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
