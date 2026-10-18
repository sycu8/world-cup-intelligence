import type { AppEnv } from '../env';
import { parseEnv } from '../env';
import { logError, logInfo } from '../utils/logger';
import type { AiTask } from './modelRouter';
import { resolveModel, WORKERS_AI_FALLBACK } from './modelRouter';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type GatewayChatResult = {
  content: string;
  model: string;
  provider: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

function gatewayBaseUrl(env: AppEnv): string | null {
  const cfg = parseEnv(env);
  if (!cfg.aiGatewayEnabled || !cfg.aiGatewayAccountId) return null;
  const gatewayId = cfg.aiGatewayId || 'default';
  return `https://gateway.ai.cloudflare.com/v1/${cfg.aiGatewayAccountId}/${gatewayId}/compat/chat/completions`;
}

function buildHeaders(env: AppEnv, useOpenAiKey: boolean): HeadersInit {
  const cfg = parseEnv(env);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useOpenAiKey && cfg.openaiApiKey) {
    headers.Authorization = `Bearer ${cfg.openaiApiKey}`;
  } else if (cfg.cfAigToken) {
    headers.Authorization = `Bearer ${cfg.cfAigToken}`;
  }
  if (cfg.cfAigToken && cfg.openaiApiKey) {
    headers['cf-aig-authorization'] = `Bearer ${cfg.cfAigToken}`;
  }
  return headers;
}

export function isGatewayConfigured(env: AppEnv): boolean {
  const cfg = parseEnv(env);
  return cfg.aiGatewayEnabled && !!cfg.aiGatewayAccountId && !!(cfg.openaiApiKey || cfg.cfAigToken);
}

export async function gatewayChat(
  env: AppEnv,
  task: AiTask,
  messages: ChatMessage[],
  options?: { jsonMode?: boolean; preferEconomy?: boolean },
): Promise<GatewayChatResult | null> {
  const url = gatewayBaseUrl(env);
  if (!url) return null;

  const modelCfg = resolveModel(task, options?.preferEconomy);
  let model = modelCfg.providerModel;

  const cfg = parseEnv(env);
  const useOpenAi = model.startsWith('openai/') && !!cfg.openaiApiKey;
  if (model.startsWith('openai/') && !cfg.openaiApiKey && cfg.cfAigToken) {
    model = WORKERS_AI_FALLBACK;
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: modelCfg.maxTokens,
    temperature: modelCfg.temperature,
  };
  if (modelCfg.reasoningEffort && model.includes('gpt-5.5')) {
    body.reasoning_effort = modelCfg.reasoningEffort;
  }
  if (options?.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(env, useOpenAi || model.startsWith('openai/')),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      logError('ai gateway error', { task, status: res.status, detail: errText.slice(0, 200) });
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
      usage?: GatewayChatResult['usage'];
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    const provider = model.split('/')[0]!;

    await env.KV.put(
      `ai:usage:${task}:${Date.now()}`,
      JSON.stringify({ model, provider, usage: data.usage, ts: new Date().toISOString() }),
      { expirationTtl: 86400 * 7 },
    );

    logInfo('ai gateway success', { task, model, provider });
    return { content, model, provider, usage: data.usage };
  } catch (e) {
    logError('ai gateway fetch failed', { task, error: String(e) });
    return null;
  }
}

export async function gatewayChatJson<T>(
  env: AppEnv,
  task: AiTask,
  messages: ChatMessage[],
): Promise<T | null> {
  const result = await gatewayChat(env, task, messages, { jsonMode: true });
  if (!result?.content) return null;
  try {
    const cleaned = result.content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
