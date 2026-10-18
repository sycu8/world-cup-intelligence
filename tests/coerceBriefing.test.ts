import { describe, expect, it, vi } from 'vitest';
import realOutputs from './fixtures/wc55-real-outputs.json';
import { briefingHasContent, parseModelBriefing } from '../src/ai/coerceBriefing';
import { tacticalBriefingPrompt } from '../src/ai/prompts';
import { TacticalBriefingSchema } from '../src/ai/schemas';
import {
  BRIEFING_AI_TIMEOUT_MS,
  briefingWithheldFromCache,
  generateTacticalBriefing,
} from '../src/ai/tacticalBriefing';
import { extractJsonObject } from '../src/ai/workersAiText';
import { createMockEnv } from './helpers/mockEnv';

describe('captured Workers AI briefings', () => {
  it('rejects the raw QA outputs and accepts them after the production parser', () => {
    expect(realOutputs).toHaveLength(3);
    for (const raw of realOutputs) {
      const strict = TacticalBriefingSchema.safeParse(raw);
      expect(strict.success).toBe(false);
      if (!strict.success) {
        const paths = strict.error.issues.map((issue) => issue.path.join('.'));
        expect(paths).toContain('tacticalThemes.0.confidence');
      }

      const briefing = parseModelBriefing(raw, raw.matchId);
      expect(briefing.matchId).toBe(raw.matchId);
      expect(briefing.tacticalThemes[0]?.confidence).toBe(0.5);
      expect(briefing.tacticalThemes[0]?.supportingSources).toEqual([]);
      expect(briefing.collectiveTeamFactors[0]?.teamId).toBe('unspecified');
      expect(briefing.collectiveTeamFactors[0]?.direction).toBe('neutral');
      expect(briefing.lineupRisks[0]?.confidence).toBe(0.5);
      expect(briefing.keyPlayers[0]?.confidence).toBe(0.5);
      expect(briefing.citations).toEqual([]);
      expect(JSON.stringify(briefing)).not.toContain('example.com');
      expect(JSON.stringify(briefing)).not.toContain('Statistical Engine');
      expect(TacticalBriefingSchema.parse(briefing).matchId).toBe(raw.matchId);
    }
  });

  it('keeps player labels and citation urls from the captured shape', () => {
    const [first, second, third] = realOutputs;
    expect(parseModelBriefing(first, first.matchId).keyPlayers[0]?.playerId).toBe('Unknown');
    expect(parseModelBriefing(second, second.matchId).keyPlayers[0]?.playerId).toBe('no data');
    expect(parseModelBriefing(second, second.matchId).probabilityExplanation).toHaveLength(3);
    expect(parseModelBriefing(second, second.matchId).uncertaintyNotes[0]).toEqual({
      vi: 'Không có thông tin về khả năng của các cầu thủ',
      en: 'No information about the abilities of the players',
    });
    expect(parseModelBriefing(second, second.matchId).citations).toEqual([]);
    expect(parseModelBriefing(third, third.matchId).keyPlayers[0]?.playerId).toBe('unspecified');
    expect(parseModelBriefing(third, 'm-canonical').matchId).toBe('m-canonical');
  });

  it('parses a fenced capture the same way the Workers AI path does', () => {
    const third = realOutputs[2]!;
    const fenced = '```\n' + JSON.stringify(third) + '\n```';
    const briefing = parseModelBriefing(JSON.parse(extractJsonObject(fenced)), third.matchId);
    expect(briefing.summary).toEqual(third.summary);
    expect(briefing.citations).toEqual([]);
  });

  it('drops model citations, including an empty citation object', () => {
    const withUrl = parseModelBriefing(
      {
        summary: { vi: 'Tóm tắt', en: 'Summary' },
        probabilityExplanation: [{ vi: 'Điểm chính', en: 'Takeaway' }],
        citations: [
          {
            sourceName: 'Statistical Engine',
            sourceUrl: 'https://example.com/statistical-engine',
            title: 'Statistical preview',
            reliabilityScore: 0.9,
          },
        ],
      },
      'm-cite',
    );
    expect(withUrl.citations).toEqual([]);
    expect(JSON.stringify(withUrl)).not.toContain('example.com');
    expect(JSON.stringify(withUrl)).not.toContain('Statistical Engine');
    expect(JSON.stringify(withUrl)).not.toContain('PitchIntel');

    const emptyCitation = parseModelBriefing(
      {
        summary: { vi: 'Tóm tắt', en: 'Summary' },
        probabilityExplanation: [{ vi: 'Điểm chính', en: 'Takeaway' }],
        citations: [{}],
      },
      'm-empty-cite',
    );
    expect(emptyCitation.citations).toEqual([]);
  });

  it('keeps English out of vi when the model omits Vietnamese', () => {
    const briefing = parseModelBriefing(
      {
        summary: { en: 'Home side are favourites.' },
        probabilityExplanation: [{ en: 'Away win chance is 26.2%.' }],
      },
      'm-vi',
    );
    expect(briefing.summary).toEqual({ vi: '', en: 'Home side are favourites.' });
    expect(briefing.probabilityExplanation[0]).toEqual({ vi: '', en: 'Away win chance is 26.2%.' });
  });

  it('caches a schema-valid briefing when Workers AI omits nested fields', async () => {
    const raw = realOutputs[0]!;
    const env = createMockEnv({
      AI: { run: vi.fn(async () => ({ response: JSON.stringify(raw) })) } as never,
    });
    const result = await generateTacticalBriefing(env, {
      matchId: raw.matchId,
      aiFallback: false,
      probability: { homeWinProb: 0.48, drawProb: 0.25, awayWinProb: 0.15 },
    });

    expect(result.summary).toEqual(raw.summary);
    expect(result.citations).toEqual([]);
    expect(BRIEFING_AI_TIMEOUT_MS).toBeGreaterThanOrEqual(90_000);
    expect(BRIEFING_AI_TIMEOUT_MS).toBeLessThanOrEqual(120_000);
    expect(env.KV.put).toHaveBeenCalledWith(
      `briefing:vi3:${raw.matchId}`,
      expect.any(String),
      { expirationTtl: 3600 },
    );
    const briefingPut = vi.mocked(env.KV.put).mock.calls.find((call) =>
      String(call[0]).startsWith('briefing:vi3:'),
    );
    const stored = JSON.parse(String(briefingPut?.[1]));
    expect(TacticalBriefingSchema.parse(stored).matchId).toBe(raw.matchId);
    expect(stored.citations).toEqual([]);
  });

  it.each(['{}', '[]'])('falls back and does not cache a blank %s briefing', async (body) => {
    const env = createMockEnv({
      AI: { run: vi.fn(async () => ({ response: body })) } as never,
    });
    const result = await generateTacticalBriefing(env, {
      matchId: 'm-blank',
      aiFallback: false,
      probability: { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3 },
    });

    expect(result.summary.en).toContain('statistical model');
    expect(result.probabilityExplanation.length).toBeGreaterThan(0);
    expect(vi.mocked(env.KV.put).mock.calls.some((call) => String(call[0]).startsWith('briefing:'))).toBe(
      false,
    );
  });

  it('treats an empty Vietnamese summary or takeaway list as no content', () => {
    const englishOnly = {
      summary: { vi: '', en: 'Home side are favourites.' },
      probabilityExplanation: [{ vi: '', en: 'Away win chance is 26.2%.' }],
    };
    expect(briefingHasContent(englishOnly)).toBe(false);
    expect(
      briefingHasContent({
        summary: { vi: 'Tóm tắt', en: 'Summary' },
        probabilityExplanation: [{ en: 'English takeaway only' }],
      }),
    ).toBe(false);
    expect(
      briefingHasContent({
        summary: 'Plain summary',
        probabilityExplanation: ['Takeaway'],
      }),
    ).toBe(true);
    expect(
      briefingHasContent({
        summary: { vi: 'Tóm tắt', en: 'Summary' },
        probabilityExplanation: [{ vi: 'Điểm chính', en: 'Takeaway' }],
      }),
    ).toBe(true);
  });

  it('does not cache an English-only briefing and returns the statistical draft', async () => {
    const env = createMockEnv({
      AI: {
        run: vi.fn(async () => ({
          response: JSON.stringify({
            summary: { vi: '', en: 'Home side are favourites.' },
            probabilityExplanation: [{ vi: '', en: 'Away win chance is 26.2%.' }],
          }),
        })),
      } as never,
    });
    const result = await generateTacticalBriefing(env, {
      matchId: 'm-en-only',
      aiFallback: false,
      probability: { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3 },
    });

    expect(result.summary.vi).toContain('mô hình thống kê');
    expect(result.summary.en).toContain('statistical model');
    expect(briefingWithheldFromCache(result)).toBe(true);
    expect(vi.mocked(env.KV.put).mock.calls.some((call) => String(call[0]).startsWith('briefing:'))).toBe(
      false,
    );
  });

  it('does not ask the model to emit an empty vi field', () => {
    const prompt = tacticalBriefingPrompt('m-1', { awayWinProb: 0.26 });
    expect(prompt).not.toContain('set vi to');
    expect(prompt).not.toMatch(/vi:\s*""/);
    expect(prompt).toContain('Leave neither side empty');
  });
});
