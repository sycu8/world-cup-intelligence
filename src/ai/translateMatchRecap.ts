import type { AppEnv } from '../env';
import { gatewayChatJson, isGatewayConfigured } from './gatewayClient';
import {
  COMMENTATOR_SYSTEM,
  commentaryUserPrompt,
  needsBroadcastStyleRefresh,
  SUMMARY_USER_PROMPT,
} from './matchRecapStyle';
import { isLikelyVietnamese } from '../services/newsTranslationUtils';
import { logError, logInfo } from '../utils/logger';

export type CommentaryTranslateInput = {
  textEn: string;
  eventType: string | null;
  minute: number | null;
};

function isAcceptableTranslation(vi: string, en: string): boolean {
  const value = vi.trim();
  const source = en.trim();
  if (!value || value.length < 2) return false;
  if (value.toLowerCase() === source.toLowerCase()) return false;
  if (needsBroadcastStyleRefresh(value, source)) return false;
  if (isLikelyVietnamese(value, source)) return true;
  return value.length >= 8 && value.toLowerCase() !== source.toLowerCase();
}

function parseTextViJson(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { textVi?: string };
    return parsed.textVi?.trim() ?? null;
  } catch {
    return null;
  }
}

async function workersAiTranslate(
  env: AppEnv,
  userPrompt: string,
  textEn: string,
  maxLen: number,
): Promise<string | null> {
  if (!env.AI || !textEn.trim()) return null;
  const models = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3-8b-instruct'] as const;

  for (const model of models) {
    try {
      const response = await env.AI.run(model, {
        messages: [
          { role: 'system', content: COMMENTATOR_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
      });
      const raw =
        typeof response === 'object' && response && 'response' in response
          ? String((response as { response: string }).response)
          : JSON.stringify(response);
      const textVi = parseTextViJson(raw)?.slice(0, maxLen);
      if (textVi && isAcceptableTranslation(textVi, textEn)) return textVi;
    } catch {
      /* try next model */
    }
  }
  return null;
}

async function m2m100Translate(env: AppEnv, text: string, maxLen: number): Promise<string | null> {
  if (!env.AI || !text.trim()) return null;
  try {
    const response = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: text.slice(0, Math.min(text.length, 900)),
      source_lang: 'en',
      target_lang: 'vi',
    });
    const translated =
      typeof response === 'object' && response && 'translated_text' in response
        ? String((response as { translated_text: string }).translated_text).trim()
        : '';
    if (!translated || !isAcceptableTranslation(translated, text)) return null;
    return translated.slice(0, maxLen);
  } catch (e) {
    logError('m2m100 match recap translate failed', { error: String(e).slice(0, 120) });
    return null;
  }
}

async function gatewayTranslate(env: AppEnv, userPrompt: string, textEn: string, maxLen: number): Promise<string | null> {
  if (!isGatewayConfigured(env)) return null;
  try {
    const parsed = await gatewayChatJson<{ textVi: string }>(env, 'news_summary', [
      { role: 'system', content: COMMENTATOR_SYSTEM },
      { role: 'user', content: userPrompt },
    ]);
    const textVi = parsed?.textVi?.trim().slice(0, maxLen);
    if (textVi && isAcceptableTranslation(textVi, textEn)) return textVi;
  } catch {
    /* fall through */
  }
  return null;
}

/** Translate match recap summary into broadcast-style Vietnamese. */
export async function translateMatchRecapSummary(
  env: AppEnv,
  summaryEn: string,
  maxLen = 900,
): Promise<string | null> {
  const source = summaryEn.trim();
  if (!source) return null;
  if (isLikelyVietnamese(source) && !needsBroadcastStyleRefresh(source)) return source.slice(0, maxLen);

  const prompt = SUMMARY_USER_PROMPT(source);
  const viaWorkers = await workersAiTranslate(env, prompt, source, maxLen);
  if (viaWorkers) return viaWorkers;

  const viaGateway = await gatewayTranslate(env, prompt, source, maxLen);
  if (viaGateway) return viaGateway;

  const viaM2m = await m2m100Translate(env, source, maxLen);
  if (viaM2m) return viaM2m;

  return null;
}

/** Translate a single FIFA commentary line into broadcast Vietnamese. */
export async function translateMatchRecapText(
  env: AppEnv,
  textEn: string,
  maxLen = 520,
  eventType: string | null = null,
  minute: number | null = null,
): Promise<string | null> {
  const source = textEn.trim();
  if (!source) return null;
  if (isLikelyVietnamese(source) && !needsBroadcastStyleRefresh(source)) return source.slice(0, maxLen);

  const prompt = commentaryUserPrompt(source, eventType, minute);

  const viaWorkers = await workersAiTranslate(env, prompt, source, maxLen);
  if (viaWorkers) return viaWorkers;

  const viaGateway = await gatewayTranslate(env, prompt, source, maxLen);
  if (viaGateway) return viaGateway;

  const viaM2m = await m2m100Translate(env, source, maxLen);
  if (viaM2m) return viaM2m;

  return null;
}

const COMMENTARY_TRANSLATE_CONCURRENCY = 6;

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Translate commentary lines in parallel; reuse cached broadcast Vietnamese when good enough. */
export async function translateCommentaryLines(
  env: AppEnv,
  lines: CommentaryTranslateInput[],
  existingVi?: (string | null | undefined)[],
): Promise<string[]> {
  const out = await mapConcurrent(lines, COMMENTARY_TRANSLATE_CONCURRENCY, async (line, i) => {
    const cached = existingVi?.[i]?.trim();
    if (cached && isLikelyVietnamese(cached, line.textEn) && !needsBroadcastStyleRefresh(cached, line.textEn)) {
      return cached;
    }
    return (
      (await translateMatchRecapText(env, line.textEn, 480, line.eventType, line.minute)) ?? line.textEn
    );
  });
  if (out.some((vi, i) => vi !== lines[i].textEn && isLikelyVietnamese(vi, lines[i].textEn))) {
    logInfo('fifa commentary translated to Vietnamese', { lines: out.length });
  }
  return out;
}
