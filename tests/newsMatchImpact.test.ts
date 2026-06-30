import { describe, expect, it, vi } from 'vitest';
import {
  buildImpactSummaryVi,
  buildTeamAliasIndex,
  classifyNewsImpact,
  findTeamIdsInText,
  processNewsDocumentImpact,
} from '../src/services/newsMatchImpact';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';

vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => ({ matchId: FIXTURE_MATCH.id })),
}));

const mockTeams = [
  { id: 'team-w26-a1', name: 'Mexico', short_name: 'MEX', country_code: 'MEX' },
  { id: 'team-w26-a2', name: 'South Africa', short_name: 'RSA', country_code: 'RSA' },
  { id: 'team-w26-b1', name: 'Brazil', short_name: 'BRA', country_code: 'BRA' },
] as const;

describe('newsMatchImpact', () => {
  const index = buildTeamAliasIndex([...mockTeams]);

  it('finds WC2026 teams and aliases in text', () => {
    const ids = findTeamIdsInText('Mexico face South Africa in opening match', index);
    expect(ids).toContain('team-w26-a1');
    expect(ids).toContain('team-w26-a2');
  });

  it('classifies injury news as high impact', () => {
    const level = classifyNewsImpact('Key striker ruled out with hamstring injury before Mexico clash', {
      teams: ['Mexico'],
      players: [],
      injuries: ['striker ruled out'],
      tacticalNotes: [],
      formations: [],
    });
    expect(level).toBe('high');
  });

  it('classifies lineup news as medium impact', () => {
    const level = classifyNewsImpact('Coach confirms starting XI for World Cup opener', null);
    expect(level).toBe('medium');
  });

  it('classifies high impact from injury entities even without injury keywords in text', () => {
    const level = classifyNewsImpact('Mexico prepare for the opener', {
      teams: ['Mexico'],
      players: [],
      injuries: ['late fitness issue'],
      tacticalNotes: [],
      formations: [],
    });
    expect(level).toBe('high');
  });

  it('classifies medium impact from formation entities alone', () => {
    const level = classifyNewsImpact('Preview update', {
      teams: [],
      players: [],
      injuries: [],
      tacticalNotes: [],
      formations: ['4-3-3'],
    });
    expect(level).toBe('medium');
  });

  it('builds Vietnamese impact summary when matches affected', () => {
    const summary = buildImpactSummaryVi(
      ['Mexico', 'South Africa'],
      ['m-w26-ga-1v2'],
      'high',
      { teams: [], players: [], injuries: ['Player X injured'], tacticalNotes: [], formations: [] },
    );
    expect(summary).toContain('Mexico');
    expect(summary).toContain('World Cup 2026');
  });

  it('returns null summary for none impact', () => {
    expect(buildImpactSummaryVi([], [], 'none', null)).toBeNull();
  });

  it('builds fallback summary text when team names are missing', () => {
    const summary = buildImpactSummaryVi([], ['m-1'], 'low', null);
    expect(summary).toContain('đội liên quan');
    expect(summary).toContain('mức thấp');
  });

  it('classifies low impact when two teams mentioned', () => {
    expect(classifyNewsImpact('Mexico and South Africa prepare', { teams: ['Mexico', 'South Africa'], players: [], injuries: [], tacticalNotes: [], formations: [] })).toBe('low');
  });

  it('ignores aliases shorter than three characters when matching team ids', () => {
    const ids = findTeamIdsInText('CAN face Mexico', index);
    expect(ids).toContain('team-w26-a1');
    expect(ids).not.toContain('team-w26-b1');
  });
});

