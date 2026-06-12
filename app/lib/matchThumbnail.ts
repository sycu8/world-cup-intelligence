export function matchThumbnailUrl(ref: string): string {
  return `/api/matches/${encodeURIComponent(ref)}/thumbnail`;
}
