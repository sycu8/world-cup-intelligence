import { vi } from 'vitest';
import type { AppEnv } from '../../src/env';
import { createMockEnv, createMockKv } from './mockEnv';
import { FIXTURE_MATCH, FIXTURE_TEAMS } from './fixtures';
import { WC2026_TOURNAMENT_ID } from '../../src/constants/tournament';

export type IngestionDbState = {
  teams?: Array<{ id: string; name: string; country_code?: string | null }>;
  matches?: Array<Record<string, unknown>>;
  teamMatchStats?: Array<Record<string, unknown>>;
  matchCommentary?: Array<Record<string, unknown>>;
  players?: Array<Record<string, unknown>>;
  batchCalls?: unknown[][];
  runCalls?: Array<{ sql: string; binds: unknown[] }>;
};

export function createIngestionDb(state: IngestionDbState = {}) {
  const teams = state.teams ?? FIXTURE_TEAMS.map((t) => ({
    id: t.id,
    name: t.name,
    country_code: t.country_code,
  }));
  const matches = state.matches ?? [
    {
      ...FIXTURE_MATCH,
      fifa_match_id: FIXTURE_MATCH.fifa_match_id,
    },
  ];
  const teamMatchStats = state.teamMatchStats ?? [];
  const matchCommentary = state.matchCommentary ?? [];
  const players = state.players ?? [];
  const batchCalls: unknown[][] = state.batchCalls ?? [];
  const runCalls: Array<{ sql: string; binds: unknown[] }> = state.runCalls ?? [];

  const batch = vi.fn(async (stmts: unknown[]) => {
    batchCalls.push(stmts);
  });

  const prepare = vi.fn((sql: string) => {
    const binds: unknown[] = [];
    const stmt = {
      bind: (...args: unknown[]) => {
        binds.push(...args);
        return stmt;
      },
      first: async <T>() => {
        if (sql.includes('FROM teams WHERE id LIKE')) {
          return null;
        }
        if (sql.includes('SELECT id, name FROM teams WHERE id LIKE')) {
          return null;
        }
        if (sql.includes('FROM teams WHERE id = ?') && sql.includes('country_code')) {
          const id = String(binds[0]);
          return (teams.find((t) => t.id === id) ?? null) as T | null;
        }
        if (sql.includes('FROM teams WHERE id IN')) {
          return null;
        }
        if (sql.includes('FROM teams WHERE id = ?')) {
          return (teams.find((t) => t.id === binds[0]) ?? null) as T | null;
        }
        if (
          sql.includes('FROM matches WHERE id = ?') &&
          !sql.includes('fifa_match_id FROM') &&
          sql.includes('home_team_id')
        ) {
          const id = String(binds[0]);
          return (matches.find((m) => m.id === id) ?? null) as T | null;
        }
        if (sql.includes('FROM matches WHERE id = ?') && !sql.includes('fifa_match_id FROM')) {
          const id = String(binds[0]);
          const row = matches.find((m) => m.id === id);
          if (!row) return null;
          if (sql.includes('minute') && sql.includes('home_score')) {
            return row as T;
          }
          return row as T | null;
        }
        if (sql.includes('SELECT fifa_match_id FROM matches WHERE id = ?')) {
          const id = String(binds[0]);
          const row = matches.find((m) => m.id === id);
          return row ? ({ fifa_match_id: row.fifa_match_id ?? null } as T) : null;
        }
        if (sql.includes('SELECT kickoff_utc FROM matches WHERE id = ?')) {
          const id = String(binds[0]);
          const row = matches.find((m) => m.id === id);
          return row ? ({ kickoff_utc: row.kickoff_utc ?? null } as T) : null;
        }
        if (sql.includes('SELECT home_team_id, away_team_id FROM matches WHERE id = ?')) {
          const id = String(binds[0]);
          const row = matches.find((m) => m.id === id);
          return row
            ? ({
                home_team_id: row.home_team_id,
                away_team_id: row.away_team_id,
              } as T)
            : null;
        }
        if (sql.includes('SELECT 1 FROM match_commentary WHERE match_id = ?')) {
          const id = String(binds[0]);
          return matchCommentary.some((c) => c.match_id === id) ? ({ 1: 1 } as T) : null;
        }
        if (sql.includes('SELECT id FROM team_match_stats WHERE match_id = ? AND team_id = ?')) {
          const [matchId, teamId] = binds;
          const hit = teamMatchStats.find((s) => s.match_id === matchId && s.team_id === teamId);
          return hit ? ({ id: hit.id ?? `tms-${matchId}-${teamId}` } as T) : null;
        }
        if (sql.includes('SELECT id FROM matches WHERE id = ?') && sql.includes('statsbomb')) {
          const id = String(binds[0]);
          const row = matches.find((m) => m.id === id);
          return row ? ({ id: row.id } as T) : null;
        }
        if (sql.includes('SELECT id FROM players WHERE id = ?')) {
          const id = String(binds[0]);
          return players.find((p) => p.id === id) ? ({ id } as T) : null;
        }
        if (sql.includes('SELECT id FROM matches WHERE id = ?')) {
          const id = String(binds[0]);
          return matches.find((m) => m.id === id) ? ({ id } as T) : null;
        }
        return null;
      },
      all: async <T>() => {
        if (sql.includes('SELECT id, name FROM teams WHERE id LIKE')) {
          return { results: teams } as { results?: T[] };
        }
        if (sql.includes('fifa_match_id IS NOT NULL') && sql.includes('FROM matches')) {
          return {
            results: matches.filter(
              (m) =>
                m.fifa_match_id &&
                m.tournament_id === WC2026_TOURNAMENT_ID &&
                ['live', 'completed'].includes(String(m.status)),
            ),
          } as { results?: T[] };
        }
        if (sql.includes('FROM matches WHERE tournament_id = ?') && sql.includes("status IN ('scheduled', 'live')")) {
          return { results: matches.filter((m) => ['scheduled', 'live'].includes(String(m.status))) } as {
            results?: T[];
          };
        }
        if (sql.includes('SELECT id, kickoff_utc, status FROM matches')) {
          return { results: matches } as { results?: T[] };
        }
        if (sql.includes('FROM matches WHERE tournament_id = ?') && sql.includes('home_team_id')) {
          return { results: matches.filter((m) => m.tournament_id === WC2026_TOURNAMENT_ID) } as {
            results?: T[];
          };
        }
        if (sql.includes('SELECT id, name FROM teams WHERE id IN')) {
          const ids = binds as string[];
          return {
            results: teams.filter((t) => ids.includes(t.id)),
          } as { results?: T[] };
        }
        if (sql.includes('SELECT team_id, possession, passes')) {
          const [matchId, homeId, awayId] = binds;
          const rows = teamMatchStats.filter(
            (s) => s.match_id === matchId && (s.team_id === homeId || s.team_id === awayId),
          );
          return { results: rows } as { results?: T[] };
        }
        if (sql.includes('SELECT id, minute, home_score, away_score, status, kickoff_utc')) {
          return { results: matches } as { results?: T[] };
        }
        return { results: [] } as { results?: T[] };
      },
      run: async () => {
        runCalls.push({ sql, binds: [...binds] });
        if (sql.includes('UPDATE matches SET fifa_match_id = ?') && binds.length === 2) {
          const id = binds[1];
          const row = matches.find((m) => m.id === id);
          if (row) row.fifa_match_id = binds[0];
        }
        return { success: true };
      },
    };
    return stmt;
  });

  return {
    db: { prepare, batch } as unknown as AppEnv['DB'],
    batch,
    prepare,
    batchCalls,
    runCalls,
    teams,
    matches,
    teamMatchStats,
    matchCommentary,
    players,
  };
}

export function createIngestionEnv(
  dbState: IngestionDbState = {},
  kvInitial: Record<string, string> = {},
): { env: AppEnv; db: ReturnType<typeof createIngestionDb> } {
  const db = createIngestionDb(dbState);
  const env = createMockEnv({
    DB: db.db,
    KV: createMockKv(kvInitial),
    R2_RAW: { put: vi.fn(async () => undefined) } as unknown as AppEnv['R2_RAW'],
    MOCK_SOURCES: 'false',
    FIFA_LIVE_ENABLED: 'true',
    ENVIRONMENT: 'test',
    AI_FALLBACK_MODE: 'false',
    VECTORIZE_FALLBACK_MODE: 'false',
    CORS_ORIGINS: '',
  });
  return { env, db, teamMatchStats: db.teamMatchStats, matches: db.matches };
}
