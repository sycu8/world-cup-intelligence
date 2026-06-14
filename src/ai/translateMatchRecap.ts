import type { AppEnv } from '../env';
import { gatewayChatJson, isGatewayConfigured } from './gatewayClient';
import { isLikelyVietnamese } from '../services/newsTranslationUtils';
import { logError, logInfo } from '../utils/logger';

const SYSTEM =
  'You translate FIFA World Cup match commentary and summaries into natural Vietnamese. Output JSON only. Use proper Vietnamese diacritics. Keep team and player names recognizable. Do not invent facts beyond the source text.';

function isAcceptableTranslation(vi: string, en: string): boolean {
  const value = vi.trim();
  const source = en.trim();
  if (!value || value.length < 2) return false;
  if (value.toLowerCase() === source.toLowerCase()) return false;
  if (isLikelyVietnamese(value, source)) return true;
  return value.length >= 6 && value.toLowerCase() !== source.toLowerCase();
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

async function workersAiTranslateLine(env: AppEnv, textEn: string, maxLen: number): Promise<string | null> {
  if (!env.AI || !textEn.trim()) return null;
  const models = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3-8b-instruct'] as const;
  const prompt = `Dịch câu tường thuật bóng đá sau sang tiếng Việt tự nhiên (giữ tên đội/cầu thủ):\n${textEn.slice(0, 600)}\n\nJSON: { "textVi": "..." }`;

  for (const model of models) {
    try {
      const response = await env.AI.run(model, {
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
      });
      const raw =
        typeof response === 'object' && response && 'response' in response
          ? String((response as { response: string }).response)
          : JSON.stringify(response);
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1) continue;
      const parsed = JSON.parse(raw.slice(start, end + 1)) as { textVi?: string };
      const textVi = parsed.textVi?.trim().slice(0, maxLen);
      if (textVi && isAcceptableTranslation(textVi, textEn)) return textVi;
    } catch {
      /* try next model */
    }
  }
  return null;
}

/** Translate a single FIFA commentary line or recap sentence to Vietnamese. */
export async function translateMatchRecapText(
  env: AppEnv,
  textEn: string,
  maxLen = 520,
): Promise<string | null> {
  const source = textEn.trim();
  if (!source) return null;
  if (isLikelyVietnamese(source)) return source.slice(0, maxLen);

  const viaM2m = await m2m100Translate(env, source, maxLen);
  if (viaM2m) return viaM2m;

  const viaWorkers = await workersAiTranslateLine(env, source, maxLen);
  if (viaWorkers) return viaWorkers;

  if (isGatewayConfigured(env)) {
    try {
      const parsed = await gatewayChatJson<{ textVi: string }>(env, 'news_summary', [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `Dịch sang tiếng Việt:\n${source.slice(0, 600)}\n\nJSON: { "textVi": "..." }`,
        },
      ]);
      const textVi = parsed?.textVi?.trim().slice(0, maxLen);
      if (textVi && isAcceptableTranslation(textVi, source)) return textVi;
    } catch {
      /* fall through */
    }
  }

  return null;
}

const COMMENTARY_TRANSLATE_CONCURRENCY = 8;

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

/** Translate commentary lines in parallel; reuse cached Vietnamese when provided. */
export async function translateCommentaryLines(
  env: AppEnv,
  linesEn: string[],
  existingVi?: (string | null | undefined)[],
): Promise<string[]> {
  const out = await mapConcurrent(linesEn, COMMENTARY_TRANSLATE_CONCURRENCY, async (line, i) => {
    const cached = existingVi?.[i]?.trim();
    if (cached && isLikelyVietnamese(cached, line)) return cached;
    return (await translateMatchRecapText(env, line, 480)) ?? line;
  });
  if (out.some((vi, i) => vi !== linesEn[i] && isLikelyVietnamese(vi, linesEn[i]))) {
    logInfo('fifa commentary translated to Vietnamese', { lines: out.length });
  }
  return out;
}
