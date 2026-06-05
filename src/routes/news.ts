import { Hono } from 'hono';
import type { AppEnv } from '../env';
import type { IngestJob } from '../queues/types';
import {
  compressAndStoreNewsImage,
  newsThumbnailR2Key,
  thumbNeedsRecompress,
} from '../services/newsImagePipeline';
import {
  backfillNewsThumbnails,
  recompressNewsThumbnails,
  resolveNewsThumbSourceUrl,
} from '../services/newsThumbnailBackfill';
import { backfillNewsTranslations, countUntranslatedNews, ensureNewsArticleTranslated, resolvePublisherLabel } from '../services/newsTranslation';
import { needsNewsTranslation } from '../services/newsTranslationUtils';
import { backfillNewsSources } from '../services/newsSourceBackfill';

export const newsRoutes = new Hono<{ Bindings: AppEnv }>();

const HOT_COUNT = 3;
const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 12;

type NewsRow = {
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

function resolveThumbnail(row: NewsRow): string | null {
  if (row.thumbnail_r2_key || row.thumbnail_url?.startsWith('/api/news/assets/')) {
    return `/api/news/assets/${row.id}`;
  }
  const ext = row.thumbnail_url?.trim();
  if (ext?.startsWith('http')) return ext;
  return ext ?? null;
}

async function translateRowsForList(env: AppEnv, rows: NewsRow[]): Promise<void> {
  await Promise.all(
    rows.map(async (row) => {
      if (!needsNewsTranslation(row)) return;
      const patched = await ensureNewsArticleTranslated(env, row);
      if (patched) {
        row.title_vi = patched.title_vi;
        row.summary_vi = patched.summary_vi;
      }
    }),
  );
}

function mapArticle(row: NewsRow) {
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

newsRoutes.get('/assets/:docId', async (c) => {
  const docId = c.req.param('docId');
  const r2Key = newsThumbnailR2Key(docId);

  let head = await c.env.R2_ARTIFACTS.head(r2Key);
  if (!head) {
    const row = await c.env.DB.prepare(
      'SELECT thumbnail_url FROM source_documents WHERE id = ?',
    )
      .bind(docId)
      .first<{ thumbnail_url: string | null }>();
    if (row?.thumbnail_url?.startsWith('http')) {
      return c.redirect(row.thumbnail_url, 302);
    }
    return c.json({ error: 'Not found' }, 404);
  }

  if (thumbNeedsRecompress(head.httpMetadata?.contentType, head.size)) {
    const sourceUrl = await resolveNewsThumbSourceUrl(c.env, docId);
    if (sourceUrl) {
      c.executionCtx.waitUntil(compressAndStoreNewsImage(c.env, docId, sourceUrl));
      const proxied = await fetch(sourceUrl, {
        headers: { 'User-Agent': 'wc-tactical-platform/1.0 (news-thumb)' },
        signal: AbortSignal.timeout(12_000),
        cf: { cacheTtl: 86400 },
      } as RequestInit);
      if (proxied.ok) {
        const headers = new Headers();
        headers.set(
          'Content-Type',
          proxied.headers.get('content-type') ?? 'image/jpeg',
        );
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(proxied.body, { headers });
      }
    }
  }

  const obj = await c.env.R2_ARTIFACTS.get(r2Key);
  if (!obj) return c.json({ error: 'Not found' }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(obj.body, { headers });
});

newsRoutes.get('/', async (c) => {
  const lastCrawl = await c.env.KV.get('meta:last_news_crawl');
  const lastThumbBackfill = await c.env.KV.get('meta:last_news_thumb_backfill');
  const lastThumbRecompress = await c.env.KV.get('meta:last_news_thumb_recompress');
  const lastSourceBackfill = await c.env.KV.get('meta:last_news_source_backfill');
  if (!lastSourceBackfill) {
    c.executionCtx.waitUntil(
      backfillNewsSources(c.env).then(() =>
        c.env.KV.put('meta:last_news_source_backfill', new Date().toISOString(), {
          expirationTtl: 86400,
        }),
      ),
    );
  }

  const untranslated = await c.env.KV.get('meta:news_untranslated_count');
  if (untranslated === null) {
    c.executionCtx.waitUntil(
      (async () => {
        const n = await countUntranslatedNews(c.env);
        await c.env.KV.put('meta:news_untranslated_count', String(n), { expirationTtl: 300 });
        if (n > 0) await backfillNewsTranslations(c.env, Math.min(15, n));
      })(),
    );
  } else if (Number(untranslated) > 0) {
    c.executionCtx.waitUntil(backfillNewsTranslations(c.env, Math.min(15, Number(untranslated))));
  }

  if (!lastThumbBackfill) {
    c.executionCtx.waitUntil(
      backfillNewsThumbnails(c.env, 40).then(() =>
        c.env.KV.put('meta:last_news_thumb_backfill', new Date().toISOString(), {
          expirationTtl: 3600,
        }),
      ),
    );
  }
  if (!lastThumbRecompress) {
    c.executionCtx.waitUntil(
      recompressNewsThumbnails(c.env, 25).then(() =>
        c.env.KV.put('meta:last_news_thumb_recompress', new Date().toISOString(), {
          expirationTtl: 3600,
        }),
      ),
    );
  }
  if (!lastCrawl && c.env.INGEST_QUEUE) {
    const job: IngestJob = { type: 'crawl_news', idempotencyKey: crypto.randomUUID() };
    await c.env.INGEST_QUEUE.send(job).catch(() => undefined);
  }

  const page = Math.max(1, Number(c.req.query('page') ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(6, Number(c.req.query('pageSize') ?? DEFAULT_PAGE_SIZE)),
  );
  const hotLimit = Math.min(5, Number(c.req.query('hot') ?? HOT_COUNT));
  const offset = (page - 1) * pageSize;

  const selectCols = `sd.id, sd.title, sd.title_vi, sd.source_url, sd.summary, sd.summary_vi,
            sd.published_at, sd.reliability_score, sd.thumbnail_url, sd.thumbnail_r2_key,
            sd.hot_score, sr.source_name`;

  const { results: hotRows } = await c.env.DB.prepare(
    `SELECT ${selectCols}
     FROM source_documents sd
     LEFT JOIN source_registry sr ON sr.id = sd.source_id
     ORDER BY COALESCE(sd.hot_score, sd.reliability_score) DESC, sd.published_at DESC
     LIMIT ?`,
  )
    .bind(hotLimit)
    .all<NewsRow>();

  const hotRowsList = hotRows ?? [];
  c.executionCtx.waitUntil(translateRowsForList(c.env, hotRowsList));
  const hot = hotRowsList.map(mapArticle);
  const hotIds = hot.map((h) => h.id);
  const placeholders = hotIds.length ? hotIds.map(() => '?').join(',') : "''";

  const countSql = hotIds.length
    ? `SELECT COUNT(*) AS n FROM source_documents WHERE id NOT IN (${placeholders})`
    : `SELECT COUNT(*) AS n FROM source_documents`;
  const countRow = await c.env.DB.prepare(countSql)
    .bind(...hotIds)
    .first<{ n: number }>();
  const total = Number(countRow?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const listSql = hotIds.length
    ? `SELECT ${selectCols}
       FROM source_documents sd
       LEFT JOIN source_registry sr ON sr.id = sd.source_id
       WHERE sd.id NOT IN (${placeholders})
       ORDER BY sd.published_at DESC, sd.created_at DESC
       LIMIT ? OFFSET ?`
    : `SELECT ${selectCols}
       FROM source_documents sd
       LEFT JOIN source_registry sr ON sr.id = sd.source_id
       ORDER BY sd.published_at DESC, sd.created_at DESC
       LIMIT ? OFFSET ?`;

  const { results: pageRows } = await c.env.DB.prepare(listSql)
    .bind(...hotIds, pageSize, offset)
    .all<NewsRow>();

  const pageRowsList = pageRows ?? [];
  if (page === 1) {
    c.executionCtx.waitUntil(translateRowsForList(c.env, pageRowsList));
  }

  return c.json(
    {
      data: {
        hot,
        articles: pageRowsList.map(mapArticle),
      },
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hotCount: hot.length,
        lastCrawl,
        crawlIntervalSec: 900,
        cdnAssets: true,
      },
    },
    200,
    { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  );
});

newsRoutes.get('/:docId', async (c) => {
  const docId = c.req.param('docId');
  if (docId === 'assets') return c.notFound();

  const selectCols = `sd.id, sd.title, sd.title_vi, sd.source_url, sd.summary, sd.summary_vi,
            sd.published_at, sd.reliability_score, sd.thumbnail_url, sd.thumbnail_r2_key,
            sd.hot_score, sr.source_name`;

  const row = await c.env.DB.prepare(
    `SELECT ${selectCols}
     FROM source_documents sd
     LEFT JOIN source_registry sr ON sr.id = sd.source_id
     WHERE sd.id = ?`,
  )
    .bind(docId)
    .first<NewsRow>();

  if (!row) return c.json({ error: 'Not found' }, 404);

  const patched = await ensureNewsArticleTranslated(c.env, row);
  if (patched) {
    row.title_vi = patched.title_vi;
    row.summary_vi = patched.summary_vi;
  }

  return c.json({ data: mapArticle(row) });
});
