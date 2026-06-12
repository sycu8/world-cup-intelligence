import { nationMeta } from '../../app/lib/nationIsoCodes';

const FLAG_CDN = 'https://flagcdn.com';

const FLAG_SLUG_OVERRIDES: Record<string, string> = {
  eng: 'gb-eng',
  sco: 'gb-sct',
  england: 'gb-eng',
  scotland: 'gb-sct',
};

function normalizeFlagKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

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

export function flagCdnUrl(slug: string, width = 320): string {
  if (!slug) return '';
  return `${FLAG_CDN}/w${width}/${slug}.png`;
}
