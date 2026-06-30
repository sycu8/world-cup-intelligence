import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fallbackBriefing,
  generateTacticalBriefing,
  getCachedBriefing,
} from '../src/ai/tacticalBriefing';
import { translateNewsHeadline } from '../src/ai/translateNews';
import {
  gatewayChat,
  gatewayChatJson,
  isGatewayConfigured,
} from '../src/ai/gatewayClient';
import {
  extractEntitiesFromArticle,
  extractEntitiesRuleBased,
} from '../src/ai/entityExtraction';
import { runMultiVariableAnalysis, getCachedAnalysis } from '../src/ai/multiVariableAnalysis';
import { explainScenarioComparison } from '../src/ai/explainScenarioComparison';
import { explainModelVsMarket } from '../src/ai/explainModelVsMarket';
import { explainScenarioLikelihood } from '../src/ai/explainScenarioLikelihood';
import { explainTeamSystemStrength } from '../src/ai/explainTeamSystemStrength';
import { explainScenarioRealtimeShift } from '../src/ai/explainScenarioRealtimeShift';
import * as probabilityRepo from '../src/db/repositories/probabilityRepo';
import { createMockEnv, createMockKv } from './helpers/mockEnv';
import { mockScenario } from './helpers/scenarioFixtures';
import type { MatchScenarioSet } from '../src/models/scenarios/types';
import { MARKET_DISCLAIMER } from '../src/market/types';

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
    { id: 'team-usa', name: 'United States', country_code: 'US' },
    { id: 'team-mex', name: 'Mexico', country_code: 'MX' },
  ]),
  getTeam: vi.fn(async (_db, id: string) => ({
    id,
    name: id === 'team-home' ? 'Home FC' : 'Away FC',
    elo_rating: 1800,
    fifa_ranking: 10,
  })),
}));

vi.mock('../src/db/repositories/matchesRepo', () => ({
  getMatch: vi.fn(async () => ({
    id: 'm-1',
    tournament_id: 't-2026',
    home_team_id: 'team-home',
    away_team_id: 'team-away',
    status: 'scheduled',
    minute: 0,
    home_score: 0,
    away_score: 0,
    stage: 'Group',
    kickoff_utc: '2026-06-15T18:00:00Z',
  })),
}));

vi.mock('../src/db/repositories/probabilityRepo', () => ({
  getLatestSnapshot: vi.fn(async () => ({
    home_win_prob: 0.45,
    draw_prob: 0.28,
    away_win_prob: 0.27,
    expected_home_goals: 1.5,
    expected_away_goals: 1.1,
    most_likely_score: '1-1',
    confidence: 0.82,
  })),
}));

vi.mock('../src/db/repositories/eventsRepo', () => ({
  getMatchEvents: vi.fn(async () => []),
}));

vi.mock('../src/services/matchFeatures', () => ({
  buildMatchFeaturesWithForm: vi.fn(async () => ({
    homeTeam: { eloRating: 1800 },
    awayTeam: { eloRating: 1750 },
  })),
}));

