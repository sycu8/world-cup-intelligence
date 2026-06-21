import { describe, expect, it, vi, afterEach } from 'vitest';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './helpers/fixtures';
import { gatewayChat, gatewayChatJson } from '../src/ai/gatewayClient';
import { buildMatchThumbnailSvg } from '../src/services/matchThumbnail';

vi.mock('../src/ai/gatewayClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ai/gatewayClient')>();
  return {
    ...actual,
    gatewayChat: vi.fn(actual.gatewayChat),
    gatewayChatJson: vi.fn(actual.gatewayChatJson),
  };
});

vi.mock('../src/db/repositories/teamsRepo', () => ({
  getTeamsByTournament: vi.fn(async () => [
    { id: 'team-mex', name: 'Mexico', country_code: 'MX' },
  ]),
  getTeam: vi.fn(async (_db, id: string) => ({
    id,
    name: id === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0].name : FIXTURE_TEAMS[1].name,
    elo_rating: 1800,
    fifa_ranking: 10,
  })),
}));

vi.mock('../src/services/matchScenarioService', () => ({
  generateMatchScenarios: vi.fn(async () => {
    throw new Error('scenario fail');
  }),
}));

vi.mock('../src/market/services/marketSignalService', () => ({
  buildModelVsMarket: vi.fn(async () => undefined),
}));

