import {
  lineupPagePath,
  matchAnalysisPath,
  matchPagePath,
} from '@/utils/matchSlug';

export {
  buildMatchSlug,
  isLegacyMatchId,
  lineupPagePath,
  matchAnalysisPath,
  matchPagePath,
} from '@/utils/matchSlug';

export function resolveMatchHref(match: { slug?: string | null; id: string }): string {
  return matchPagePath(match.slug ?? match.id);
}

export function resolveMatchAnalysisHref(match: { slug?: string | null; id: string }): string {
  return matchAnalysisPath(match.slug ?? match.id);
}

export function resolveLineupHref(match: { slug?: string | null; id: string }): string {
  return lineupPagePath(match.slug ?? match.id);
}
