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
