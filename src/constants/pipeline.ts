export const BULK_RECOMPUTE_KV_KEY = 'bulk_recompute_wc2026';
/** Last WC 2026 match id finished by the current bulk walk. */
export const BULK_RECOMPUTE_CURSOR_KEY = 'bulk_recompute_wc2026_cursor';
export const LAST_RECOMPUTE_META_KEY = 'meta:last_recompute_request';
export const NEWS_CRAWL_INTERVAL_SEC = 900;
export const LIVE_PROB_REFRESH_INTERVAL_SEC = 900;
export const NEWS_CRAWL_KV_KEY = 'meta:last_news_crawl';
/** Count of model-queue messages acked as stale. Readable from /api/health. */
export const MODEL_QUEUE_STALE_DROPS_KEY = 'meta:model_queue_stale_drops';
/** Count of ingest ticks acked as stale. Readable from /api/health. */
export const INGEST_STALE_DROPS_KEY = 'meta:ingest_stale_drops';
/** Epoch ms when the last starter refresh_minute was accepted. No TTL. */
export const INGEST_LAST_RUN_KEY = 'ingest:last_run:refresh_minute';
/** Matches skipped after repeated bulk-recompute budget cuts. Readable from /api/health. */
export const BULK_BUDGET_SKIPS_KEY = 'meta:bulk_recompute_budget_skips';
/** Set while a statsbomb chunk inserted rows, so the last chunk can schedule one walk. */
export const STATSBOMB_INGEST_DIRTY_KEY = 'meta:statsbomb_ingest_dirty';
export const NEWS_CRAWL_LOCK_KV_KEY = 'meta:news_crawl_lock';
