import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchFifaCalendarMatches,
  fetchFifaWc2026FixturesCalendar,
  fetchFifaMatchInfo,
  fetchFifaTimeline,
} from '../src/ingestion/fifa/fifaApiClient';
import { WC2026_COMPETITION_ID } from '../src/ingestion/fifa/constants';

const sampleMatch = {
  IdMatch: '400021443',
  IdCompetition: WC2026_COMPETITION_ID,
  MatchNumber: 1,
  Date: '2026-06-11T19:00:00Z',
  MatchTime: "0'",
  MatchStatus: 1,
  HomeTeamScore: 0,
  AwayTeamScore: 0,
  Home: { IdCountry: 'MEX', TeamName: [{ Locale: 'en-GB', Description: 'Mexico' }] },
  Away: { IdCountry: 'RSA', TeamName: [{ Locale: 'en-GB', Description: 'South Africa' }] },
};

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    return handler(url);
  });
}

describe('ingestion fifaApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchFifaCalendarMatches filters WC2026 competition', async () => {
    mockFetch((url) => {
      expect(url).toContain('calendar/matches');
      return new Response(JSON.stringify({ Results: [sampleMatch, { ...sampleMatch, IdCompetition: '99' }] }), {
        status: 200,
      });
    });
    const rows = await fetchFifaCalendarMatches('2026-06-11T00:00:00Z', '2026-06-11T23:59:59Z');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.IdMatch).toBe('400021443');
  });

  it('fetchFifaWc2026FixturesCalendar returns fixtures window', async () => {
    mockFetch(() => new Response(JSON.stringify({ Results: [sampleMatch] }), { status: 200 }));
    const rows = await fetchFifaWc2026FixturesCalendar();
    expect(rows).toHaveLength(1);
  });

  it('fetchFifaMatchInfo returns parsed match info', async () => {
    mockFetch((url) => {
      expect(url).toContain('getMatchInfo');
      return new Response(JSON.stringify({ ...sampleMatch, HomeTeam: { Score: 1 } }), { status: 200 });
    });
    const info = await fetchFifaMatchInfo('400021443');
    expect(info?.HomeTeam?.Score).toBe(1);
  });

  it('fetchFifaTimeline returns timeline payload', async () => {
    mockFetch((url) => {
      expect(url).toContain('timelines/400021443');
      return new Response(JSON.stringify({ IdMatch: '400021443', Event: [] }), { status: 200 });
    });
    const timeline = await fetchFifaTimeline('400021443');
    expect(timeline?.IdMatch).toBe('400021443');
  });

  it('returns null on HTTP errors and invalid JSON', async () => {
    mockFetch((url) => {
      if (url.includes('404')) return new Response('not found', { status: 404 });
      if (url.includes('null')) return new Response('null', { status: 200 });
      return new Response('{bad json', { status: 200 });
    });
    expect(await fetchFifaMatchInfo('404')).toBeNull();
    expect(await fetchFifaMatchInfo('null')).toBeNull();
    expect(await fetchFifaMatchInfo('bad')).toBeNull();
  });

  it('handles empty Results array', async () => {
    mockFetch(() => new Response(JSON.stringify({ Results: null }), { status: 200 }));
    expect(await fetchFifaCalendarMatches('2026-01-01', '2026-01-02')).toEqual([]);
  });
});