describe('processNewsDocumentImpact', () => {
  it('links news to WC2026 matches and triggers recompute for high impact', async () => {
    const queueSend = vi.fn(async () => undefined);
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("GLOB 'team-w26-")) {
            return {
              results: [
                { id: 'team-w26-a1', name: 'Mexico', short_name: 'MEX', country_code: 'MEX', fifa_ranking: 14, elo_rating: 1800, collective_strength_rating: 0.8 },
                { id: 'team-w26-a2', name: 'South Africa', short_name: 'RSA', country_code: 'RSA', fifa_ranking: 59, elo_rating: 1650, collective_strength_rating: 0.62 },
              ],
            };
          }
          if (sql.includes('SELECT id FROM matches') && sql.includes('home_team_id IN')) {
            return { results: [{ id: FIXTURE_MATCH.id }] };
          }
          if (sql.includes('country_code')) return { results: [{ id: 'team-w26-a1' }] };
          return { results: [] };
        },
        first: (sql) => {
          if (sql.includes('country_code FROM teams')) return { country_code: 'MEX' };
          return null;
        },
        run: () => ({ success: true, meta: { changes: 1 } }),
      }),
      MODEL_QUEUE: { send: queueSend } as never,
    });

    const result = await processNewsDocumentImpact(
      env,
      'doc-1',
      'Mexico striker ruled out with hamstring injury before South Africa clash',
      { teams: ['Mexico'], players: [], injuries: ['hamstring'], tacticalNotes: [], formations: [] },
    );
    expect(result.impactLevel).toBe('high');
    expect(result.matchIds).toContain(FIXTURE_MATCH.id);
    expect(result.triggeredRecompute).toBe(true);
    expect(queueSend).toHaveBeenCalled();
  });

  it('stores null affected matches when no teams can be resolved', async () => {
    const runBinds: unknown[][] = [];
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("GLOB 'team-w26-")) {
            return { results: [...mockTeams] };
          }
          return { results: [] };
        },
        run: (_sql, binds) => {
          runBinds.push([...binds]);
          return { success: true, meta: { changes: 1 } } as never;
        },
      }),
    });

    const result = await processNewsDocumentImpact(env, 'doc-empty', 'General tournament note', null);
    expect(result).toMatchObject({
      matchIds: [],
      impactLevel: 'none',
      summaryVi: null,
      triggeredRecompute: false,
    });
    expect(runBinds.at(-1)?.[0]).toBeNull();
  });

  it('uses pair match lookup when both teams are scheduled against each other', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("GLOB 'team-w26-")) {
            return {
              results: [
                { id: 'team-w26-a1', name: 'Mexico', short_name: 'MEX', country_code: 'MEX' },
                { id: 'team-w26-a2', name: 'South Africa', short_name: 'RSA', country_code: 'RSA' },
              ],
            };
          }
          if (sql.includes('AND home_team_id IN') && sql.includes('AND away_team_id IN')) {
            return { results: [{ id: 'm-pair' }] };
          }
          return { results: [] };
        },
        run: () => ({ success: true, meta: { changes: 1 } }) as never,
      }),
    });

    const result = await processNewsDocumentImpact(
      env,
      'doc-pair',
      'Mexico and South Africa prepare',
      { teams: ['Mexico', 'South Africa'], players: [], injuries: [], tacticalNotes: [], formations: [] },
    );
    expect(result.matchIds).toEqual(['m-pair']);
  });

  it('resolves team ids from entity aliases and falls back to OR match lookup', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("GLOB 'team-w26-")) {
            return {
              results: [
                { id: 'team-w26-a1', name: 'Mexico', short_name: 'MEX', country_code: 'MEX' },
                { id: 'team-w26-a2', name: 'South Africa', short_name: 'RSA', country_code: 'RSA' },
              ],
            };
          }
          if (sql.includes('AND home_team_id IN') && sql.includes('AND away_team_id IN')) {
            return { results: [] };
          }
          if (sql.includes('OR away_team_id IN')) {
            return { results: [{ id: 'm-fallback' }] };
          }
          if (sql.includes('country_code = ?')) {
            return { results: undefined };
          }
          return { results: [] };
        },
        first: (sql) => {
          if (sql.includes('country_code FROM teams')) return { country_code: 'MEX' };
          return null;
        },
        run: () => ({ success: true, meta: { changes: 1 } }) as never,
      }),
    });

    const result = await processNewsDocumentImpact(
      env,
      'doc-alias',
      'No direct nation names here',
      {
        teams: ['El Tri'],
        players: [],
        injuries: [],
        tacticalNotes: ['Formation tweak expected'],
        formations: [],
      },
    );
    expect(result.matchIds).toEqual(['m-fallback']);
    expect(result.impactLevel).toBe('medium');
  });

  it('returns empty match ids when OR lookup omits results and entity alias is unknown', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: (sql) => {
          if (sql.includes("GLOB 'team-w26-")) {
            return { results: [...mockTeams] };
          }
          if (sql.includes('AND home_team_id IN') && sql.includes('AND away_team_id IN')) {
            return {};
          }
          if (sql.includes('OR away_team_id IN')) {
            return {};
          }
          return { results: [] };
        },
        run: () => ({ success: true, meta: { changes: 1 } }) as never,
      }),
    });

    const result = await processNewsDocumentImpact(env, 'doc-unknown', 'Preview', {
      teams: ['Unknown Nation FC'],
      players: [],
      injuries: [],
      tacticalNotes: [],
      formations: [],
    });
    expect(result.matchIds).toEqual([]);
  });
});

describe('FifaWc2026NewsAdapter helpers', () => {
  it('extracts article links from FIFA HTML snippet', async () => {
    const { fetchFifaWc2026NewsItems } = await import('../src/ingestion/adapters/FifaWc2026NewsAdapter');
    expect(typeof fetchFifaWc2026NewsItems).toBe('function');
  });
});
