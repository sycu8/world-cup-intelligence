import type { AppEnv } from '../env';
import { gatewayChatJson, isGatewayConfigured } from './gatewayClient';
import { resolveModel, WORKERS_AI_TEXT_MODEL } from './modelRouter';
import { isLikelyVietnamese } from '../services/newsTranslationUtils';
import { logError, logInfo } from '../utils/logger';

export type NewsTranslation = {
  titleVi: string;
  summaryVi: string;
};

type TranslationResponse = {
  titleVi: string;
  summaryVi: string;
};

const SYSTEM =
  'You translate football news into natural Vietnamese for Vietnamese readers. Output JSON only. Use proper Vietnamese diacritics. Keep proper nouns (team names, players, FIFA, World Cup). Do not invent facts beyond the source text.';

const USER_PROMPT = (title: string, summary: string) =>
  `Dịch sang tiếng Việt tự nhiên. Viết tóm tắt 3–5 câu (tối đa 420 ký tự).

Title: ${title.slice(0, 300)}
Source text: ${summary.slice(0, 800)}

JSON: { "titleVi": "...", "summaryVi": "..." }`;

function parseTranslationJson(text: string): TranslationResponse | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1)) as TranslationResponse;
  } catch {
    return null;
  }
}

/** Accept if clearly not a copy of the English source. */
function isAcceptableTranslation(vi: string, en: string): boolean {
  const value = vi.trim();
  const source = en.trim();
  if (!value || value.length < 3) return false;
  if (value.toLowerCase() === source.toLowerCase()) return false;
  if (isLikelyVietnamese(value, source)) return true;
  // m2m100 / short headlines may lack diacritics when many proper nouns — allow if meaningfully different
  return value.length >= 8 && value.toLowerCase() !== source.toLowerCase();
}

function normalizeTranslation(
  parsed: TranslationResponse,
  title: string,
  summary: string,
): NewsTranslation | null {
  const titleVi = parsed.titleVi?.trim().slice(0, 320);
  const summaryVi = (parsed.summaryVi ?? summary).trim().slice(0, 520);
  if (!titleVi || !summaryVi) return null;
  if (!isAcceptableTranslation(titleVi, title)) return null;
  if (!isAcceptableTranslation(summaryVi, summary) && !isLikelyVietnamese(summaryVi, summary)) {
    return null;
  }
  return { titleVi, summaryVi };
}

/** Cloudflare dedicated EN→VI model — works without OpenAI key. */
async function m2m100Translate(env: AppEnv, text: string, maxLen: number): Promise<string | null> {
  if (!env.AI || !text.trim()) return null;
  try {
    const response = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: text.slice(0, maxLen === 320 ? 400 : 900),
      source_lang: 'en',
      target_lang: 'vi',
    });
    const translated =
      typeof response === 'object' && response && 'translated_text' in response
        ? String((response as { translated_text: string }).translated_text).trim()
        : '';
    if (!translated) return null;
    return translated.slice(0, maxLen);
  } catch (e) {
    logError('m2m100 translate failed', { error: String(e).slice(0, 120) });
    return null;
  }
}

async function workersAiTranslate(
  env: AppEnv,
  title: string,
  summary: string,
): Promise<NewsTranslation | null> {
  if (!env.AI) return null;
  const models = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', WORKERS_AI_TEXT_MODEL] as const;

  for (const model of models) {
    try {
      const response = await env.AI.run(model, {
        max_tokens: resolveModel('news_summary').maxTokens,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: USER_PROMPT(title, summary) },
        ],
      });
      const text =
        typeof response === 'object' && response && 'response' in response
          ? String((response as { response: string }).response)
          : JSON.stringify(response);
      const parsed = parseTranslationJson(text);
      if (parsed) {
        const normalized = normalizeTranslation(parsed, title, summary);
        if (normalized) return normalized;
      }
    } catch {
      /* try next model */
    }
  }
  return null;
}

async function m2m100NewsTranslation(
  env: AppEnv,
  title: string,
  summary: string,
): Promise<NewsTranslation | null> {
  const [titleVi, summaryVi] = await Promise.all([
    m2m100Translate(env, title, 320),
    m2m100Translate(env, summary, 520),
  ]);
  if (!titleVi || !summaryVi) return null;
  if (!isAcceptableTranslation(titleVi, title)) return null;
  if (!isAcceptableTranslation(summaryVi, summary)) return null;
  logInfo('news translated via m2m100', { title_len: titleVi.length });
  return { titleVi, summaryVi };
}

export async function translateNewsHeadline(
  env: AppEnv,
  title: string,
  summary: string,
): Promise<NewsTranslation | null> {
  if (!title.trim()) return null;

  const viaM2m = await m2m100NewsTranslation(env, title, summary);
  if (viaM2m) return viaM2m;

  const viaWorkers = await workersAiTranslate(env, title, summary);
  if (viaWorkers) return viaWorkers;

  if (isGatewayConfigured(env)) {
    try {
      const parsed = await gatewayChatJson<TranslationResponse>(env, 'news_summary', [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: USER_PROMPT(title, summary) },
      ]);
      if (parsed) {
        const normalized = normalizeTranslation(parsed, title, summary);
        if (normalized) return normalized;
      }
    } catch {
      /* already tried Workers AI */
    }
  }

  logError('news translation exhausted all providers', { title: title.slice(0, 60) });
  return null;
}
