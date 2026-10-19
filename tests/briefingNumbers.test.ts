import { describe, expect, it } from 'vitest';
import { alignBriefingPercentages, enginePercentSet, scrubPercentages } from '../src/ai/briefingNumbers';
import { tacticalBriefingPrompt } from '../src/ai/prompts';
import { fallbackBriefing } from '../src/ai/tacticalBriefing';

const probability = {
  homeWinProb: 0.42,
  drawProb: 0.28,
  awayWinProb: 0.3,
  expectedHomeGoals: 1.5,
  expectedAwayGoals: 1.2,
};

describe('briefing engine percentages', () => {
  it('puts the engine percents into the prompt as fixed values', () => {
    const prompt = tacticalBriefingPrompt('m-1', probability);
    expect(prompt).toContain('home win 42.0%');
    expect(prompt).toContain('draw 28.0%');
    expect(prompt).toContain('away win 30.0%');
    expect(prompt).toContain('expected goals 1.50 – 1.20');
    expect(enginePercentSet(probability).map((value) => Number(value.toFixed(1)))).toEqual([42, 28, 30]);
  });

  it('keeps a percent within ±1 of the engine and removes one that is not', () => {
    const allowed = enginePercentSet(probability);
    const text = scrubPercentages('Chủ nhà 42% — hòa 28,4% — khách 55%.', allowed);
    expect(text).toContain('42%');
    expect(text).toContain('28,4%');
    expect(text).not.toContain('55');
  });

  it('rewrites a generated briefing so a stray percent does not survive', () => {
    const draft = fallbackBriefing({ matchId: 'm-1', aiFallback: true, probability });
    const aligned = alignBriefingPercentages(
      {
        ...draft,
        summary: {
          vi: 'Chủ nhà có 55% cơ hội, cao hơn 42% của mô hình.',
          en: 'Home has a 55% chance, above the model 42%.',
        },
      },
      probability,
    );
    expect(aligned.summary.vi).not.toContain('55');
    expect(aligned.summary.vi).toContain('42%');
    expect(aligned.summary.en).not.toContain('55');
    expect(aligned.summary.en).toContain('42%');
    expect(aligned.summary.vi).not.toMatch(/\bengine\b/i);
  });
});