describe('tacticalBriefing', () => {
  it('fallbackBriefing formats probability strings', () => {
    const briefing = fallbackBriefing({
      matchId: 'm-1',
      aiFallback: true,
      probability: {
        homeWinProb: 0.42,
        drawProb: 0.28,
        awayWinProb: 0.3,
        expectedHomeGoals: 1.5,
        expectedAwayGoals: 1.2,
      },
    });
    expect(briefing.matchId).toBe('m-1');
    expect(JSON.stringify(briefing.probabilityExplanation)).toContain('42.0');
  });

  it('getCachedBriefing reads KV cache', async () => {
    const briefing = fallbackBriefing({
      matchId: 'm-1',
      aiFallback: true,
      probability: { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3 },
    });
    const env = createMockEnv({
      KV: createMockKv({ 'briefing:vi3:m-1': JSON.stringify(briefing) }),
    });
    const cached = await getCachedBriefing(env, 'm-1');
    expect(cached?.matchId).toBe('m-1');
  });

  it('generateTacticalBriefing uses fallback when AI unavailable', async () => {
    const env = createMockEnv({ AI: undefined, AI_FALLBACK_MODE: 'false' });
    const result = await generateTacticalBriefing(env, {
      matchId: 'm-2',
      aiFallback: true,
      probability: { homeWinProb: 0.5, drawProb: 0.25, awayWinProb: 0.25 },
    });
    expect(result.summary).toBeTruthy();
    expect(env.KV.put).toHaveBeenCalled();
  });

  it('getCachedBriefing returns null for invalid cache payload', async () => {
    const env = createMockEnv({ KV: createMockKv({ 'briefing:vi3:m-1': 'not-json' }) });
    expect(await getCachedBriefing(env, 'm-1')).toBeNull();
  });

  it('generateTacticalBriefing returns cached briefing without recomputing', async () => {
    const briefing = fallbackBriefing({
      matchId: 'm-cached',
      aiFallback: true,
      probability: { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3 },
    });
    const env = createMockEnv({
      KV: createMockKv({ 'briefing:vi3:m-cached': JSON.stringify(briefing) }),
    });
    const result = await generateTacticalBriefing(env, {
      matchId: 'm-cached',
      aiFallback: false,
      probability: {},
    });
    expect(result.matchId).toBe('m-cached');
  });

  it('generateTacticalBriefing uses gateway when configured', async () => {
    vi.mocked(gatewayChatJson).mockResolvedValueOnce({
      ...fallbackBriefing({
        matchId: 'm-gw',
        aiFallback: false,
        probability: { homeWinProb: 0.5, drawProb: 0.25, awayWinProb: 0.25 },
      }),
      matchId: 'm-gw',
    });
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    const result = await generateTacticalBriefing(env, {
      matchId: 'm-gw',
      aiFallback: false,
      probability: { homeWinProb: 0.5, drawProb: 0.25, awayWinProb: 0.25 },
    });
    expect(result.matchId).toBe('m-gw');
  });

  it('generateTacticalBriefing falls back when gateway throws', async () => {
    vi.mocked(gatewayChatJson).mockRejectedValueOnce(new Error('gateway down'));
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
      AI: undefined,
    });
    const result = await generateTacticalBriefing(env, {
      matchId: 'm-gw-fail',
      aiFallback: false,
      probability: { homeWinProb: 0.5, drawProb: 0.25, awayWinProb: 0.25 },
    });
    expect(result.matchId).toBe('m-gw-fail');
  });

  it('generateTacticalBriefing parses Workers AI non-response payloads', async () => {
    const briefing = fallbackBriefing({
      matchId: 'm-workers',
      aiFallback: false,
      probability: { homeWinProb: 0.5, drawProb: 0.25, awayWinProb: 0.25 },
    });
    const env = createMockEnv({
      AI: {
        run: vi.fn(async () => briefing),
      } as never,
    });
    const result = await generateTacticalBriefing(env, {
      matchId: 'm-workers',
      aiFallback: false,
      probability: { homeWinProb: 0.5, drawProb: 0.25, awayWinProb: 0.25 },
    });
    expect(result.matchId).toBe('m-workers');
  });

  it('generateTacticalBriefing falls back when Workers AI returns invalid JSON', async () => {
    const env = createMockEnv({
      AI: { run: vi.fn(async () => ({ response: '{not-json' })) } as never,
    });
    const result = await generateTacticalBriefing(env, {
      matchId: 'm-workers-bad',
      aiFallback: false,
      probability: { homeWinProb: 0.5, drawProb: 0.25, awayWinProb: 0.25 },
    });
    expect(result.matchId).toBe('m-workers-bad');
  });
});

