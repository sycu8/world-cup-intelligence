import type { AppEnv } from '../env';
import { guardedAiRun } from './aiCallGuard';
import { TacticalBriefingSchema, type TacticalBriefing } from './schemas';
import { nowIso } from '../utils/time';
import { isGatewayConfigured, gatewayChatJson } from './gatewayClient';
import { WORKERS_AI_BRIEFING_MAX_TOKENS, WORKERS_AI_TEXT_MODEL } from './modelRouter';
import { SYSTEM_NO_INVENT_NUMBERS, TACTICAL_BRIEFING_RESPONSE_FORMAT, tacticalBriefingPrompt } from './prompts';
import { logAiCallFailure, logInfo } from '../utils/logger';
import { extractJsonObject, workersAiResultText } from './workersAiText';
import { alignBriefingPercentages } from './briefingNumbers';
import { briefingHasContent, parseModelBriefing } from './coerceBriefing';

/** One observed call finished at 60.1s, so the cap sits above that. */
export const BRIEFING_AI_TIMEOUT_MS = 120_000;

const withheldFromCache = new WeakSet<object>();

/** Incomplete model output is returned as the statistical draft and not stored. */
export function briefingWithheldFromCache(briefing: object): boolean {
  return withheldFromCache.has(briefing);
}

const BRIEFING_CACHE_PREFIX = 'briefing:vi3:';
const BRIEFING_CACHE_TTL_SECONDS = 3600;
/** KV minimum TTL. An AI failure must not pin the statistical fallback for an hour. */
export const BRIEFING_AI_FAILURE_TTL_SECONDS = 60;

type BriefingInput = {
  matchId: string;
  probability: Record<string, unknown>;
  aiFallback: boolean;
};

function loc(vi: string, en: string) {
  return { vi, en };
}

export function fallbackBriefing(input: BriefingInput): TacticalBriefing {
  const p = input.probability as {
    homeWinProb?: number;
    drawProb?: number;
    awayWinProb?: number;
    expectedHomeGoals?: number;
    expectedAwayGoals?: number;
  };
  const hw = ((p.homeWinProb ?? 0) * 100).toFixed(1);
  const dr = ((p.drawProb ?? 0) * 100).toFixed(1);
  const aw = ((p.awayWinProb ?? 0) * 100).toFixed(1);
  const xgH = (p.expectedHomeGoals ?? 0).toFixed(2);
  const xgA = (p.expectedAwayGoals ?? 0).toFixed(2);

  return {
    matchId: input.matchId,
    generatedAt: nowIso(),
    summary: loc(
      'Phân tích chiến thuật từ mô hình thống kê. Số liệu xác suất do mô hình tính — không phải lời khuyên cá cược.',
      'Tactical analysis from the statistical model. Probabilities are engine-derived — not betting advice.',
    ),
    tacticalThemes: [
      {
        title: loc('Cân bằng tập thể', 'Collective balance'),
        detail: loc(
          'Mô hình kết hợp Elo, hồ sơ xG, pressing và độ compact phòng ngự.',
          'Model blends Elo, xG profile, pressing, and defensive compactness.',
        ),
        confidence: 0.75,
        supportingSources: ['doc-1'],
      },
    ],
    collectiveTeamFactors: [],
    lineupRisks: [],
    keyPlayers: [],
    probabilityExplanation: [
      loc(
        `Xác suất: thắng chủ nhà ${hw}% — hòa ${dr}% — thắng khách ${aw}%.`,
        `Probabilities: home win ${hw}% — draw ${dr}% — away win ${aw}%.`,
      ),
      loc(
        `Bàn kỳ vọng (xG): ${xgH} – ${xgA}.`,
        `Expected goals (xG): ${xgH} – ${xgA}.`,
      ),
      loc(
        'Các con số trên chỉ lấy từ mô hình thống kê.',
        'Figures above come from the statistical engine only.',
      ),
    ],
    uncertaintyNotes: [
      loc(
        'Đội hình và chấn thương trước giờ bóng lăn có thể làm xác suất thay đổi.',
        'Lineups and injuries before kickoff may shift probabilities.',
      ),
    ],
    citations: [
      {
        sourceDocumentId: 'platform-model',
        title: 'Tactical preview',
        sourceName: 'PitchIntel',
        reliabilityScore: 0.75,
      },
    ],
  };
}

