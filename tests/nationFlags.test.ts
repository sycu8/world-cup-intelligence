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
    expect(resolveTeamFlag({ countryCode: 'GB', teamName: 'Scotland' })).toBe('🇬🇧');
    expect(resolveTeamFlag({ countryCode: 'GB', teamName: 'England' })).toBe('🇬🇧');
    expect(resolveTeamFlag({ teamName: 'Unknown Nation XYZ' })).toBe('');
  });

  it('handles invalid ISO and empty slugs', () => {
    expect(isoToFlagEmoji('TBD')).toBe('');
    expect(isoToFlagEmoji('X')).toBe('');
    expect(flagImageUrl('')).toBe('');
    expect(resolveTeamFlagSlug({ countryCode: 'XX', teamName: 'Brazil' })).toBe('br');
  });

  it('resolves GB partial names and hyphen slug emoji fallbacks', () => {
    expect(resolveTeamFlagSlug({ countryCode: 'GB', teamName: 'Scot' })).toBe('gb-sct');
    expect(resolveTeamFlagSlug({ countryCode: 'GB', teamName: 'English Lions' })).toBe('gb-eng');
    expect(resolveTeamFlag({ countryCode: 'GB', teamName: 'Scot' })).toBe('🇬🇧');
    expect(resolveTeamFlag({ teamName: 'Not A Real Nation ZZZ' })).toBe('');
    expect(resolveTeamFlagSlug({ teamName: 'Not A Real Nation ZZZ' })).toBe('');
  });
});
