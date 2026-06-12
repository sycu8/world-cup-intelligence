import { describe, it, expect } from 'vitest';
import {
  parseFifaMinute,
  resolveFifaPlatformStatus,
  normalizeTeamName,
  fifaCountryToTeamName,
} from '../src/ingestion/fifa/parse';
import { needsFullFifaMatchInfo } from '../src/ingestion/fifa/fifaLiveSync';
import type { FifaCalendarMatch } from '../src/ingestion/fifa/fifaApiClient';

describe('fifa parse helpers', () => {
  it('parses FIFA minute strings', () => {
    expect(parseFifaMinute("67'")).toBe(67);
    expect(parseFifaMinute("90'+2'")).toBe(92);
    expect(parseFifaMinute("98'")).toBe(98);
    expect(parseFifaMinute('0')).toBe(0);
  });

  it('maps FIFA status to platform status', () => {
    expect(resolveFifaPlatformStatus({ MatchStatus: 0, Period: 10, MatchTime: "98'" })).toBe('completed');
    expect(resolveFifaPlatformStatus({ MatchStatus: 3, Period: 5, MatchTime: "55'" })).toBe('live');
    expect(resolveFifaPlatformStatus({ MatchStatus: 1, Period: 0, MatchTime: "0'" })).toBe('scheduled');
  });

  it('normalizes team names for lookup', () => {
    expect(normalizeTeamName('Korea Republic')).toBe('korea republic');
    expect(normalizeTeamName("Côte d'Ivoire")).toBe('cote d ivoire');
  });

  it('maps FIFA country codes to display names', () => {
    expect(fifaCountryToTeamName('RSA', 'South Africa')).toBe('South Africa');
    expect(fifaCountryToTeamName('MEX', 'Mexico')).toBe('Mexico');
  });
});

describe('fifa live sync helpers', () => {
  const kickoff = '2026-06-11T19:00:00Z';
  const row = (overrides: Partial<FifaCalendarMatch> = {}): FifaCalendarMatch =>
    ({
      IdMatch: '400021443',
      Date: kickoff,
      MatchStatus: 1,
      Period: 0,
      MatchTime: "0'",
      ...overrides,
    }) as FifaCalendarMatch;

  it('always fetches full match info when live', () => {
    const now = new Date('2026-06-11T20:30:00Z').getTime();
    expect(needsFullFifaMatchInfo(row({ MatchStatus: 3, Period: 5, MatchTime: "55'" }), 'live', now)).toBe(true);
  });

  it('fetches full info within kickoff window only for non-live', () => {
    const during = new Date('2026-06-11T21:00:00Z').getTime();
    const before = new Date('2026-06-10T12:00:00Z').getTime();
    const after = new Date('2026-06-15T12:00:00Z').getTime();
    expect(needsFullFifaMatchInfo(row(), 'scheduled', during)).toBe(true);
    expect(needsFullFifaMatchInfo(row(), 'scheduled', before)).toBe(false);
    expect(needsFullFifaMatchInfo(row({ MatchStatus: 0, MatchTime: "98'" }), 'completed', after)).toBe(false);
  });
});
