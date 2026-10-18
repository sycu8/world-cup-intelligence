export type IngestJob =
  | {
      type: 'bulk_ingest';
      idempotencyKey: string;
      stage?: 'statsbomb' | 'news';
      seasonCursor?: number;
      feedCursor?: number;
    }
  | { type: 'source_ingest'; sourceId: string; idempotencyKey: string; seasonCursor?: number }
  | { type: 'refresh_minute'; idempotencyKey: string }
  | { type: 'crawl_news'; idempotencyKey: string; feedCursor?: number }
  | { type: 'match_complete'; matchId: string; idempotencyKey: string }
  | { type: 'refresh_live_probabilities'; idempotencyKey: string }
  | { type: 'sync_leagues'; idempotencyKey: string; leagueCursor?: number }
  | { type: 'webhook_deliver'; subscriptionId: string; eventId: number; idempotencyKey: string };

export type ModelJob =
  | { type: 'recompute'; matchId: string }
  | { type: 'recompute_all'; matchIds: string[] }
  | {
      type: 'recompute_wc2026_bulk';
      reason?: string;
      /** Identifies the walk. A continuation drops when this is not the current lease. */
      walkId?: string;
      /** Last match id already finished. The next invocation starts after it. */
      cursor?: string;
      /** `champion` only refreshes odds. Match chunks omit it. */
      phase?: 'matches' | 'champion';
    }
  | { type: 'PRE_MATCH_RECOMPUTE'; matchId: string }
  | { type: 'LIVE_RECOMPUTE'; matchId: string; eventId?: string }
  | { type: 'SCENARIO_GENERATE'; matchId: string }
  | { type: 'SCENARIO_RECOMPUTE'; matchId: string; eventId?: string }
  | { type: 'SCENARIO_BACKTEST'; tournamentYear: number }
  | { type: 'ai_briefing'; matchId: string }
  | { type: 'ai_multi_analyze'; matchId: string }
  | { type: 'ai_extract_news'; documentId: string; content?: string };
