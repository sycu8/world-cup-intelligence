export type MatchSlugInput = {
  stage: string | null | undefined;
  groupCode: string | null | undefined;
  homeName: string;
  awayName: string;
};

/** Internal match ids (m-w26-ga-1v2, m-final-2022, …). */
export function isLegacyMatchId(ref: string): boolean {
  return /^m-/.test(ref);
}

function slugifySegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function slugifyTeamName(name: string): string {
  return slugifySegment(name.trim()) || 'team';
}

export function stageSlug(stage: string | null | undefined, groupCode: string | null | undefined): string {
  const s = (stage ?? '').trim();
  if (s === 'Group' && groupCode) {
    return `vong-bang-${groupCode.toLowerCase()}`;
  }
  if (/round of 32/i.test(s)) return 'vong-1-16';
  if (/round of 16/i.test(s)) return 'vong-1-8';
  if (/quarter/i.test(s)) return 'vong-tu-ket';
  if (/semi/i.test(s)) return 'vong-ban-ket';
  if (/third/i.test(s)) return 'tranh-hang-3';
  if (/final/i.test(s)) return 'chung-ket';
  if (s) return slugifySegment(s);
  return 'vong-dau';
}

/** URL slug: vong-bang-a-united-states-vs-mexico */
export function buildMatchSlug(input: MatchSlugInput): string {
  const round = stageSlug(input.stage, input.groupCode);
  const home = slugifyTeamName(input.homeName);
  const away = slugifyTeamName(input.awayName);
  return `${round}-${home}-vs-${away}`;
}

export function matchAnalysisPath(slug: string): string {
  return `/matches/${slug}/analysis`;
}

export function matchPagePath(slug: string): string {
  return `/matches/${slug}`;
}

export function lineupPagePath(slug: string): string {
  return `/lineups/${slug}`;
}
