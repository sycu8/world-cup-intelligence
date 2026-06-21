import { describe, expect, it } from 'vitest';
import {
  coachToFeatures,
  getMatchStaff,
  getTeamCoachProfile,
  refereeToFeatures,
} from '../src/services/matchStaff';
import { createMockDb, createMockEnv, createMockKv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';
import { WC2026_TOURNAMENT_ID } from '../src/constants/tournament';

const coachRow = {
  id: 'coach-1',
  name: 'Coach Test',
  nationality: 'MEX',
  wc_appearances: 2,
  tenure_years: 4,
  tactical_rating: 0.72,
  discipline_index: 0.55,
};

function staffDb() {
  return createMockDb({
    first: (sql, binds) => {
      if (sql.includes('FROM matches m') && sql.includes('m.id = ?')) {
        return {
          ...FIXTURE_MATCH,
          home_name: 'Mexico',
          away_name: 'South Africa',
          slug: 'test-slug',
          tournament_id: WC2026_TOURNAMENT_ID,
        };
      }
      if (sql.includes('FROM team_coaches')) {
        const teamId = binds[0] as string;
        return teamId === FIXTURE_MATCH.home_team_id ? coachRow : null;
      }
      if (sql.includes('FROM match_officials')) {
        return {
          role: 'referee',
          name: 'Jane Ref',
          nationality: 'FRA',
          fifa_category: 'FIFA',
          strictness: 0.65,
        };
      }
      return null;
    },
    all: (sql) => {
      if (sql.includes('FROM match_officials')) {
        return {
          results: [
            {
              role: 'referee',
              name: 'Jane Ref',
              nationality: 'FRA',
              fifa_category: 'FIFA',
              strictness: 0.65,
            },
            {
              role: 'var',
              name: 'VAR Official',
              nationality: 'USA',
              fifa_category: 'FIFA',
              strictness: null,
            },
          ],
        };
      }
      return { results: [] };
    },
  });
}

describe('matchStaff helpers', () => {
  it('maps coach and referee to probability features', () => {
    const coach = coachToFeatures(
      {
        coachId: 'c1',
        name: 'Coach',
        nationality: 'MEX',
        wcAppearances: 1,
        tenureYears: 2,
        tacticalRating: 0.7,
        disciplineIndex: 0.5,
      },
      'MEX',
    );
    expect(coach?.homeNationMatch).toBe(true);

    const ref = refereeToFeatures({
      role: 'referee',
      name: 'Ref',
      nationality: 'FRA',
      fifaCategory: 'FIFA',
      strictness: 0.5,
    });
    expect(ref?.avgYellowCards).toBeGreaterThan(3);
  });

  it('returns undefined referee features without strictness', () => {
    expect(
      refereeToFeatures({
        role: 'referee',
        name: 'Ref',
        nationality: null,
        fifaCategory: null,
        strictness: null,
      }),
    ).toBeUndefined();
  });
});

describe('getMatchStaff', () => {
  it('loads coaches and officials for resolved match', async () => {
    const kv = createMockKv({
      [`cache:match-ref:${FIXTURE_MATCH.id}`]: JSON.stringify({
        ...FIXTURE_MATCH,
        slug: FIXTURE_MATCH.id,
        home_name: 'Mexico',
        away_name: 'South Africa',
      }),
    });
    const env = createMockEnv({ DB: staffDb(), KV: kv, MOCK_SOURCES: 'true' });
    const payload = await getMatchStaff(env, FIXTURE_MATCH.id);
    expect(payload?.matchId).toBe(FIXTURE_MATCH.id);
    expect(payload?.homeCoach?.name).toBe('Coach Test');
    expect(payload?.referee?.name).toBe('Jane Ref');
    expect(payload?.officials.length).toBeGreaterThan(0);
  });

  it('getTeamCoachProfile returns head coach row', async () => {
    const env = createMockEnv({ DB: staffDb() });
    const coach = await getTeamCoachProfile(env, FIXTURE_MATCH.home_team_id);
    expect(coach?.coachId).toBe('coach-1');
  });

  it('loadStaffFeaturesForMatch maps referee row without fifa category', async () => {
    const { loadStaffFeaturesForMatch } = await import('../src/services/matchStaff');
    const env = createMockEnv({ DB: staffDb() });
    const features = await loadStaffFeaturesForMatch(
      env,
      FIXTURE_MATCH.id,
      WC2026_TOURNAMENT_ID,
      FIXTURE_MATCH.home_team_id,
      FIXTURE_MATCH.away_team_id,
      'MEX',
      'RSA',
    );
    expect(features.referee?.name).toBe('Jane Ref');
    expect(features.homeCoach?.homeNationMatch).toBe(true);
  });
});