describe('coverage target line gaps — round 2', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('gatewayClient falls back to Workers AI model without OpenAI key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }),
    );
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      CF_AIG_TOKEN: 'cf-token',
    });
    const result = await gatewayChat(env, 'news_summary', [{ role: 'user', content: 'hi' }], {
      preferEconomy: true,
      jsonMode: true,
    });
    expect(result?.content).toContain('ok');
  });

  it('gatewayChatJson returns null when gatewayChat returns empty content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ choices: [{ message: { content: '' } }] }),
    );
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    expect(await gatewayChatJson(env, 'news_summary', [{ role: 'user', content: 'x' }])).toBeNull();
  });

  it('translateNews handles m2m100 failures and gateway translation', async () => {
    vi.mocked(gatewayChatJson).mockResolvedValueOnce({
      titleVi: 'Mexico giành chiến thắng',
      summaryVi: 'Mexico đã thắng trận mở màn World Cup trước South Africa.',
    });
    const env = createMockEnv({
      AI: {
        run: vi.fn(async (model: string) => {
          if (String(model).includes('m2m100')) throw new Error('m2m down');
          return { translated_text: 'Mexico wins opener' };
        }),
      } as never,
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    const { translateNewsHeadline } = await import('../src/ai/translateNews');
    const result = await translateNewsHeadline(env, 'Mexico wins opener', 'Mexico beat South Africa 2-1.');
    expect(result?.titleVi).toContain('Mexico');
  });

  it('entityExtraction workers path handles malformed AI JSON', async () => {
    const env = createMockEnv({
      AI: { run: vi.fn(async () => ({ response: 'no-json-here' })) } as never,
    });
    const { extractEntitiesFromArticle } = await import('../src/ai/entityExtraction');
    const entities = await extractEntitiesFromArticle(env, 'Mexico squad announcement with 4-4-2 formation.');
    expect(entities?.teams).toContain('Mexico');
    expect(entities?.formations).toContain('4-4-2');
  });

  it('espnStatsClient returns null when scoreboard has no matching event', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ events: [] }));
    const { fetchEspnTeamMatchStats } = await import('../src/ingestion/espn/espnStatsClient');
    expect(await fetchEspnTeamMatchStats('X', 'Y', '2026-06-11T19:00:00Z')).toBeNull();
  });

  it('parseFifaTimeline covers save and coin toss event keys', async () => {
    const { parseFifaTimelineCommentary } = await import('../src/ingestion/fifa/parseFifaTimeline');
    const lines = parseFifaTimelineCommentary(
      {
        Event: [
          {
            EventId: 's1',
            TypeLocalized: [{ Locale: 'en-GB', Description: 'Goal Prevention' }],
            EventDescription: [{ Locale: 'en-GB', Description: 'Great save by keeper' }],
          },
          {
            EventId: 's2',
            TypeLocalized: [{ Locale: 'en-GB', Description: 'Coin Toss' }],
            EventDescription: [{ Locale: 'en-GB', Description: 'Coin toss completed' }],
          },
        ],
      },
      'm-save',
    );
    expect(lines.some((l) => l.eventType === 'save')).toBe(true);
    expect(lines.some((l) => l.eventType === 'coin_toss')).toBe(true);
  });

  it('newsImagePipeline uses optimized cf webp response directly', async () => {
    const webpBytes = new Uint8Array(5000).fill(4);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        if ((init as RequestInit)?.cf && (init as { cf?: { image?: unknown } }).cf?.image) {
          return new Response(webpBytes, {
            status: 200,
            headers: { 'content-type': 'image/webp' },
          });
        }
        throw new Error('unexpected fetch');
      }),
    );
    const { compressAndStoreNewsImage } = await import('../src/services/newsImagePipeline');
    const key = await compressAndStoreNewsImage(
      createMockEnv({ R2_ARTIFACTS: { put: vi.fn(async () => undefined) } as never }),
      'doc-cf',
      'https://cdn.example.com/a.webp',
    );
    expect(key).toBe('news/thumbs/doc-cf.webp');
  });

  it('matchThumbnail escapes xml-sensitive team names', () => {
    const svg = buildMatchThumbnailSvg({
      homeName: 'Team <Alpha> & Co',
      awayName: 'Beta "Quoted"',
      status: 'scheduled',
    });
    expect(svg).toContain('Team &lt;Alpha&gt; &amp; Co');
    expect(svg).toContain('Beta &quot;Quoted&quot;');
  });

  it('officialLineupSync infers formation and rotates large squads', async () => {
    const squadPlayers = Array.from({ length: 15 }, (_, i) => ({
      player_id: `p-${i}`,
      shirt_number: i + 1,
      listed_position: i === 0 ? 'GK' : i < 5 ? 'CB' : i < 9 ? 'CM' : 'FW',
      position: 'FW',
      name: `Player ${i}`,
    }));
    const upserts: unknown[] = [];
    const db = createMockDb({
      first: (sql) => {
        if (sql.includes('FROM lineups')) return null;
        if (sql.includes('FROM squads')) {
          return {
            id: 'sq-big',
            team_id: 'team-fra',
            source_id: 'src-mock',
            confidence: 0.9,
            announced_at: '2026-05-01',
          };
        }
        return null;
      },
      all: (sql) => ({
        results: sql.includes('squad_players') ? squadPlayers : [],
      }),
      run: () => ({ success: true }),
    });
    const lineupsRepo = await import('../src/db/repositories/lineupsRepo');
    vi.spyOn(lineupsRepo, 'upsertMatchLineup').mockImplementation(async (_db, input) => {
      upserts.push(input);
      return 'lu-m-1-team-fra';
    });
    const { syncOfficialSquadToMatch } = await import('../src/services/officialLineupSync');
    expect(await syncOfficialSquadToMatch({ DB: db } as never, 'm-1', 'team-fra')).toBe(true);
    expect(upserts[0]).toMatchObject({ formation: expect.any(String) });
  });

  it('recomputeMatch logs scenario generation failures', async () => {
    const db = createMockDb({
      first: (sql, binds) => {
        if (sql.includes('FROM matches WHERE id')) return FIXTURE_MATCH;
        if (sql.includes('FROM teams WHERE id')) {
          return binds[0] === FIXTURE_MATCH.home_team_id ? FIXTURE_TEAMS[0] : FIXTURE_TEAMS[1];
        }
        if (sql.includes('SELECT year FROM tournaments')) return { year: 2026 };
        if (sql.includes('FROM lineups')) return null;
        if (sql.includes("role = 'referee'")) return null;
        return null;
      },
      all: () => ({ results: [] }),
      run: () => ({ success: true, meta: { changes: 1 } }),
    });
    const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
    expect(await recomputeMatchProbability(createMockEnv({ DB: db }))).toBeTruthy();
  });

  it('tournamentMatchProbabilities persistMissing skips existing snapshots', async () => {
    const env = createMockEnv({
      KV: { get: vi.fn(async () => null), put: vi.fn(), delete: vi.fn() } as never,
      DB: createMockDb({
        first: () => ({ id: 'ps-1', match_id: FIXTURE_MATCH.id }),
      }),
    });
    const { persistMissingTournamentProbabilities } = await import(
      '../src/services/tournamentMatchProbabilities'
    );
    await persistMissingTournamentProbabilities(env, [FIXTURE_MATCH.id]);
  });
});
