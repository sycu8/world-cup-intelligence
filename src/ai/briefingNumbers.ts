import type { TacticalBriefing } from './schemas';

type Localized = string | { vi: string; en: string };

const WIN_PROB_KEYS = ['homeWinProb', 'drawProb', 'awayWinProb'] as const;

/** Engine win probabilities as percents. Values already in 0–100 are kept. */
export function enginePercentSet(probability: Record<string, unknown>): number[] {
  const set: number[] = [];
  for (const key of WIN_PROB_KEYS) {
    const raw = probability[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    set.push(raw >= 0 && raw <= 1 ? raw * 100 : raw);
  }
  return set;
}

function percentText(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const pct = value >= 0 && value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

/** Fixed figures the model must copy. Probabilities are already scaled to percents. */
export function engineFactLines(probability: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const home = percentText(probability.homeWinProb);
  const draw = percentText(probability.drawProb);
  const away = percentText(probability.awayWinProb);
  if (home) lines.push(`home win ${home}`);
  if (draw) lines.push(`draw ${draw}`);
  if (away) lines.push(`away win ${away}`);
  const homeGoals = probability.expectedHomeGoals;
  const awayGoals = probability.expectedAwayGoals;
  if (typeof homeGoals === 'number' && typeof awayGoals === 'number') {
    lines.push(`expected goals ${homeGoals.toFixed(2)} – ${awayGoals.toFixed(2)}`);
  }
  return lines;
}

function matchesEngine(value: number, allowed: number[]): boolean {
  return allowed.some((engine) => Math.abs(engine - value) <= 1);
}

/** Drop a percent that is not within ±1 of an engine win probability. */
export function scrubPercentages(text: string, allowed: number[]): string {
  const scrubbed = text.replace(/(\d+(?:[.,]\d+)?)\s*%/g, (match, raw: string) => {
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value)) return '';
    return matchesEngine(value, allowed) ? match : '';
  });
  return scrubbed.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

function mapLocalized(value: Localized, fn: (text: string) => string): Localized {
  if (typeof value === 'string') return fn(value);
  return { vi: fn(value.vi), en: fn(value.en) };
}

/** Rewrite every prose percent so the text only keeps engine figures. */
export function alignBriefingPercentages(
  briefing: TacticalBriefing,
  probability: Record<string, unknown>,
): TacticalBriefing {
  const allowed = enginePercentSet(probability);
  const scrub = (text: string) => scrubPercentages(text, allowed);
  return {
    ...briefing,
    summary: mapLocalized(briefing.summary, scrub),
    tacticalThemes: briefing.tacticalThemes.map((item) => ({
      ...item,
      title: mapLocalized(item.title, scrub),
      detail: mapLocalized(item.detail, scrub),
    })),
    collectiveTeamFactors: briefing.collectiveTeamFactors.map((item) => ({
      ...item,
      factor: mapLocalized(item.factor, scrub),
      explanation: mapLocalized(item.explanation, scrub),
    })),
    lineupRisks: briefing.lineupRisks.map((item) => ({
      ...item,
      risk: mapLocalized(item.risk, scrub),
    })),
    keyPlayers: briefing.keyPlayers.map((item) => ({
      ...item,
      reason: mapLocalized(item.reason, scrub),
      impactArea: mapLocalized(item.impactArea, scrub),
    })),
    probabilityExplanation: briefing.probabilityExplanation.map((item) => mapLocalized(item, scrub)),
    uncertaintyNotes: briefing.uncertaintyNotes.map((item) => mapLocalized(item, scrub)),
  };
}
