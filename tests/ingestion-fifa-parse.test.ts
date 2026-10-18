import { describe, it, expect } from 'vitest';
import {
  fifaLocalizedName,
  normalizeTeamName,
  fifaCountryToTeamName,
  parseFifaMinute,
  resolveFifaPlatformStatus,
  periodLabel,
  minutePeriod,
} from '../src/ingestion/fifa/parse';

describe('ingestion fifa parse', () => {
  it('fifaLocalizedName prefers English locale', () => {
    expect(fifaLocalizedName([])).toBe('');
    expect(fifaLocalizedName(null)).toBe('');
    expect(fifaLocalizedName([{ Locale: 'en-GB', Description: '' }])).toBe('');
    expect(
      fifaLocalizedName([
        { Locale: 'fr-FR', Description: 'France' },
        { Locale: 'en-GB', Description: '  Mexico  ' },
      ]),
    ).toBe('Mexico');
    expect(fifaLocalizedName([{ Locale: 'fr-FR' }])).toBe('');
  });

  it('parseFifaMinute handles stoppage and invalid values', () => {
    expect(parseFifaMinute(null)).toBe(0);
    expect(parseFifaMinute(undefined)).toBe(0);
    expect(parseFifaMinute("90'+2'")).toBe(92);
    expect(parseFifaMinute('abc')).toBe(0);
    expect(parseFifaMinute("45'+x'")).toBe(45);
  });

  it('resolveFifaPlatformStatus covers live and scheduled paths', () => {
    expect(resolveFifaPlatformStatus({ MatchStatus: 2, Period: 3, MatchTime: "0'" })).toBe('live');
    expect(resolveFifaPlatformStatus({ MatchStatus: 1, Period: 4, MatchTime: "45'" })).toBe('live');
    expect(resolveFifaPlatformStatus({ MatchStatus: 1, Period: 0, MatchTime: "0'" })).toBe('scheduled');
  });

  it('minutePeriod maps elapsed minutes to half labels', () => {
    expect(minutePeriod(30)).toBe('1H');
    expect(minutePeriod(60)).toBe('2H');
    expect(minutePeriod(95)).toBe('ET');
  });

  it('periodLabel maps FIFA period codes and minute fallback', () => {
    expect(periodLabel(3)).toBe('1H');
    expect(periodLabel(4)).toBe('HT');
    expect(periodLabel(5)).toBe('2H');
    expect(periodLabel(6)).toBe('ET1');
    expect(periodLabel(7)).toBe('ET2');
    expect(periodLabel(8)).toBe('PEN');
    expect(periodLabel(10)).toBe('FT');
    expect(periodLabel(99)).toBe('1H');
    expect(periodLabel(null)).toBe('1H');
  });

  it('normalizeTeamName strips diacritics', () => {
    expect(normalizeTeamName("Côte d'Ivoire")).toBe('cote d ivoire');
  });

  it('fifaCountryToTeamName uses alias table', () => {
    expect(fifaCountryToTeamName('USA', 'United States of America')).toBe('United States');
    expect(fifaCountryToTeamName('ZZZ', 'Fallback FC')).toBe('Fallback FC');
    expect(fifaCountryToTeamName(null, 'Unknown')).toBe('Unknown');
  });
});
