import type { AppEnv } from '../env';
import { TacticalBriefingSchema, type TacticalBriefing } from './schemas';
import { nowIso } from '../utils/time';
import { isGatewayConfigured, gatewayChatJson } from './gatewayClient';
import { SYSTEM_NO_INVENT_NUMBERS, tacticalBriefingPrompt } from './prompts';

const BRIEFING_CACHE_PREFIX = 'briefing:vi3:';

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
      'Phân tích chiến thuật từ mô hình thống kê. Số liệu xác suất do engine tính — không phải lời khuyên cá cược.',
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
        'Các con số trên chỉ lấy từ engine thống kê.',
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
): Promise<TacticalBriefing> {
  const cached = await getCachedBriefing(env, input.matchId);
  if (cached) return cached;

  if (isGatewayConfigured(env) && !input.aiFallback) {
    try {
      const parsed = await gatewayChatJson<TacticalBriefing>(env, 'tactical_briefing', [
        { role: 'system', content: SYSTEM_NO_INVENT_NUMBERS },
        { role: 'user', content: tacticalBriefingPrompt(input.matchId, input.probability) },
      ]);
      if (parsed) {
        const briefing = TacticalBriefingSchema.parse({
          ...parsed,
          matchId: input.matchId,
          generatedAt: parsed.generatedAt || nowIso(),
        });
        await env.KV.put(`${BRIEFING_CACHE_PREFIX}${input.matchId}`, JSON.stringify(briefing), {
          expirationTtl: 3600,
        });
        return briefing;
      }
    } catch {
      /* fall through */
    }
  }

  if (env.AI && !input.aiFallback) {
    try {
      const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          { role: 'system', content: SYSTEM_NO_INVENT_NUMBERS },
          {
            role: 'user',
            content: tacticalBriefingPrompt(input.matchId, input.probability),
          },
        ],
      });
      const text =
        typeof response === 'object' && response && 'response' in response
          ? String((response as { response: string }).response)
          : JSON.stringify(response);
      const briefing = TacticalBriefingSchema.parse(JSON.parse(text));
      await env.KV.put(`${BRIEFING_CACHE_PREFIX}${input.matchId}`, JSON.stringify(briefing), {
        expirationTtl: 3600,
      });
      return briefing;
    } catch {
      /* fall through */
    }
  }

  const fallback = fallbackBriefing(input);
  await env.KV.put(`${BRIEFING_CACHE_PREFIX}${input.matchId}`, JSON.stringify(fallback), {
    expirationTtl: 3600,
  });
  return fallback;
}
