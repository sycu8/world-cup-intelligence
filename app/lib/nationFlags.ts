import { nationMeta } from './nationIsoCodes';

const FLAG_CDN = 'https://flagcdn.com';

/** FIFA / UI labels that need a sub-national flag slug on flagcdn (ISO alone is GB for both). */
const FLAG_SLUG_OVERRIDES: Record<string, string> = {
  eng: 'gb-eng',
  sco: 'gb-sct',
  england: 'gb-eng',
  scotland: 'gb-sct',
};

/** ISO 3166-1 alpha-2 → regional indicator flag emoji (e.g. US → 🇺🇸). */
export function isoToFlagEmoji(iso: string | null | undefined): string {
  if (!iso || iso.length !== 2) return '';
  const upper = iso.toUpperCase();
  if (upper === 'XX' || upper === 'TBD') return '';
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function normalizeFlagKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

/** flagcdn slug (e.g. us, gb-eng) for reliable cross-platform flag images. */
export function resolveTeamFlagSlug(opts: {
  countryCode?: string | null;
  teamName?: string | null;
}): string {
  for (const key of [normalizeFlagKey(opts.teamName)]) {
    if (key && FLAG_SLUG_OVERRIDES[key]) return FLAG_SLUG_OVERRIDES[key];
  }

  const code = opts.countryCode?.trim();
  if (code && code.length === 2 && code.toUpperCase() !== 'XX') {
    const upper = code.toUpperCase();
    if (upper === 'GB') {
      const name = normalizeFlagKey(opts.teamName);
      if (name.includes('scot')) return 'gb-sct';
      if (name.includes('eng')) return 'gb-eng';
    }
    return upper.toLowerCase();
  }

  const name = opts.teamName?.trim();
  if (!name) return '';
  const override = FLAG_SLUG_OVERRIDES[normalizeFlagKey(name)];
  if (override) return override;
  try {
    return nationMeta(name).iso.toLowerCase();
  } catch {
    return '';
  }
}

export function flagImageUrl(slug: string, width = 40): string {
  if (!slug) return '';
  return `${FLAG_CDN}/w${width}/${slug}.png`;
}

export function resolveTeamFlag(opts: {
  countryCode?: string | null;
  teamName?: string | null;
}): string {
  const slug = resolveTeamFlagSlug(opts);
  if (!slug) return '';
  // Emoji flags only work for plain ISO slugs; sub-nations fall back to name lookup.
  if (slug.includes('-')) {
    const name = opts.teamName?.trim();
    if (name) {
      try {
        return isoToFlagEmoji(nationMeta(name).iso);
      } catch {
        return '';
      }
    }
    return '';
  }
  return isoToFlagEmoji(slug.toUpperCase());
}

export const DEFAULT_FLAG_IMG_CLASS =
  'inline-block h-3.5 w-[1.375rem] shrink-0 rounded-sm object-cover ring-1 ring-white/10';
