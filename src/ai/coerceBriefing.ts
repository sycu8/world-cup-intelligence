import { TacticalBriefingSchema, type TacticalBriefing } from './schemas';
import { nowIso } from '../utils/time';

const UNSPECIFIED_ID = 'unspecified';

/**
 * Workers AI often returns valid JSON that omits nested schema fields.
 * Fill those structural gaps, then parse. Do not invent engine probabilities.
 */
export function parseModelBriefing(raw: unknown, matchId: string): TacticalBriefing {
  const root = asRecord(raw) ?? {};
  return TacticalBriefingSchema.parse({
    matchId,
    generatedAt: text(root.generatedAt) || nowIso(),
    summary: localized(root.summary),
    tacticalThemes: objects(root.tacticalThemes).map((item) => ({
      title: localized(item.title),
      detail: localized(item.detail),
      confidence: unitScore(item.confidence, 0.5),
      supportingSources: [],
    })),
    collectiveTeamFactors: objects(root.collectiveTeamFactors).map((item) => ({
      teamId: text(item.teamId) || UNSPECIFIED_ID,
      factor: localized(item.factor),
      explanation: localized(item.explanation),
      direction: direction(item.direction),
      confidence: unitScore(item.confidence, 0.5),
    })),
    lineupRisks: objects(root.lineupRisks).map((item) => {
      const playerId = text(item.playerId) || text(item.player) || text(item.name);
      return {
        teamId: text(item.teamId) || UNSPECIFIED_ID,
        ...(playerId ? { playerId } : {}),
        risk: localized(item.risk ?? item.explanation),
        confidence: unitScore(item.confidence, 0.5),
      };
    }),
    keyPlayers: objects(root.keyPlayers).map((item) => ({
      playerId: text(item.playerId) || text(item.player) || text(item.name) || UNSPECIFIED_ID,
      reason: localized(item.reason),
      impactArea: localized(item.impactArea),
      confidence: unitScore(item.confidence, 0.5),
    })),
    probabilityExplanation: asArray(root.probabilityExplanation).map((item) => localized(item)).filter(hasText),
    uncertaintyNotes: asArray(root.uncertaintyNotes).map((item) => localized(item)),
    // Sources are attached by the server. Model citation fields and URLs are ignored.
    citations: [],
  });
}

/**
 * A briefing needs a Vietnamese summary and at least one Vietnamese takeaway.
 * English-only prose (vi: "") is not content and is not cached.
 * A plain string still counts, so string-shaped output is not rejected.
 */
export function briefingHasContent(raw: unknown): boolean {
  const root = asRecord(raw);
  if (!root) return false;
  const summary = localized(root.summary);
  const takeaways = asArray(root.probabilityExplanation)
    .map((item) => localized(item))
    .filter(hasVietnamese);
  return hasVietnamese(summary) && takeaways.length > 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objects(value: unknown): Record<string, unknown>[] {
  return asArray(value).flatMap((item) => {
    const rec = asRecord(item);
    return rec ? [rec] : [];
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasText(value: string | { vi: string; en: string }): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  return value.vi.trim().length > 0 || value.en.trim().length > 0;
}

function hasVietnamese(value: string | { vi: string; en: string }): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  return value.vi.trim().length > 0;
}

function localized(value: unknown): string | { vi: string; en: string } {
  if (typeof value === 'string') return value;
  const rec = asRecord(value);
  if (!rec) return { vi: '', en: '' };
  if (typeof rec.vi === 'string' || typeof rec.en === 'string') {
    const vi = typeof rec.vi === 'string' ? rec.vi : '';
    const en = typeof rec.en === 'string' ? rec.en : vi;
    return { vi, en };
  }
  if ('note' in rec) return localized(rec.note);
  if ('explanation' in rec) return localized(rec.explanation);
  return { vi: '', en: '' };
}

function unitScore(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const scaled = value > 1 && value <= 100 ? value / 100 : value;
  return Math.min(1, Math.max(0, scaled));
}

function direction(value: unknown): 'positive' | 'negative' | 'neutral' {
  if (value === 'positive' || value === 'negative' || value === 'neutral') return value;
  return 'neutral';
}
