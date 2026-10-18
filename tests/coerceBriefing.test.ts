import { describe, expect, it, vi } from 'vitest';
import realOutputs from './fixtures/wc55-real-outputs.json';
import { parseModelBriefing } from '../src/ai/coerceBriefing';
import { TacticalBriefingSchema } from '../src/ai/schemas';
import { generateTacticalBriefing } from '../src/ai/tacticalBriefing';
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
      expect(briefing.citations[0]?.sourceDocumentId).toBe('platform-model');
      expect(briefing.citations[0]?.reliabilityScore).toBe(0.6);
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
    expect(parseModelBriefing(second, second.matchId).citations[0]?.sourceUrl).toBe(
      'https://example.com/statistical-engine',
    );
    expect(parseModelBriefing(third, third.matchId).keyPlayers[0]?.playerId).toBe('unspecified');
    expect(parseModelBriefing(third, 'm-canonical').matchId).toBe('m-canonical');
  });

  it('parses a fenced capture the same way the Workers AI path does', () => {
    const third = realOutputs[2]!;
    const fenced = '```\n' + JSON.stringify(third) + '\n```';
    const briefing = parseModelBriefing(JSON.parse(extractJsonObject(fenced)), third.matchId);
    expect(briefing.summary).toEqual(third.summary);
    expect(briefing.citations[0]?.sourceName).toBe('Statistical Engine');
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
    expect(result.citations[0]?.sourceDocumentId).toBe('platform-model');
    expect(env.KV.put).toHaveBeenCalledWith(
      `briefing:vi3:${raw.matchId}`,
      expect.any(String),
      { expirationTtl: 3600 },
    );
    const stored = JSON.parse(String(vi.mocked(env.KV.put).mock.calls[0]?.[1]));
    expect(TacticalBriefingSchema.parse(stored).matchId).toBe(raw.matchId);
  });
});