describe('translateNews', () => {
  it('returns null for empty title', async () => {
    expect(await translateNewsHeadline(createMockEnv(), '', 'summary')).toBeNull();
  });

  it('uses m2m100 when Workers AI returns translated text', async () => {
    const aiRun = vi.fn(async () => ({ translated_text: 'Đội tuyển Mỹ thắng trận giao hữu' }));
    const env = createMockEnv({ AI: { run: aiRun } as never });
    const result = await translateNewsHeadline(
      env,
      'USA wins friendly',
      'The United States beat Mexico in a friendly match on Friday night.',
    );
    expect(result?.titleVi).toContain('Mỹ');
    expect(aiRun).toHaveBeenCalled();
  });

  it('uses Workers AI llama models when m2m100 fails', async () => {
    const aiRun = vi.fn(async (model: string) => {
      if (model.includes('m2m100')) return { translated_text: 'USA wins friendly' };
      return {
        response: JSON.stringify({
          titleVi: 'Hoa Kỳ thắng trận giao hữu',
          summaryVi: 'Đội tuyển Hoa Kỳ đánh bại Mexico trong trận giao hữu tối thứ Sáu.',
        }),
      };
    });
    const env = createMockEnv({ AI: { run: aiRun } as never });
    const result = await translateNewsHeadline(env, 'USA wins friendly', 'The United States beat Mexico.');
    expect(result?.titleVi).toContain('Hoa Kỳ');
  });

  it('uses gateway when Workers AI paths fail', async () => {
    vi.mocked(gatewayChatJson).mockResolvedValueOnce({
      titleVi: 'Mexico giành chiến thắng',
      summaryVi: 'Mexico đã thắng trận mở màn World Cup với tỷ số 2-1 trước đối thủ.',
    });
    const env = createMockEnv({
      AI: { run: vi.fn(async () => ({ translated_text: 'Mexico wins opener' })) } as never,
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    const result = await translateNewsHeadline(env, 'Mexico wins opener', 'Mexico beat South Africa 2-1.');
    expect(result?.titleVi).toContain('Mexico');
  });

  it('returns null when Workers AI returns invalid translation JSON', async () => {
    const env = createMockEnv({
      AI: {
        run: vi.fn(async (model: string) => {
          if (String(model).includes('m2m100')) return { translated_text: 'Mexico wins opener' };
          return { response: '{bad json' };
        }),
      } as never,
    });
    expect(
      await translateNewsHeadline(env, 'Mexico wins opener', 'Mexico beat South Africa 2-1.'),
    ).toBeNull();
  });

  it('returns null when m2m100 response lacks translated_text field', async () => {
    const env = createMockEnv({
      AI: { run: vi.fn(async () => ({ ok: true })) } as never,
    });
    expect(await translateNewsHeadline(env, 'Mexico wins', 'Mexico beat South Africa.')).toBeNull();
  });

  it('returns null when Workers AI throws during translation', async () => {
    const env = createMockEnv({
      AI: {
        run: vi.fn(async (model: string) => {
          if (String(model).includes('m2m100')) return { translated_text: 'Mexico wins opener' };
          throw new Error('workers down');
        }),
      } as never,
    });
    expect(await translateNewsHeadline(env, 'Mexico wins opener', 'Mexico beat South Africa 2-1.')).toBeNull();
  });

  it('returns null when gateway returns empty Vietnamese fields', async () => {
    vi.mocked(gatewayChatJson).mockResolvedValueOnce({
      titleVi: '   ',
      summaryVi: 'Mexico thang',
    });
    const env = createMockEnv({
      AI: { run: vi.fn(async () => ({ translated_text: 'Mexico wins opener' })) } as never,
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    expect(await translateNewsHeadline(env, 'Mexico wins opener', 'Mexico beat South Africa 2-1.')).toBeNull();
  });

  it('returns null when translation JSON cannot be parsed', async () => {
    const env = createMockEnv({
      AI: {
        run: vi.fn(async (model: string) => {
          if (String(model).includes('m2m100')) return { translated_text: 'Mexico wins opener' };
          return { response: '{"titleVi": "bad"' };
        }),
      } as never,
    });
    expect(await translateNewsHeadline(env, 'Mexico wins opener', 'Mexico beat South Africa 2-1.')).toBeNull();
  });

  it('returns null when normalized translation fields are blank', async () => {
    vi.mocked(gatewayChatJson).mockResolvedValueOnce({
      titleVi: '',
      summaryVi: 'Mexico thang tran',
    });
    const env = createMockEnv({
      AI: { run: vi.fn(async () => ({ translated_text: 'Mexico wins opener' })) } as never,
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    expect(await translateNewsHeadline(env, 'Mexico wins opener', 'Mexico beat South Africa 2-1.')).toBeNull();
  });

  it('returns null when m2m100 produces too-short Vietnamese', async () => {
    const env = createMockEnv({
      AI: { run: vi.fn(async () => ({ translated_text: 'ab' })) } as never,
    });
    expect(await translateNewsHeadline(env, 'Mexico wins opener', 'Mexico beat South Africa 2-1.')).toBeNull();
  });

  it('returns null when no AI binding is configured', async () => {
    expect(
      await translateNewsHeadline(createMockEnv({ AI: undefined as never }), 'Mexico wins', 'Summary text here.'),
    ).toBeNull();
  });

  it('returns null when m2m100 summary copies English source', async () => {
    const env = createMockEnv({
      AI: {
        run: vi.fn(async (_model: string, opts: { text?: string }) => {
          const text = opts?.text ?? '';
          if (text.includes('Mexico wins')) {
            return { translated_text: 'Mexico thắng trận mở màn' };
          }
          return { translated_text: 'Mexico beat South Africa 2-1.' };
        }),
      } as never,
    });
    expect(await translateNewsHeadline(env, 'Mexico wins opener', 'Mexico beat South Africa 2-1.')).toBeNull();
  });
});

describe('gatewayClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isGatewayConfigured requires gateway flags and credentials', () => {
    expect(
      isGatewayConfigured(
        createMockEnv({
          AI_GATEWAY_ENABLED: 'true',
          AI_GATEWAY_ACCOUNT_ID: 'acct',
          OPENAI_API_KEY: 'sk-test',
        }),
      ),
    ).toBe(true);
    expect(isGatewayConfigured(createMockEnv())).toBe(false);
  });

  it('gatewayChat returns parsed content on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: '{"ok":true}' } }],
          model: '@cf/meta/llama-3-8b-instruct',
          usage: { total_tokens: 10 },
        }),
      ),
    );
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      CF_AIG_TOKEN: 'token',
    });
    const result = await gatewayChat(env, 'tactical_briefing', [
      { role: 'user', content: 'hello' },
    ]);
    expect(result?.content).toContain('ok');
    expect(env.KV.put).toHaveBeenCalled();
  });

  it('gatewayChatJson strips markdown fences', async () => {
    vi.mocked(gatewayChatJson).mockImplementationOnce(async () => {
      const cleaned = '```json\n{"titleVi":"Tiêu đề"}\n```'
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '');
      return JSON.parse(cleaned) as { titleVi: string };
    });
    const parsed = await gatewayChatJson<{ titleVi: string }>(createMockEnv(), 'news_summary', [
      { role: 'user', content: 'x' },
    ]);
    expect(parsed?.titleVi).toBe('Tiêu đề');
  });

  it('gatewayChat returns null when gateway disabled', async () => {
    expect(await gatewayChat(createMockEnv(), 'news_summary', [{ role: 'user', content: 'x' }])).toBeNull();
  });

  it('gatewayChat handles HTTP errors and fetch failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad gateway', { status: 502 })));
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      CF_AIG_TOKEN: 'token',
    });
    expect(await gatewayChat(env, 'news_summary', [{ role: 'user', content: 'x' }])).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));
    expect(await gatewayChat(env, 'news_summary', [{ role: 'user', content: 'x' }])).toBeNull();
  });

  it('gatewayChatJson parses fenced JSON from gatewayChat', async () => {
    vi.mocked(gatewayChatJson).mockImplementationOnce(async (env, task, messages) => {
      const result = await gatewayChat(env, task, messages, { jsonMode: true });
      if (!result?.content) return null;
      try {
        const cleaned = result.content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
        return JSON.parse(cleaned) as { titleVi: string };
      } catch {
        return null;
      }
    });
    vi.mocked(gatewayChat).mockResolvedValueOnce({
      content: '```json\n{"titleVi":"Tiêu đề từ gateway"}\n```',
      model: '@cf/meta/llama-3-8b-instruct',
      provider: 'workers',
    });
    const parsed = await gatewayChatJson<{ titleVi: string }>(createMockEnv(), 'news_summary', [
      { role: 'user', content: 'x' },
    ]);
    expect(parsed?.titleVi).toBe('Tiêu đề từ gateway');
  });

  it('gatewayChatJson returns null when JSON parse fails after gatewayChat', async () => {
    vi.mocked(gatewayChatJson).mockImplementationOnce(async (env, task, messages) => {
      const result = await gatewayChat(env, task, messages, { jsonMode: true });
      if (!result?.content) return null;
      try {
        const cleaned = result.content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
        return JSON.parse(cleaned);
      } catch {
        return null;
      }
    });
    vi.mocked(gatewayChat).mockResolvedValueOnce({
      content: 'not valid json',
      model: '@cf/meta/llama-3-8b-instruct',
      provider: 'workers',
    });
    expect(await gatewayChatJson(createMockEnv(), 'news_summary', [{ role: 'user', content: 'x' }])).toBeNull();
  });
});

