export type AppEnv = {
  ENVIRONMENT: string;
  MOCK_SOURCES: string;
  FIFA_LIVE_ENABLED?: string;
  AI_FALLBACK_MODE: string;
  VECTORIZE_FALLBACK_MODE: string;
  AI_GATEWAY_ENABLED?: string;
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  /** Hard ceiling for Workers AI calls inside one queue message. */
  AI_CALLS_PER_RUN?: string;
  /** Hard ceiling for Workers AI calls in the current minute. */
  AI_CALLS_PER_MINUTE?: string;
  OPENAI_API_KEY?: string;
  CF_AIG_TOKEN?: string;
  ADMIN_TOKEN?: string;
  PUBLIC_API_REQUIRE_KEY?: string;
  CORS_ORIGINS: string;
  DB: D1Database;
  KV: KVNamespace;
  R2_RAW: R2Bucket;
  R2_SNAPSHOTS: R2Bucket;
  R2_ARTIFACTS: R2Bucket;
  AI?: Ai;
  VECTOR_INDEX?: VectorizeIndex;
  INGEST_QUEUE?: Queue;
  MODEL_QUEUE?: Queue;
  MATCH_ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
};

export function parseEnv(env: AppEnv) {
  return {
    environment: env.ENVIRONMENT ?? 'development',
    mockSources: env.MOCK_SOURCES === 'true',
    fifaLiveEnabled: env.FIFA_LIVE_ENABLED === 'true',
    aiFallback: env.AI_FALLBACK_MODE !== 'false',
    vectorizeFallback: env.VECTORIZE_FALLBACK_MODE !== 'false',
    aiGatewayEnabled: env.AI_GATEWAY_ENABLED === 'true',
    aiGatewayAccountId: env.AI_GATEWAY_ACCOUNT_ID ?? '',
    aiGatewayId: env.AI_GATEWAY_ID ?? 'wc-tactical',
    openaiApiKey: env.OPENAI_API_KEY,
    cfAigToken: env.CF_AIG_TOKEN,
    adminToken: env.ADMIN_TOKEN,
    publicApiRequireKey: env.PUBLIC_API_REQUIRE_KEY === 'true',
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}
