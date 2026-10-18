import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingestStatsbombWorldCup } from '../src/ingestion/statsbombIngest';
import { createIngestionEnv } from './helpers/ingestionMockDb';
import { SOURCE_IDS } from '../src/ingestion/sourceRegistry';

vi.mock('../src/services/teamRatingRefresh', () => ({
  refreshTeamRatingsFromForm: vi.fn(async () => 3),
}));

const sampleMatchJson = [
  {
    match_id: 991,
    match_date: '2022-11-20',
    kick_off: '19:00:00.000',
    home_team: { home_team_name: 'Mexico' },
    away_team: { away_team_name: 'South Africa' },
    home_score: 2,
    away_score: 0,
    competition_stage: { name: 'Group Stage' },
  },
];

describe('ingestion statsbombIngest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ingests seasons, stores R2 raw, inserts matches and stats', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('competitions.json')) {
        return new Response(
          JSON.stringify([
            {
              competition_id: 43,
              season_id: 106,
              competition_name: 'FIFA World Cup',
              competition_gender: 'male',
              competition_youth: false,
              season_name: '2022',
              match_available: '2022-12-18',
            },
          ]),
          { status: 200 },
        );
      }
      if (u.includes('/matches/43/106.json')) {
        return new Response(JSON.stringify(sampleMatchJson), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });

    const { env } = createIngestionEnv({ matches: [] });
    const result = await ingestStatsbombWorldCup(env);
    expect(result.seasonsProcessed).toBe(1);
    expect(result.matchesInserted).toBe(1);
    expect(result.teamsUpdated).toBe(3);
    expect(env.R2_RAW.put).toHaveBeenCalled();
    expect(env.DB.prepare).toHaveBeenCalled();
  });

  it('skips unknown teams and existing matches', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('competitions.json')) {
        return new Response(
          JSON.stringify([
            {
              competition_id: 43,
              season_id: 106,
              competition_name: 'FIFA World Cup',
              competition_gender: 'male',
              competition_youth: false,
              season_name: '2022',
              match_available: '2022-12-18',
            },
          ]),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify([
          ...sampleMatchJson,
          {
            match_id: 992,
            match_date: '2022-11-21',
            kick_off: '19:00:00.000',
            home_team: { home_team_name: 'Unknownland' },
            away_team: { away_team_name: 'Nowhere FC' },
            home_score: 1,
            away_score: 1,
          },
        ]),
        { status: 200 },
      );
    });

    const { env } = createIngestionEnv({
      matches: [{ id: 'm-sb-991', tournament_id: 't-2022' }],
    });
    const result = await ingestStatsbombWorldCup(env);
    expect(result.matchesSkipped).toBeGreaterThanOrEqual(2);
  });

  it('continues when season fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('competitions.json')) {
        return new Response(
          JSON.stringify([
            {
              competition_id: 43,
              season_id: 106,
              competition_name: 'FIFA World Cup',
              competition_gender: 'male',
              competition_youth: false,
              season_name: '2022',
              match_available: '2022-12-18',
            },
          ]),
          { status: 200 },
        );
      }
      return new Response('fail', { status: 500 });
    });
    const { env } = createIngestionEnv();
    const result = await ingestStatsbombWorldCup(env);
    expect(result.seasonsProcessed).toBe(0);
    expect(result.matchesInserted).toBe(0);
  });

  it('handles JSON parse errors in season loop', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('competitions.json')) {
        return new Response(
          JSON.stringify([
            {
              competition_id: 43,
              season_id: 106,
              competition_name: 'FIFA World Cup',
              competition_gender: 'male',
              competition_youth: false,
              season_name: '2022',
              match_available: '2022-12-18',
            },
          ]),
          { status: 200 },
        );
      }
      return new Response('not-json', { status: 200 });
    });
    const { env } = createIngestionEnv();
    const result = await ingestStatsbombWorldCup(env);
    expect(result.seasonsProcessed).toBe(0);
    expect(env.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE source_registry'),
    );
    expect(SOURCE_IDS.statsbomb).toBe('src-statsbomb');
  });
});
