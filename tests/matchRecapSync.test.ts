import { execFileSync } from 'node:child_process';
import { describe, it, expect, vi } from 'vitest';
import {
  commentaryNeedsFullRetranslate,
  COMMENTARY_RETRANSLATE_RATIO,
  MATCH_COMMENTARY_UPSERT_SQL,
  translateAndStoreCommentary,
} from '../src/ingestion/fifa/matchRecapSync';
import type { AppEnv } from '../src/env';
import type { ParsedCommentaryLine } from '../src/ingestion/fifa/parseFifaTimeline';

vi.mock('../src/ai/translateMatchRecap', () => ({
  translateCommentaryLines: vi.fn(async (_env: unknown, lines: Array<{ textEn: string }>) =>
    lines.map((line) => `vi:${line.textEn}`),
  ),
  translateMatchRecapSummary: vi.fn(),
}));

describe('commentaryNeedsFullRetranslate', () => {
  it('requires sync when commentary is missing', () => {
    expect(commentaryNeedsFullRetranslate(0, 0)).toBe(true);
  });

  it('skips full retranslate when only a few lines are still English', () => {
    expect(commentaryNeedsFullRetranslate(45, 3)).toBe(false);
  });

  it('retranslates when most lines are still English', () => {
    const threshold = Math.ceil(20 * COMMENTARY_RETRANSLATE_RATIO);
    expect(commentaryNeedsFullRetranslate(20, threshold)).toBe(true);
  });
});

describe('translateAndStoreCommentary', () => {
  it('updates an existing commentary id instead of failing the unique constraint', async () => {
    const prepared: Array<{ sql: string; binds: unknown[] }> = [];
    const db = {
      prepare(sql: string) {
        const rec = { sql, binds: [] as unknown[] };
        const stmt = {
          bind(...args: unknown[]) {
            rec.binds.push(...args);
            return stmt;
          },
          async all() {
            return { results: [{ id: 'mc-fifa-m-1-9', text_vi: 'vi:old' }] };
          },
          async run() {
            prepared.push(rec);
            return {};
          },
          statement: rec,
        };
        return stmt;
      },
      async batch(stmts: Array<{ statement: { sql: string; binds: unknown[] } }>) {
        prepared.push(...stmts.map((stmt) => stmt.statement));
      },
    };

    const line: ParsedCommentaryLine = {
      id: 'mc-fifa-m-1-9',
      minute: 9,
      period: '1H',
      sortOrder: 1,
      textEn: 'Goal',
      eventType: 'goal',
    };
    const stored = await translateAndStoreCommentary({ DB: db } as unknown as AppEnv, 'm-1', [line]);
    expect(stored).toBe(1);

    const insert = prepared.find((call) => call.sql === MATCH_COMMENTARY_UPSERT_SQL);
    expect(insert?.sql).toContain('ON CONFLICT(id) DO UPDATE SET');
    expect(insert?.binds).toEqual([
      'mc-fifa-m-1-9',
      'm-1',
      9,
      '1H',
      1,
      'vi:Goal',
      'Goal',
      'goal',
      'src-fifa',
    ]);

    const proof = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', UPSERT_PROOF],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          UPSERT_SQL: MATCH_COMMENTARY_UPSERT_SQL,
          UPSERT_BINDS: JSON.stringify(insert?.binds ?? []),
        },
      },
    );
    expect(JSON.parse(proof)).toEqual({
      plainThrew: true,
      row: { match_id: 'm-1', text_en: 'Goal', text_vi: 'vi:Goal' },
    });
  });
});

const UPSERT_PROOF = `
import { DatabaseSync } from 'node:sqlite';
const binds = JSON.parse(process.env.UPSERT_BINDS);
const db = new DatabaseSync(':memory:');
db.exec(\`CREATE TABLE match_commentary (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  minute INTEGER,
  period TEXT,
  sort_order INTEGER NOT NULL,
  text_vi TEXT NOT NULL,
  text_en TEXT NOT NULL,
  event_type TEXT,
  source_id TEXT
)\`);
const plain = \`INSERT INTO match_commentary (
  id, match_id, minute, period, sort_order, text_vi, text_en, event_type, source_id
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`;
db.prepare(plain).run('mc-fifa-m-1-9', 'm-other', 1, '1H', 1, 'stale', 'Old', 'chance', 'src-fifa');
let plainThrew = false;
try {
  db.prepare(plain).run(...binds);
} catch (error) {
  plainThrew = String(error).includes('UNIQUE constraint failed');
}
db.prepare(process.env.UPSERT_SQL).run(...binds);
const row = db.prepare('SELECT match_id, text_en, text_vi FROM match_commentary WHERE id = ?').get('mc-fifa-m-1-9');
process.stdout.write(JSON.stringify({ plainThrew, row }));
`;
