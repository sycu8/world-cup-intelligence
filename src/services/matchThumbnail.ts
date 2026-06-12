import type { AppEnv } from '../env';
import { flagCdnUrl, resolveTeamFlagSlug } from '../lib/teamFlags';
import { resolveMatchRef } from './matchRef';
import type { MatchWithSlug } from './matchRef';

export const MATCH_THUMB_WIDTH = 1200;
export const MATCH_THUMB_HEIGHT = 630;

export type MatchThumbnailInput = {
  homeName: string;
  awayName: string;
  homeCountryCode?: string | null;
  awayCountryCode?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string | null;
  stageLabel?: string | null;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateLabel(name: string, max = 22): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

async function fetchFlagDataUri(slug: string, width: number): Promise<string | null> {
  if (!slug) return null;
  const url = flagCdnUrl(slug, width);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'wc-tactical-platform/1.0 (match-thumb)' },
      signal: AbortSignal.timeout(10_000),
      cf: { cacheTtl: 86400 },
    } as RequestInit);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function scoreLine(input: MatchThumbnailInput): string | null {
  const done = input.status === 'completed' || input.status === 'finished' || input.status === 'live';
  if (!done || input.homeScore == null || input.awayScore == null) return null;
  return `${input.homeScore} – ${input.awayScore}`;
}

export function matchThumbnailR2Key(matchId: string): string {
  return `match-thumbs/${matchId}.svg`;
}

export function matchThumbnailPublicPath(ref: string): string {
  return `/api/matches/${ref}/thumbnail`;
}

export async function buildMatchThumbnailSvg(input: MatchThumbnailInput): Promise<string> {
  const homeSlug = resolveTeamFlagSlug({
    countryCode: input.homeCountryCode,
    teamName: input.homeName,
  });
  const awaySlug = resolveTeamFlagSlug({
    countryCode: input.awayCountryCode,
    teamName: input.awayName,
  });

  const [homeFlag, awayFlag] = await Promise.all([
    fetchFlagDataUri(homeSlug, 320),
    fetchFlagDataUri(awaySlug, 320),
  ]);

  const homeLabel = escapeXml(truncateLabel(input.homeName));
  const awayLabel = escapeXml(truncateLabel(input.awayName));
  const stage = escapeXml(input.stageLabel?.trim() || 'FIFA World Cup 2026');
  const score = scoreLine(input);
  const scoreText = score ? escapeXml(score) : '';

  const flagW = 280;
  const flagH = 180;
  const homeX = 140;
  const awayX = MATCH_THUMB_WIDTH - 140 - flagW;
  const flagY = 170;

  const homeFlagSvg = homeFlag
    ? `<image href="${homeFlag}" x="${homeX}" y="${flagY}" width="${flagW}" height="${flagH}" preserveAspectRatio="xMidYMid meet" clip-path="url(#flagClip)"/>`
    : `<rect x="${homeX}" y="${flagY}" width="${flagW}" height="${flagH}" rx="12" fill="#172033"/><text x="${homeX + flagW / 2}" y="${flagY + flagH / 2 + 8}" text-anchor="middle" fill="#94a3b8" font-size="48" font-family="system-ui,sans-serif">?</text>`;
  const awayFlagSvg = awayFlag
    ? `<image href="${awayFlag}" x="${awayX}" y="${flagY}" width="${flagW}" height="${flagH}" preserveAspectRatio="xMidYMid meet" clip-path="url(#flagClip)"/>`
    : `<rect x="${awayX}" y="${flagY}" width="${flagW}" height="${flagH}" rx="12" fill="#172033"/><text x="${awayX + flagW / 2}" y="${flagY + flagH / 2 + 8}" text-anchor="middle" fill="#94a3b8" font-size="48" font-family="system-ui,sans-serif">?</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${MATCH_THUMB_WIDTH}" height="${MATCH_THUMB_HEIGHT}" viewBox="0 0 ${MATCH_THUMB_WIDTH} ${MATCH_THUMB_HEIGHT}" role="img" aria-label="${homeLabel} vs ${awayLabel}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#071014"/>
      <stop offset="55%" stop-color="#0d1520"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <clipPath id="flagClip"><rect width="${flagW}" height="${flagH}" rx="12"/></clipPath>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="48" y="48" width="${MATCH_THUMB_WIDTH - 96}" height="${MATCH_THUMB_HEIGHT - 96}" rx="28" fill="none" stroke="#253244" stroke-width="2"/>
  <text x="600" y="92" text-anchor="middle" fill="#00E5FF" font-size="22" font-weight="700" letter-spacing="4" font-family="system-ui,sans-serif">PITCHINTEL</text>
  <text x="600" y="128" text-anchor="middle" fill="#64748b" font-size="18" font-family="system-ui,sans-serif">${stage}</text>
  ${homeFlagSvg}
  ${awayFlagSvg}
  <circle cx="600" cy="260" r="52" fill="#111827" stroke="#253244" stroke-width="2"/>
  <text x="600" y="272" text-anchor="middle" fill="#e2e8f0" font-size="32" font-weight="700" font-family="system-ui,sans-serif">VS</text>
  ${scoreText ? `<text x="600" y="400" text-anchor="middle" fill="#00E5FF" font-size="56" font-weight="700" font-family="'IBM Plex Mono',monospace" filter="url(#glow)">${scoreText}</text>` : ''}
  <text x="${homeX + flagW / 2}" y="420" text-anchor="middle" fill="#f8fafc" font-size="30" font-weight="600" font-family="system-ui,sans-serif">${homeLabel}</text>
  <text x="${awayX + flagW / 2}" y="420" text-anchor="middle" fill="#f8fafc" font-size="30" font-weight="600" font-family="system-ui,sans-serif">${awayLabel}</text>
  <text x="600" y="560" text-anchor="middle" fill="#475569" font-size="16" font-family="system-ui,sans-serif">wcstat.orangecloud.vn</text>
</svg>`;
}

export function matchToThumbnailInput(match: MatchWithSlug): MatchThumbnailInput {
  const stage =
    match.stage === 'Group' && match.group_code
      ? `Bảng ${match.group_code}`
      : (match.stage ?? 'World Cup 2026');
  return {
    homeName: match.home_name,
    awayName: match.away_name,
    homeCountryCode: match.home_country_code,
    awayCountryCode: match.away_country_code,
    homeScore: match.home_score,
    awayScore: match.away_score,
    status: match.status,
    stageLabel: stage,
  };
}

export async function getMatchThumbnailSvg(
  env: AppEnv,
  ref: string,
  opts?: { refresh?: boolean },
): Promise<{ svg: string; match: MatchWithSlug } | null> {
  const match = await resolveMatchRef(env.DB, ref);
  if (!match) return null;

  const r2Key = matchThumbnailR2Key(match.id);
  if (!opts?.refresh) {
    const cached = await env.R2_ARTIFACTS.get(r2Key);
    if (cached) {
      const svg = await cached.text();
      if (svg.trim().startsWith('<')) return { svg, match };
    }
  }

  const svg = await buildMatchThumbnailSvg(matchToThumbnailInput(match));
  await env.R2_ARTIFACTS.put(r2Key, svg, {
    httpMetadata: { contentType: 'image/svg+xml' },
  });
  return { svg, match };
}