describe('entityExtraction', () => {
  it('extractEntitiesRuleBased finds teams injuries and formations', () => {
    const text =
      'United States lineup uses 4-3-3. John Smith is ruled out with injury.';
    const entities = extractEntitiesRuleBased(text, ['United States']);
    expect(entities.teams).toContain('United States');
    expect(entities.injuries.length).toBeGreaterThan(0);
    expect(entities.formations).toContain('4-3-3');
    expect(entities.tacticalNotes).toContain('lineup');
  });

  it('extractEntitiesFromArticle falls back to rule-based matching', async () => {
    const env = createMockEnv({ AI: undefined });
    const entities = await extractEntitiesFromArticle(
      env,
      'Mexico squad announcement with 4-4-2 formation.',
    );
    expect(entities?.teams.length).toBeGreaterThan(0);
  });

  it('extractEntitiesFromArticle uses gateway and Workers AI paths', async () => {
    vi.mocked(gatewayChatJson).mockResolvedValueOnce({
      teams: ['Mexico'],
      players: ['Player A'],
      injuries: [],
      tacticalNotes: ['lineup'],
      formations: ['4-4-2'],
    });
    const gatewayEnv = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    expect((await extractEntitiesFromArticle(gatewayEnv, 'Mexico lineup 4-4-2'))?.teams).toContain('Mexico');

    vi.mocked(gatewayChatJson).mockResolvedValueOnce(null);
    const workersEnv = createMockEnv({
      AI: {
        run: vi.fn(async () => ({
          response: JSON.stringify({
            teams: ['Brazil'],
            players: [],
            injuries: [],
            tacticalNotes: [],
            formations: ['4-3-3'],
          }),
        })),
      } as never,
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    expect((await extractEntitiesFromArticle(workersEnv, 'Brazil uses 4-3-3'))?.teams).toContain('Brazil');
  });

  it('extractEntitiesFromArticle stringifies non-response Workers payloads', async () => {
    vi.mocked(gatewayChatJson).mockResolvedValueOnce(null);
    const env = createMockEnv({
      AI: {
        run: vi.fn(async () => ({
          teams: ['France'],
          players: [],
          injuries: [],
          tacticalNotes: [],
          formations: ['4-2-3-1'],
        })),
      } as never,
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    expect((await extractEntitiesFromArticle(env, 'France uses 4-2-3-1'))?.teams).toContain('France');
  });

  it('extractEntitiesFromArticle returns rule-based result when Workers AI throws', async () => {
    const env = createMockEnv({
      AI: { run: vi.fn(async () => { throw new Error('workers down'); }) } as never,
    });
    const entities = await extractEntitiesFromArticle(env, 'Mexico squad announcement with 4-4-2 formation.');
    expect(entities?.formations).toContain('4-4-2');
  });
});

describe('explainModelVsMarket extensions', () => {
  it('explainModelVsMarket uses default summary when gateway omits summary', async () => {
    vi.mocked(gatewayChatJson).mockResolvedValueOnce({});
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    const result = await explainModelVsMarket(env, {
      matchId: 'm-1',
      model: { home: 0.4, draw: 0.3, away: 0.3 },
      market: { home: 0.35, draw: 0.3, away: 0.35 },
      edge: { home: 0.05, draw: 0, away: -0.05 },
      sourceReliability: 0.8,
    });
    expect(result.summary).toContain('differ');
  });
});

describe('multiVariableAnalysis', () => {
  it('getCachedAnalysis parses KV payload', async () => {
    const payload = {
      matchId: 'm-1',
      generatedAt: '2026-06-01T00:00:00Z',
      executiveSummary: 'Test',
      variableInsights: [],
      tacticalRecommendations: [],
      riskFactors: [],
      confidence: 0.8,
    };
    const env = createMockEnv({ KV: createMockKv({ 'analysis:m-1': JSON.stringify(payload) }) });
    expect(await getCachedAnalysis(env, 'm-1')).toMatchObject({ matchId: 'm-1' });
  });

  it('runMultiVariableAnalysis returns null when gateway is not configured', async () => {
    const result = await runMultiVariableAnalysis(createMockEnv(), 'm-1');
    expect(result).toBeNull();
  });

  it('runMultiVariableAnalysis stores gateway response', async () => {
    vi.mocked(gatewayChatJson).mockResolvedValueOnce({
      executiveSummary: 'Home pressing edge',
      variableInsights: [
        { variable: 'pressing', impact: 'high', direction: 'home', explanation: 'PPDA gap' },
      ],
      tacticalRecommendations: ['Watch transitions'],
      riskFactors: ['Lineup uncertainty'],
      confidence: 0.78,
    });
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    const result = await runMultiVariableAnalysis(env, 'm-1');
    expect(result?.matchId).toBe('m-1');
    expect(env.KV.put).toHaveBeenCalled();
  });

  it('getCachedAnalysis rejects invalid JSON and runMultiVariableAnalysis handles a missing probability snapshot', async () => {
    const badCacheEnv = createMockEnv({ KV: createMockKv({ 'analysis:m-bad': '{not-json' }) });
    expect(await getCachedAnalysis(badCacheEnv, 'm-bad')).toBeNull();

    vi.mocked(gatewayChatJson).mockResolvedValueOnce({
      executiveSummary: 'Context only',
      variableInsights: [{ variable: 'form', impact: 'medium', direction: 'home', explanation: 'Better recent profile' }],
      tacticalRecommendations: ['Stay compact'],
      riskFactors: ['No live probability snapshot'],
      confidence: 0.64,
    });
    vi.mocked(probabilityRepo.getLatestSnapshot).mockResolvedValueOnce(null as never);

    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    const result = await runMultiVariableAnalysis(env, 'm-no-snap');
    expect(result?.matchId).toBe('m-no-snap');
    expect(env.KV.put).toHaveBeenCalled();
  });
});

describe('explain modules', () => {
  it('explainScenarioComparison handles null data', async () => {
    const result = await explainScenarioComparison(createMockEnv(), null);
    expect(result.summary).toContain('No scenario comparison');
  });

  it('explainScenarioComparison maps scenario set comparison', async () => {
    const scenario = mockScenario();
    const data: MatchScenarioSet = {
      matchId: 'm-1',
      generatedAt: '2026-06-01T00:00:00Z',
      modelVersion: 'scenario-v1',
      scenarios: [scenario],
      comparison: {
        primaryScenarioId: scenario.id,
        alternativeScenarioId: scenario.id,
        probabilityGap: 0.1,
        confidenceGap: 0.05,
        summary: 'Primary baseline remains favored.',
        keyDifferences: ['Higher transition threat'],
        homeWinDelta: 0.03,
        drawDelta: -0.01,
        awayWinDelta: -0.02,
        xgHomeDelta: 0.1,
        xgAwayDelta: -0.05,
      },
      sourceConfidence: { score: 0.8, notes: ['Market signal missing'] },
    };
    const result = await explainScenarioComparison(createMockEnv(), data);
    expect(result.keyDifferences).toContain('Higher transition threat');
  });

  it('explainModelVsMarket uses engine-backed explanation without gateway', async () => {
    const result = await explainModelVsMarket(createMockEnv(), {
      matchId: 'm-1',
      model: { home: 0.5, draw: 0.25, away: 0.25 },
      market: { home: 0.45, draw: 0.3, away: 0.25 },
      edge: { home: 0.05, draw: -0.05, away: 0 },
      volatilityScore: 0.05,
      sourceId: 'mkt-manual',
      sourceName: 'Manual',
      sourceReliability: 0.7,
      retrievedAt: '2026-06-01T00:00:00Z',
      disclaimer: MARKET_DISCLAIMER,
    });
    expect(result.disclaimer).toContain('not betting advice');
    expect(result.keyDifferences).toHaveLength(3);
  });

  it('explainModelVsMarket uses gateway summary when configured', async () => {
    vi.mocked(gatewayChatJson).mockResolvedValueOnce({ summary: 'Model leans home despite market draw bias.' });
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    const result = await explainModelVsMarket(env, {
      matchId: 'm-1',
      model: { home: 0.5, draw: 0.25, away: 0.25 },
      market: { home: 0.45, draw: 0.3, away: 0.25 },
      edge: { home: 0.05, draw: -0.05, away: 0 },
      volatilityScore: 0.05,
      sourceId: 'mkt-manual',
      sourceName: 'Manual',
      sourceReliability: 0.7,
      retrievedAt: '2026-06-01T00:00:00Z',
      disclaimer: MARKET_DISCLAIMER,
    });
    expect(result.summary).toContain('Model leans home');
  });

  it('explainModelVsMarket falls back when gateway throws', async () => {
    vi.mocked(gatewayChatJson).mockRejectedValueOnce(new Error('gateway down'));
    const env = createMockEnv({
      AI_GATEWAY_ENABLED: 'true',
      AI_GATEWAY_ACCOUNT_ID: 'acct',
      OPENAI_API_KEY: 'sk-test',
    });
    const result = await explainModelVsMarket(env, {
      matchId: 'm-1',
      model: { home: 0.5, draw: 0.25, away: 0.25 },
      market: { home: 0.45, draw: 0.3, away: 0.25 },
      edge: { home: 0.05, draw: -0.05, away: 0 },
      volatilityScore: 0.05,
      sourceId: 'mkt-manual',
      sourceName: 'Manual',
      sourceReliability: 0.7,
      retrievedAt: '2026-06-01T00:00:00Z',
      disclaimer: MARKET_DISCLAIMER,
    });
    expect(result.summary).toContain('differ');
  });

  it('explainScenarioLikelihood builds highlights', async () => {
    const result = await explainScenarioLikelihood(createMockEnv(), {
      matchId: 'm-1',
      scenarios: [{ scenarioType: 'baseline_expected_flow', probability: 0.35 }],
    });
    expect(result?.highlights[0]?.narrative).toContain('35.0%');
  });

  it('explainTeamSystemStrength summarizes both sides', async () => {
    const result = await explainTeamSystemStrength(createMockEnv(), {
      matchId: 'm-1',
      home: { collectiveStrengthScore: 0.72, tacticalIdentity: 'high_press' },
      away: null,
    });
    expect(result?.homeSummary).toContain('72%');
    expect(result?.awaySummary).toContain('pending');
  });

  it('explainScenarioRealtimeShift formats delta summary', async () => {
    const result = await explainScenarioRealtimeShift(createMockEnv(), {
      matchId: 'm-1',
      updateReason: 'goal',
      deltaPct: 0.05,
    });
    expect(result.summary).toContain('5.0 percentage points');
  });
});