export async function getCachedBriefing(
  env: AppEnv,
  matchId: string,
): Promise<TacticalBriefing | null> {
  const raw = await env.KV.get(`${BRIEFING_CACHE_PREFIX}${matchId}`);
  if (!raw) return null;
  try {
    return TacticalBriefingSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function generateTacticalBriefing(
  env: AppEnv,
  input: BriefingInput,
  options?: { signal?: AbortSignal },
): Promise<TacticalBriefing> {
  const cached = await getCachedBriefing(env, input.matchId);
  if (cached) return cached;

  let aiFailed = false;
  let withholdCache = false;

  if (isGatewayConfigured(env) && !input.aiFallback) {
    const started = Date.now();
    logInfo('tactical briefing gateway start', { matchId: input.matchId, model: 'gateway' });
    try {
      const parsed = await gatewayChatJson<TacticalBriefing>(env, 'tactical_briefing', [
        { role: 'system', content: SYSTEM_NO_INVENT_NUMBERS },
        { role: 'user', content: tacticalBriefingPrompt(input.matchId, input.probability) },
      ]);
      logInfo('tactical briefing gateway done', {
        matchId: input.matchId,
        model: 'gateway',
        durationMs: Date.now() - started,
      });
      if (parsed) {
        if (!briefingHasContent(parsed)) {
          withholdCache = true;
          throw new Error('briefing missing summary or takeaway');
        }
        withholdCache = false;
        const briefing = alignBriefingPercentages(parseModelBriefing(parsed, input.matchId), input.probability);
        await env.KV.put(`${BRIEFING_CACHE_PREFIX}${input.matchId}`, JSON.stringify(briefing), {
          expirationTtl: BRIEFING_CACHE_TTL_SECONDS,
        });
        return briefing;
      }
    } catch (error) {
      aiFailed = true;
      logAiCallFailure('tactical briefing gateway failed', error, {
        matchId: input.matchId,
        model: 'gateway',
        durationMs: Date.now() - started,
      });
    }
  }

  if (env.AI && !input.aiFallback) {
    const started = Date.now();
    logInfo('tactical briefing workers ai start', {
      matchId: input.matchId,
      model: WORKERS_AI_TEXT_MODEL,
    });
    try {
      const response = await guardedAiRun(
        env,
        WORKERS_AI_TEXT_MODEL,
        {
          max_tokens: WORKERS_AI_BRIEFING_MAX_TOKENS,
          response_format: TACTICAL_BRIEFING_RESPONSE_FORMAT,
          messages: [
            { role: 'system', content: SYSTEM_NO_INVENT_NUMBERS },
            {
              role: 'user',
              content: tacticalBriefingPrompt(input.matchId, input.probability),
            },
          ],
        },
        {
          matchId: input.matchId,
          source: `briefing:${input.matchId}`,
          signal: options?.signal ?? AbortSignal.timeout(BRIEFING_AI_TIMEOUT_MS),
        },
      );
      if (response == null) {
        aiFailed = true;
      } else {
        const durationMs = Date.now() - started;
        logInfo('tactical briefing workers ai done', {
          matchId: input.matchId,
          model: WORKERS_AI_TEXT_MODEL,
          durationMs,
        });
        const text = extractJsonObject(await workersAiResultText(response));
        const parsed: unknown = JSON.parse(text);
        if (!briefingHasContent(parsed)) {
          withholdCache = true;
          throw new Error('briefing missing summary or takeaway');
        }
        withholdCache = false;
        const briefing = alignBriefingPercentages(parseModelBriefing(parsed, input.matchId), input.probability);
        await env.KV.put(`${BRIEFING_CACHE_PREFIX}${input.matchId}`, JSON.stringify(briefing), {
          expirationTtl: BRIEFING_CACHE_TTL_SECONDS,
        });
        return briefing;
      }
    } catch (error) {
      aiFailed = true;
      logAiCallFailure('tactical briefing workers ai failed', error, {
        matchId: input.matchId,
        model: WORKERS_AI_TEXT_MODEL,
        durationMs: Date.now() - started,
      });
    }
  }

  const fallback = fallbackBriefing(input);
  if (withholdCache) {
    withheldFromCache.add(fallback);
    return fallback;
  }
  await env.KV.put(`${BRIEFING_CACHE_PREFIX}${input.matchId}`, JSON.stringify(fallback), {
    expirationTtl: aiFailed ? BRIEFING_AI_FAILURE_TTL_SECONDS : BRIEFING_CACHE_TTL_SECONDS,
  });
  return fallback;
}
