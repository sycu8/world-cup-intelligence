export type IngestJob =
  | { type: 'bulk_ingest'; idempotencyKey: string }
  | { type: 'source_ingest'; sourceId: string; idempotencyKey: string }
  | { type: 'refresh_minute'; idempotencyKey: string }
  | { type: 'crawl_news'; idempotencyKey: string }
  | { type: 'match_complete'; matchId: string; idempotencyKey: string };

export type ModelJob =
  | { type: 'recompute'; matchId: string }
  | { type: 'recompute_all'; matchIds: string[] }
  | { type: 'recompute_wc2026_bulk'; reason?: string }
  | { type: 'ai_briefing'; matchId: string }
  | { type: 'ai_multi_analyze'; matchId: string }
  | { type: 'ai_extract_news'; documentId: string; content?: string };
