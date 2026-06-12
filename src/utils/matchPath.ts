import { isLegacyMatchId } from './matchSlug';

/** Extract match slug from `/matches/:slug` or `/matches/:slug/analysis`. */
export function parseMatchPageSlug(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'matches' || !parts[1]) return null;
  if (parts[1] === 'analysis') return null;
  if (parts[2] === 'analysis') return parts[1];
  if (parts.length === 2) return parts[1];
  return null;
}

export function isMatchPagePath(pathname: string): boolean {
  return parseMatchPageSlug(pathname) !== null || isLegacyMatchId(pathname.split('/').pop() ?? '');
}
