import type { AppEnv } from '../env';
import { resolvePublisherLabel } from './newsTranslation';
import { needsNewsTranslation } from './newsTranslationUtils';

export type NewsRow = {
  id: string;
  title: string;
  title_vi: string | null;
  source_url: string;
  summary: string;
  summary_vi: string | null;
  published_at: string;
  reliability_score: number;
  source_name?: string;
  thumbnail_url?: string | null;
  thumbnail_r2_key?: string | null;
  hot_score?: number;
};

const SELECT_COLS = `sd.id, sd.title, sd.title_vi, sd.source_url, sd.summary, sd.summary_vi,
  sd.published_at, sd.reliability_score, sd.thumbnail_url, sd.thumbnail_r2_key,
  sd.hot_score, sr.source_name`;

function resolveThumbnail(row: NewsRow): string | null {
  if (row.thumbnail_r2_key || row.thumbnail_url?.startsWith('/api/news/assets/')) {
    return `/api/news/assets/${row.id}`;
  }
  const ext = row.thumbnail_url?.trim();
  if (ext?.startsWith('http')) return ext;
  return ext ?? null;
}

export function mapNewsArticle(row: NewsRow) {
  const thumb = resolveThumbnail(row);
  const doc = {
    id: row.id,
    title: row.title,
    summary: row.summary,
    title_vi: row.title_vi,
    summary_vi: row.summary_vi,
  };
  const translated = !needsNewsTranslation(doc);
  const titleVi = row.title_vi?.trim() || null;
  const summaryVi = row.summary_vi?.trim() || null;
  return {
    id: row.id,
    title: translated && titleVi ? titleVi : row.title,
    titleEn: row.title,
    titleVi: translated && titleVi ? titleVi : undefined,
    source_url: row.source_url,
    summary: translated && summaryVi ? summaryVi : row.summary,
    summaryEn: row.summary,
    summaryVi: translated && summaryVi ? summaryVi : undefined,
    published_at: row.published_at,
    reliability_score: row.reliability_score,
    source_name: resolvePublisherLabel(row),
    thumbnail_url: thumb,
    hot_score: row.hot_score ?? row.reliability_score,
    translated,
  };
}

export async function fetchHotNewsArticles(env: AppEnv, limit = 3) {
  const { results } = await env.DB.prepare(
    `SELECT ${SELECT_COLS}
     FROM source_documents sd
     LEFT JOIN source_registry sr ON sr.id = sd.source_id
     ORDER BY COALESCE(sd.hot_score, sd.reliability_score) DESC, sd.published_at DESC
     LIMIT ?`,
  )
    .bind(limit)
    .all<NewsRow>();

  return (results ?? []).map(mapNewsArticle);
}
