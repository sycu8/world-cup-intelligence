import { describe, expect, it, vi, afterEach } from 'vitest';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './helpers/fixtures';

describe('coverage target line gaps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('espnStatsClient handles invalid JSON responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{bad', { status: 200 }));
    const { fetchEspnMatchSummary, resolveEspnEventId } = await import(
      '../src/ingestion/espn/espnStatsClient'
    );
    expect(await fetchEspnMatchSummary('1')).toBeNull();
    expect(await resolveEspnEventId('A', 'B', '2026-06-11T19:00:00Z')).toBeNull();
  });

  it('parseFifaTimeline maps fallback locales and own goals', async () => {
    const { parseFifaTimelineCommentary, timelinePeriodLabel, deriveShotsFromTimeline } = await import(
      '../src/ingestion/fifa/parseFifaTimeline'
    );
    expect(timelinePeriodLabel(99)).toBe('PRE');
    const lines = parseFifaTimelineCommentary(
      {
        Event: [
          {
            EventId: 'x1',
            TypeLocalized: [{ Locale: 'fr-FR', Description: 'Goal!' }],
            EventDescription: [{ Locale: 'fr-FR', Description: 'But!' }],
          },
          {
            EventId: 'x2',
            TypeLocalized: [{ Locale: 'en-GB', Description: 'Own Goal' }],
            EventDescription: [{ Locale: 'en-GB', Description: 'Own goal conceded' }],
          },
        ],
      },
      'm-fr',
    );
    expect(lines).toHaveLength(2);

    const derived = deriveShotsFromTimeline(
      {
        Event: [
          {
            EventId: 'no-label',
            IdTeam: 'home',
            EventDescription: [{ Locale: 'en-GB', Description: 'Loose ball' }],
          },
        ],
      },
      'home',
      'away',
    );
    expect(derived).toEqual({ homeShots: 0, awayShots: 0, homeSot: 0, awaySot: 0 });
  });

  it('fifaGamedayClient rejects invalid teams payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/token')) return new Response(JSON.stringify({ token: 'jwt' }), { status: 200 });
      return new Response('null', { status: 200 });
    });
    const { fetchFifaGamedayTeamMatchStats, resetFifaGamedayTokenCache } = await import(
      '../src/ingestion/fifa/fifaGamedayClient'
    );
    resetFifaGamedayTokenCache();
    expect(await fetchFifaGamedayTeamMatchStats('400021443')).toBeNull();
  });

  it('tacticalBriefing uses Workers AI when gateway unavailable', async () => {
    const briefingPayload = {
      matchId: 'm-ai',
      generatedAt: '2026-06-01T00:00:00Z',
      summary: { vi: 'Tóm tắt', en: 'Summary' },
      tacticalThemes: [],
      collectiveTeamFactors: [],
      lineupRisks: [],
      keyPlayers: [],
      probabilityExplanation: [],
      uncertaintyNotes: [],
      citations: [],
    };
    const env = createMockEnv({
      AI: {
        run: vi.fn(async () => ({ response: JSON.stringify(briefingPayload) })),
      } as never,
    });
    const { generateTacticalBriefing } = await import('../src/ai/tacticalBriefing');
    const result = await generateTacticalBriefing(env, {
      matchId: 'm-ai',
      aiFallback: false,
      probability: { homeWinProb: 0.5, drawProb: 0.25, awayWinProb: 0.25 },
    });
    expect(result.matchId).toBe('m-ai');
  });

  it('translateNews uses Workers AI llama fallback after m2m100 copy', async () => {
    const env = createMockEnv({
      AI: {
        run: vi.fn(async (model: string) => {
          if (String(model).includes('m2m100')) {
            return { translated_text: 'Mexico wins opener' };
          }
          return {
            response: JSON.stringify({
              titleVi: 'Mexico thắng trận mở màn',
              summaryVi: 'Mexico đánh bại South Africa trong trận mở màn giải đấu.',
            }),
          };
        }),
      } as never,
    });
    const { translateNewsHeadline } = await import('../src/ai/translateNews');
    const result = await translateNewsHeadline(env, 'Mexico wins opener', 'Mexico beat South Africa 2-1.');
    expect(result?.titleVi).toContain('Mexico');
  });

  it('gatewayClient supports OpenAI model config and cf-aig headers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ choices: [{ message: { content: '{"ok":true}' } }], model: 'openai/gpt-5.5' }),
    );
    const { gatewayChat } = await import('../src/ai/gatewayClient');
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
      CF_AIG_TOKEN: 'cf-token',
    });
    const result = await gatewayChat(env, 'tactical_briefing', [{ role: 'user', content: 'hi' }], {
      jsonMode: true,
    });
    expect(result?.content).toContain('ok');
  });

  it('recomputeMatch records failures in bulk recompute', async () => {
    const db = createMockDb({
      all: () => ({ results: [{ id: FIXTURE_MATCH.id }, { id: 'missing-match' }] }),
      first: (sql, binds) => {
        if (sql.includes('FROM matches WHERE id') && binds[0] === FIXTURE_MATCH.id) return FIXTURE_MATCH;
        if (sql.includes('FROM matches WHERE id')) return null;
        if (sql.includes('FROM teams WHERE id')) {
          return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
        }
        if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
        if (sql.includes('FROM lineups')) return null;
        if (sql.includes("role = 'referee'")) return null;
        return null;
      },
      run: () => ({ success: true, meta: { changes: 1 } }),
    });
    const { recomputeAllWc2026Matches } = await import('../src/services/recomputeMatch');
    const result = await recomputeAllWc2026Matches(createMockEnv({ DB: db }));
    expect(result.failed.some((f) => f.id === 'missing-match')).toBe(true);
  });

  it('officialLineupSync syncOfficialSquadToMatch returns false without squad', async () => {
    const env = createMockEnv({ DB: createMockDb({ first: () => null, all: () => ({ results: [] }) }) });
    const { syncOfficialSquadToMatch } = await import('../src/services/officialLineupSync');
    expect(await syncOfficialSquadToMatch(env, 'm-1', 'team-usa')).toBe(false);
  });

  it('newsImagePipeline rejects non-image content types', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('hello', { status: 200, headers: { 'content-type': 'text/plain' } })),
    );
    const { compressAndStoreNewsImage } = await import('../src/services/newsImagePipeline');
    expect(await compressAndStoreNewsImage(createMockEnv(), 'doc-bad', 'https://example.com/x.bin')).toBeNull();
  });

  it('tournamentProgression applyGroupQualifiers updates bracket slots', async () => {
    const completedMatch = {
      ...FIXTURE_MATCH,
      status: 'completed',
      home_score: 2,
      away_score: 1,
      stage: 'Group',
      group_code: 'A',
    };
    const completedRows = [
      {
        group_code: 'A',
        home_team_id: 'team-w26-a1',
        away_team_id: 'team-w26-a2',
        home_score: 2,
        away_score: 0,
        status: 'completed',
      },
    ];
    const env = createMockEnv({
      DB: createMockDb({
        first: (sql) => {
          if (sql.includes('FROM matches WHERE id')) return completedMatch;
          if (sql.includes('COUNT(*) AS total')) return { total: 6, done: 6 };
          if (sql.includes('AS team_id FROM matches')) return { team_id: 'team-placeholder' };
          return null;
        },
        all: (sql, binds) => {
          if (sql.includes("group_code = ?") && binds[1] === 'A') return { results: completedRows };
          if (sql.includes("rule_type = 'group_rank'")) {
            return {
              results: [
                {
                  id: 'link-1',
                  source_match_id: null,
                  target_match_id: 'm-w26-r32-1',
                  target_slot: 'home',
                  rule_type: 'group_rank',
                  rule_json: JSON.stringify({ group: 'A', rank: 1 }),
                },
              ],
            };
          }
          return { results: [] };
        },
        run: () => ({ success: true }),
      }),
    });
    const { processMatchCompletion } = await import('../src/services/tournamentProgression');
    const affected = await processMatchCompletion(env, completedMatch.id);
    expect(affected).toContain('m-w26-r32-1');
  });

  it('gatewayClient gatewayChatJson parses fenced JSON via fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ choices: [{ message: { content: '```json\n{"ok":true}\n```' } }] }),
    );
    const { gatewayChatJson } = await import('../src/ai/gatewayClient');
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      CF_AIG_TOKEN: 'token',
    });
    expect(await gatewayChatJson<{ ok: boolean }>(env, 'news_summary', [{ role: 'user', content: 'x' }])).toEqual({
      ok: true,
    });
  });

  it('gatewayClient gatewayChatJson returns null on malformed JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ choices: [{ message: { content: '{bad json' } }] }),
    );
    const { gatewayChatJson } = await import('../src/ai/gatewayClient');
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      CF_AIG_TOKEN: 'token',
    });
    expect(await gatewayChatJson(env, 'news_summary', [{ role: 'user', content: 'x' }])).toBeNull();
  });

  it('tournamentProgression returns early for non-completed matches', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        first: () => ({ ...FIXTURE_MATCH, status: 'scheduled' }),
      }),
    });
    const { processMatchCompletion } = await import('../src/services/tournamentProgression');
    expect(await processMatchCompletion(env, FIXTURE_MATCH.id)).toEqual([]);
  });
});
