import { describe, expect, it } from 'vitest';
import {
  flagImageUrl,
  isoToFlagEmoji,
  resolveTeamFlag,
  resolveTeamFlagSlug,
} from '../app/lib/nationFlags';

describe('nationFlags', () => {
  it('converts ISO codes to flag emoji', () => {
    expect(isoToFlagEmoji('US')).toBe('🇺🇸');
    expect(isoToFlagEmoji('MX')).toBe('🇲🇽');
    expect(isoToFlagEmoji('AR')).toBe('🇦🇷');
  });

  it('resolves flag slug for nations and sub-nations', () => {
    expect(resolveTeamFlagSlug({ countryCode: 'US' })).toBe('us');
    expect(resolveTeamFlagSlug({ countryCode: 'GB', teamName: 'Scotland' })).toBe('gb-sct');
    expect(resolveTeamFlagSlug({ countryCode: 'GB', teamName: 'England' })).toBe('gb-eng');
    expect(resolveTeamFlagSlug({ teamName: 'Brazil' })).toBe('br');
  });

  it('builds flagcdn image URLs', () => {
    expect(flagImageUrl('us', 40)).toBe('https://flagcdn.com/w40/us.png');
    expect(flagImageUrl('gb-sct', 80)).toBe('https://flagcdn.com/w80/gb-sct.png');
  });

  it('resolves emoji flag from country code or team name', () => {
    expect(resolveTeamFlag({ countryCode: 'JP' })).toBe('🇯🇵');
    expect(resolveTeamFlag({ teamName: 'Brazil' })).toBe('🇧🇷');
    expect(resolveTeamFlag({ countryCode: 'XX' })).toBe('');
  });
});
