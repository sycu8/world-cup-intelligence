import type { AppEnv } from '../../env';
import { translateCommentaryLines, translateMatchRecapText } from '../../ai/translateMatchRecap';
import { isLikelyVietnamese } from '../../services/newsTranslationUtils';
import { nowIso } from '../../utils/time';
import { logInfo } from '../../utils/logger';
import type { FifaMatchInfo } from './fifaApiClient';
import { FIFA_SOURCE_ID } from './constants';
import { buildFifaRecapSummaryEn, recapInputFromFifaInfo } from './generateFifaRecapSummary';
import type { ParsedCommentaryLine } from './parseFifaTimeline';

export type FifaRecapTranslationState = {
  needsCommentary: boolean;
  needsRecap: boolean;
};

export async function loadFifaRecapTranslationState(
  db: D1Database,
  matchId: string,
): Promise<FifaRecapTranslationState> {
  const [commentaryRow, untranslatedRow, recapRow] = await Promise.all([
    db.prepare(`SELECT 1 FROM match_commentary WHERE match_id = ? LIMIT 1`).bind(matchId).first(),
    db
      .prepare(
        `SELECT 1 FROM match_commentary
         WHERE match_id = ? AND source_id = ? AND text_vi = text_en LIMIT 1`,
      )
      .bind(matchId, FIFA_SOURCE_ID)
      .first(),
    db
      .prepare(`SELECT summary_vi, summary_en FROM match_recaps WHERE match_id = ?`)
      .bind(matchId)
      .first<{ summary_vi: string; summary_en: string }>(),
  ]);

  const needsCommentary = !commentaryRow || !!untranslatedRow;
  const needsRecap =
    !recapRow || !isLikelyVietnamese(recapRow.summary_vi, recapRow.summary_en);

  return { needsCommentary, needsRecap };
}

async function loadPossession(
  db: D1Database,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
): Promise<{ home: number | null; away: number | null }> {
  const { results } = await db
    .prepare(`SELECT team_id, possession FROM team_match_stats WHERE match_id = ?`)
    .bind(matchId)
    .all<{ team_id: string; possession: number | null }>();
  const byTeam = new Map((results ?? []).map((r) => [r.team_id, r.possession]));
  return {
    home: byTeam.get(homeTeamId) ?? null,
    away: byTeam.get(awayTeamId) ?? null,
  };
}

export async function upsertTranslatedMatchRecap(
  env: AppEnv,
  matchId: string,
  info: FifaMatchInfo,
  commentary: ParsedCommentaryLine[],
  homeTeamId: string,
  awayTeamId: string,
): Promise<boolean> {
  if (commentary.length === 0) return false;

  const possession = await loadPossession(env.DB, matchId, homeTeamId, awayTeamId);
  const recapInput = recapInputFromFifaInfo(info, commentary, possession.home, possession.away);
  const summaryEn = buildFifaRecapSummaryEn(recapInput);
  if (!summaryEn.trim()) return false;

  const summaryVi = (await translateMatchRecapText(env, summaryEn, 900)) ?? summaryEn;
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO match_recaps (match_id, summary_vi, summary_en, source_id, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(match_id) DO UPDATE SET
       summary_vi = excluded.summary_vi,
       summary_en = excluded.summary_en,
       source_id = excluded.source_id,
       updated_at = excluded.updated_at`,
  )
    .bind(matchId, summaryVi, summaryEn, FIFA_SOURCE_ID, now)
    .run();

  logInfo('fifa match recap upserted', {
    match_id: matchId,
    vi: isLikelyVietnamese(summaryVi, summaryEn),
  });
  return true;
}

export async function translateAndStoreCommentary(
  env: AppEnv,
  matchId: string,
  lines: ParsedCommentaryLine[],
): Promise<number> {
  if (!lines.length) return 0;

  const textsEn = lines.map((l) => l.textEn);
  const textsVi = await translateCommentaryLines(env, textsEn);

  await env.DB.prepare(`DELETE FROM match_commentary WHERE match_id = ? AND source_id = ?`)
    .bind(matchId, FIFA_SOURCE_ID)
    .run();

  const stmts = lines.map((line, idx) =>
    env.DB.prepare(
      `INSERT INTO match_commentary (
         id, match_id, minute, period, sort_order, text_vi, text_en, event_type, source_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      line.id,
      matchId,
      line.minute,
      line.period,
      line.sortOrder,
      textsVi[idx] ?? line.textEn,
      line.textEn,
      line.eventType,
      FIFA_SOURCE_ID,
    ),
  );

  for (let i = 0; i < stmts.length; i += 40) {
    await env.DB.batch(stmts.slice(i, i + 40));
  }

  return lines.length;
}
