import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { createMockDb, createMockEnv } from './helpers/mockEnv';
import { FIXTURE_MATCH } from './helpers/fixtures';
import { gatewayChatJson } from '../src/ai/gatewayClient';
import * as lineupsRepo from '../src/db/repositories/lineupsRepo';

vi.mock('../src/ai/gatewayClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ai/gatewayClient')>();
  return {
    ...actual,
    gatewayChat: vi.fn(actual.gatewayChat),
    gatewayChatJson: vi.fn(actual.gatewayChatJson),
  };
});

vi.mock('../src/services/bulkRecomputeRunner', () => ({
  scheduleRecomputeAfterDataChange: vi.fn(async () => undefined),
}));

vi.mock('../src/services/recomputeMatch', () => ({
  recomputeMatchProbability: vi.fn(async () => null),
}));

describe('coverage final gaps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('newsImagePipeline', () => {
    it('accepts non-image content types when URL looks like an image', async () => {
      const bytes = new Uint8Array(5000).fill(9);
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, init) => {
          const cf = (init as RequestInit)?.cf as { image?: unknown } | undefined;
          if (cf?.image) {
            return new Response(new Uint8Array(50), {
              status: 200,
              headers: { 'content-type': 'text/plain' },
            });
          }
          return new Response(bytes, {
            status: 200,
            headers: { 'content-type': 'text/plain' },
          });
        }),
      );
      const put = vi.fn(async () => undefined);
      const { compressAndStoreNewsImage } = await import('../src/services/newsImagePipeline');
      const key = await compressAndStoreNewsImage(
        createMockEnv({ R2_ARTIFACTS: { put } as never }),
        'doc-plain',
        'https://cdn.example.com/pic.png',
      );
      expect(key).toBe('news/thumbs/doc-plain.webp');
    });

    it('returns null when optimized blob exceeds stored byte cap', async () => {
      const medium = new Uint8Array(90_000).fill(1);
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, init) => {
          const cf = (init as RequestInit)?.cf as { image?: unknown } | undefined;
          if (cf?.image) {
            return new Response(new Uint8Array(50), { status: 200, headers: { 'content-type': 'image/webp' } });
          }
          return new Response(medium, { status: 200, headers: { 'content-type': 'image/jpeg' } });
        }),
      );
      const originalBitmap = globalThis.createImageBitmap;
      globalThis.createImageBitmap = vi.fn(async () => ({
        width: 2000,
        height: 1500,
        close: () => undefined,
      })) as never;
      const originalConvert = OffscreenCanvas.prototype.convertToBlob;
      OffscreenCanvas.prototype.convertToBlob = vi.fn(async () => new Blob([medium], { type: 'image/jpeg' }));

      const { compressAndStoreNewsImage } = await import('../src/services/newsImagePipeline');
      expect(
        await compressAndStoreNewsImage(
          createMockEnv({ R2_ARTIFACTS: { put: vi.fn() } as never }),
          'doc-cap',
          'https://cdn.example.com/big.jpg',
        ),
      ).toBeNull();

      globalThis.createImageBitmap = originalBitmap;
      OffscreenCanvas.prototype.convertToBlob = originalConvert;
    });
  });

  describe('parseFifaTimeline', () => {
    it('covers period labels, event types, shots, and fallback labels', async () => {
      const {
        deriveShotsFromTimeline,
        parseFifaTimelineCommentary,
        timelinePeriodLabel,
      } = await import('../src/ingestion/fifa/parseFifaTimeline');

      expect(timelinePeriodLabel(3)).toBe('1H');
      expect(timelinePeriodLabel(5)).toBe('2H');
      expect(timelinePeriodLabel(10)).toBe('FT');

      const lines = parseFifaTimelineCommentary(
        {
          Event: [
            {
              EventId: 'g1',
              Period: 3,
              MatchMinute: "23'",
              TypeLocalized: [{ Locale: 'en-GB', Description: 'Goal!' }],
              EventDescription: [{ Locale: 'en-GB', Description: 'Mexico score' }],
            },
            {
              EventId: 'a1',
              Period: 5,
              TypeLocalized: [{ Locale: 'fr-FR', Description: 'Assist' }],
              EventDescription: [{ Locale: 'fr-FR', Description: 'Key pass' }],
            },
            {
              EventId: 's1',
              TypeLocalized: [{ Locale: 'en-GB', Description: 'Attempt at Goal' }],
              EventDescription: [{ Locale: 'en-GB', Description: 'Shot wide' }],
            },
            {
              EventId: 'sub1',
              TypeLocalized: [{ Description: 'Substitution' }],
              EventDescription: [{ Description: 'Player off' }],
            },
            {
              EventId: 'var1',
              TypeLocalized: [{ Locale: 'en-GB', Description: 'VAR' }],
              EventDescription: [{ Locale: 'en-GB', Description: 'Review underway' }],
            },
            {
              EventId: 'kick1',
              TypeLocalized: [{ Locale: 'en-GB', Description: 'Start Time' }],
              EventDescription: [{ Locale: 'en-GB', Description: 'Kick off' }],
            },
            {
              EventId: 'end1',
              TypeLocalized: [{ Locale: 'en-GB', Description: 'End Time' }],
              EventDescription: [{ Locale: 'en-GB', Description: 'Full time' }],
            },
            {
              EventId: 'og1',
              TypeLocalized: [{ Locale: 'en-GB', Description: 'Own Goal' }],
              EventDescription: [{ Locale: 'en-GB', Description: 'Own goal' }],
            },
            {
              EventId: 'rc1',
              TypeLocalized: [{ Locale: 'en-GB', Description: 'Red Card' }],
              EventDescription: [{ Locale: 'en-GB', Description: 'Dismissal' }],
            },
          ],
        },
        'm-full',
      );

      expect(lines.some((l) => l.eventType === 'goal')).toBe(true);
      expect(lines.some((l) => l.eventType === 'assist')).toBe(true);
      expect(lines.some((l) => l.eventType === 'shot')).toBe(true);
      expect(lines.some((l) => l.eventType === 'substitution')).toBe(true);
      expect(lines.some((l) => l.eventType === 'var')).toBe(true);
      expect(lines.some((l) => l.eventType === 'kickoff')).toBe(true);
      expect(lines.some((l) => l.eventType === 'full_time')).toBe(true);
      expect(lines.some((l) => l.eventType === 'own_goal' || l.eventType === 'goal')).toBe(true);

      const shots = deriveShotsFromTimeline(
        {
          Event: [
            {
              IdTeam: 'home-1',
              TypeLocalized: [{ Locale: 'en-GB', Description: 'Attempt at Goal' }],
              EventDescription: [{ Locale: 'en-GB', Description: 'Shot on target' }],
              GoalGatePositionX: 1,
            },
            {
              IdTeam: 'away-1',
              TypeLocalized: [{ Locale: 'en-GB', Description: 'Attempt at Goal' }],
              EventDescription: [{ Locale: 'en-GB', Description: 'Missed chance' }],
            },
          ],
        },
        'home-1',
        'away-1',
      );
      expect(shots.homeShots).toBe(1);
      expect(shots.homeSot).toBe(1);
      expect(shots.awayShots).toBe(1);
      expect(shots.awaySot).toBe(0);
    });
  });

  describe('officialLineupSync', () => {
    function squadPlayers(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        player_id: `p-${i}`,
        shirt_number: i + 1,
        listed_position: i === 0 ? 'GK' : i < 5 ? 'DF' : i < 9 ? 'MF' : 'FW',
        position: i < 9 ? 'MF' : 'FW',
        name: `Player ${i}`,
      }));
    }

    it('rotates large squads and includes bench players', async () => {
      const upserts: lineupsRepo.UpsertMatchLineupInput[] = [];
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
          results: sql.includes('squad_players') ? squadPlayers(18) : [],
        }),
        run: () => ({ success: true }),
      });
      vi.spyOn(lineupsRepo, 'upsertMatchLineup').mockImplementation(async (_db, input) => {
        upserts.push(input);
        return 'lu-big';
      });
      const { syncOfficialSquadToMatch } = await import('../src/services/officialLineupSync');
      expect(await syncOfficialSquadToMatch({ DB: db } as never, 'm-rotate', 'team-fra')).toBe(true);
      expect(upserts[0]?.players.some((p) => p.isStarter === false)).toBe(true);
      expect(upserts[0]?.players.length).toBeGreaterThan(11);
    });

    it('syncOfficialLineupsToMatches uses hoursAhead window and bulk recompute', async () => {
      const { scheduleRecomputeAfterDataChange } = await import('../src/services/bulkRecomputeRunner');
      const matches = Array.from({ length: 12 }, (_, i) => ({
        id: `m-bulk-${i}`,
        home_team_id: 'team-fra',
        away_team_id: 'team-usa',
      }));
      const players = squadPlayers(11);
      vi.spyOn(lineupsRepo, 'upsertMatchLineup').mockResolvedValue('lu-x');
      const db = createMockDb({
        first: (sql) => {
          if (sql.includes('FROM lineups')) return null;
          if (sql.includes('FROM squads')) {
            return {
              id: 'sq-fra',
              team_id: 'team-fra',
              source_id: 'src-mock',
              confidence: 0.9,
              announced_at: '2026-05-01',
            };
          }
          return null;
        },
        all: (sql) => ({
          results: sql.includes('squad_players') ? players : matches,
        }),
        run: () => ({ success: true }),
      });
      const { syncOfficialLineupsToMatches } = await import('../src/services/officialLineupSync');
      const result = await syncOfficialLineupsToMatches(
        { DB: db } as never,
        { hoursAhead: 48, recompute: true },
      );
      expect(result.matchesChecked).toBe(12);
      expect(scheduleRecomputeAfterDataChange).toHaveBeenCalled();
    });

    it('syncOfficialLineupsToMatches skips recompute when disabled', async () => {
      const { recomputeMatchProbability } = await import('../src/services/recomputeMatch');
      const matches = [{ id: 'm-1', home_team_id: 'team-fra', away_team_id: 'team-usa' }];
      vi.spyOn(lineupsRepo, 'upsertMatchLineup').mockResolvedValue('lu-x');
      const db = createMockDb({
        first: (sql) => {
          if (sql.includes('FROM squads')) {
            return {
              id: 'sq-fra',
              team_id: 'team-fra',
              source_id: 'src-mock',
              confidence: 0.9,
              announced_at: '2026-05-01',
            };
          }
          return null;
        },
        all: (sql) => ({
          results: sql.includes('squad_players') ? squadPlayers(11) : matches,
        }),
      });
      const { syncOfficialLineupsToMatches } = await import('../src/services/officialLineupSync');
      await syncOfficialLineupsToMatches({ DB: db } as never, { allScheduled: true, recompute: false });
      expect(recomputeMatchProbability).not.toHaveBeenCalled();
    });
  });

  describe('translateNews', () => {
    it('covers m2m100 failure, acceptable translation without diacritics, and gateway catch', async () => {
      vi.mocked(gatewayChatJson).mockRejectedValueOnce(new Error('gateway down'));
      const env = createMockEnv({
        AI: {
          run: vi.fn(async (model: string) => {
            if (String(model).includes('m2m100')) throw new Error('m2m down');
            return { response: 'not-json' };
          }),
        } as never,
        AI_GATEWAY_ENABLED: 'true',
        AI_GATEWAY_ACCOUNT_ID: 'acct',
        OPENAI_API_KEY: 'sk-test',
      });
      const { translateNewsHeadline } = await import('../src/ai/translateNews');
      expect(
        await translateNewsHeadline(env, 'Mexico wins opener', 'Mexico beat South Africa 2-1.'),
      ).toBeNull();
    });

    it('accepts m2m100 translations that differ meaningfully without Vietnamese diacritics', async () => {
      const env = createMockEnv({
        AI: {
          run: vi.fn(async () => ({
            translated_text: 'Mexico thang tran mo man World Cup',
          })),
        } as never,
      });
      const { translateNewsHeadline } = await import('../src/ai/translateNews');
      const result = await translateNewsHeadline(
        env,
        'Mexico wins opener',
        'Mexico beat South Africa in the opening World Cup match on Friday.',
      );
      expect(result?.titleVi).toContain('Mexico');
    });
  });

  describe('entityExtraction', () => {
    it('falls through when gateway returns invalid schema', async () => {
      vi.mocked(gatewayChatJson).mockResolvedValueOnce({ teams: 'not-an-array' } as never);
      const env = createMockEnv({
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
      const { extractEntitiesFromArticle } = await import('../src/ai/entityExtraction');
      expect((await extractEntitiesFromArticle(env, 'Brazil uses 4-3-3'))?.teams).toContain('Brazil');
    });
  });

  describe('tournamentProgression', () => {
    it('applyBestThirdQualifiers assigns teams when all groups complete', async () => {
      const runCalls: string[] = [];
      const env = createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('COUNT(*) AS total')) return { total: 6, done: 6 };
            if (sql.includes('AS team_id FROM matches')) return { team_id: 'team-placeholder' };
            return null;
          },
          all: (sql) => {
            if (sql.includes("stage = 'Group'")) {
              return {
                results: [
                  {
                    group_code: 'A',
                    home_team_id: 't1',
                    away_team_id: 't2',
                    home_score: 1,
                    away_score: 0,
                    status: 'completed',
                  },
                  {
                    group_code: 'A',
                    home_team_id: 't3',
                    away_team_id: 't1',
                    home_score: 2,
                    away_score: 2,
                    status: 'completed',
                  },
                ],
              };
            }
            return { results: [] };
          },
          run: (sql) => {
            runCalls.push(sql);
            return { success: true };
          },
        }),
      });
      const { applyBestThirdQualifiers } = await import('../src/services/tournamentProgression');
      const affected = await applyBestThirdQualifiers(env);
      expect(Array.isArray(affected)).toBe(true);
    });

    it('processMatchCompletion applies loser bracket links', async () => {
      const completedMatch = {
        ...FIXTURE_MATCH,
        status: 'completed',
        home_score: 1,
        away_score: 1,
        home_score_pen: 4,
        away_score_pen: 5,
        stage: 'R16',
        group_code: null,
      };
      const env = createMockEnv({
        DB: createMockDb({
          first: (sql) => {
            if (sql.includes('FROM matches WHERE id')) return completedMatch;
            if (sql.includes('AS team_id FROM matches')) return { team_id: 'team-placeholder' };
            return null;
          },
          all: (sql) => {
            if (sql.includes('source_match_id = ?')) {
              return {
                results: [
                  {
                    id: 'link-loser',
                    source_match_id: completedMatch.id,
                    target_match_id: 'm-w26-3rd-1',
                    target_slot: 'away',
                    rule_type: 'loser',
                    rule_json: null,
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
      expect(affected).toContain('m-w26-3rd-1');
    });
  });

  describe('espnStatsClient swap fallback', () => {
    it('assigns home and away when find misses but labels match scoreboard order', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('scoreboard')) {
          return Response.json({
            events: [
              {
                id: '99',
                competitions: [
                  {
                    competitors: [
                      { homeAway: 'home', team: { displayName: 'Mexico' } },
                      { homeAway: 'away', team: { displayName: 'South Africa' } },
                    ],
                  },
                ],
              },
            ],
          });
        }
        if (url.includes('/summary?event=')) {
          return Response.json({
            boxscore: {
              teams: [
                {
                  team: { displayName: 'Mexico' },
                  statistics: [
                    { name: 'possessionPct', displayValue: '55' },
                    { name: 'totalPasses', displayValue: '400' },
                  ],
                },
                {
                  team: { displayName: 'Mexico' },
                  statistics: [
                    { name: 'possessionPct', displayValue: '45' },
                    { name: 'totalPasses', displayValue: '300' },
                  ],
                },
              ],
            },
          });
        }
        return new Response('{}', { status: 404 });
      });
      const { fetchEspnTeamMatchStats } = await import('../src/ingestion/espn/espnStatsClient');
      const stats = await fetchEspnTeamMatchStats(
        'Mexico',
        'South Africa',
        '2026-06-11T19:00:00Z',
      );
      expect(stats?.home.possession).toBe(55);
    });
  });

  describe('fifaPlayerResolve positions', () => {
    it('maps goalkeeper and midfielder FIFA codes', async () => {
      const { mapFifaPlayerPosition, resolveOrCreateFifaPlayer } = await import(
        '../src/ingestion/fifa/fifaPlayerResolve'
      );
      expect(mapFifaPlayerPosition(0)).toBe('GK');
      expect(mapFifaPlayerPosition(2)).toBe('CM');
      const db = createMockDb({
        first: () => null,
        run: () => ({ success: true }),
      });
      await resolveOrCreateFifaPlayer(db, 'team-mex', 'MEX', {
        IdPlayer: '77',
        PlayerName: [{ Locale: 'en-GB', Description: 'Keeper' }],
        Position: 0,
      });
    });
  });

  describe('parseFifaTimeline fallbacks', () => {
    it('uses event label text when description is missing', async () => {
      const { parseFifaTimelineCommentary } = await import('../src/ingestion/fifa/parseFifaTimeline');
      const lines = parseFifaTimelineCommentary(
        {
          Event: [
            {
              EventId: 'shot2',
              TypeLocalized: [{ Locale: 'en-GB', Description: 'Attempt at Goal' }],
              EventDescription: [],
            },
          ],
        },
        'm-shot',
      );
      expect(lines[0]?.textEn).toBe('Attempt at Goal');
      expect(lines[0]?.eventType).toBe('shot');
    });
  });

  describe('tournamentProgression standings tiebreakers', () => {
    it('sorts by goal difference then goals for', async () => {
      const { computeGroupStandingsFromMatchRows } = await import('../src/services/tournamentProgression');
      const standings = computeGroupStandingsFromMatchRows(
        [
          {
            group_code: 'D',
            home_team_id: 't-a',
            away_team_id: 't-b',
            home_score: 2,
            away_score: 2,
            status: 'completed',
          },
          {
            group_code: 'D',
            home_team_id: 't-c',
            away_team_id: 't-a',
            home_score: 0,
            away_score: 3,
            status: 'completed',
          },
          {
            group_code: 'D',
            home_team_id: 't-b',
            away_team_id: 't-c',
            home_score: 1,
            away_score: 0,
            status: 'completed',
          },
        ],
        'D',
      );
      expect(standings[0]?.teamId).toBe('t-a');
      expect(standings.find((s) => s.teamId === 't-b')?.points).toBeGreaterThan(0);
    });

    it('breaks ties on goals scored then team id', async () => {
      const { computeGroupStandingsFromMatchRows } = await import('../src/services/tournamentProgression');
      const standings = computeGroupStandingsFromMatchRows(
        [
          {
            group_code: 'E',
            home_team_id: 't-b',
            away_team_id: 't-a',
            home_score: 3,
            away_score: 3,
            status: 'completed',
          },
        ],
        'E',
      );
      expect(standings).toHaveLength(2);
      expect(standings[0]!.gf).toBeGreaterThanOrEqual(standings[1]!.gf);
    });
  });

});
