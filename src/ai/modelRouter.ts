/**
 * Model routing via Cloudflare AI Gateway compat API.
 * GPT-5.5 with reasoning effort (Thinking) for synthesis; lighter effort for extraction.
 */
export type AiTask =
  | 'entity_extract'
  | 'news_summary'
  | 'probability_explain'
  | 'tactical_briefing'
  | 'multi_variable_synthesis';

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

export type GatewayModelConfig = {
  providerModel: string;
  maxTokens: number;
  temperature: number;
  tier: 'economy' | 'standard' | 'premium';
  reasoningEffort?: ReasoningEffort;
};

const GPT55 = 'openai/gpt-5.5';

const ROUTING: Record<AiTask, GatewayModelConfig> = {
  entity_extract: {
    providerModel: GPT55,
    maxTokens: 800,
    temperature: 0.1,
    tier: 'economy',
    reasoningEffort: 'low',
  },
  news_summary: {
    providerModel: GPT55,
    maxTokens: 500,
    temperature: 0.2,
    tier: 'economy',
    reasoningEffort: 'low',
  },
  probability_explain: {
    providerModel: GPT55,
    maxTokens: 600,
    temperature: 0.2,
    tier: 'economy',
    reasoningEffort: 'low',
  },
  tactical_briefing: {
    providerModel: GPT55,
    maxTokens: 2000,
    temperature: 0.35,
    tier: 'standard',
    reasoningEffort: 'medium',
  },
  multi_variable_synthesis: {
    providerModel: GPT55,
    maxTokens: 2500,
    temperature: 0.3,
    tier: 'premium',
    reasoningEffort: 'high',
  },
};

/** Free fallback when OpenAI unavailable */
export const WORKERS_AI_FALLBACK = 'workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/**
 * Text model for direct `env.AI.run` calls.
 * Replaces the Llama 3 8B instruct model retired on 2026-05-30.
 * The 8B `-fast` slug is unavailable in the live catalog. This FP8 model
 * keeps the same `{ response }` chat API. Callers must pass `max_tokens`;
 * the catalog default is 256.
 */
export const WORKERS_AI_TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8' as const;

export function resolveModel(task: AiTask, preferEconomy = false): GatewayModelConfig {
  const cfg = ROUTING[task];
  if (preferEconomy && cfg.tier !== 'economy') {
    return { ...ROUTING.entity_extract };
  }
  return cfg;
}

export function listRoutingTable(): Array<{ task: AiTask } & GatewayModelConfig> {
  return (Object.keys(ROUTING) as AiTask[]).map((task) => ({ task, ...ROUTING[task] }));
}
