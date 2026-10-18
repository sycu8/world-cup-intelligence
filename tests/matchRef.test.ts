import { describe, expect, it } from 'vitest';
import { WC2026_TOURNAMENT_ID } from '../src/constants/tournament';
import {
  attachSlugToScheduleRow,
  listMatchesWithSlug,
  resolveMatchRef,
} from '../src/services/matchRef';
import { createMockDb, createMockKv } from './helpers/mockEnv';

const matchRow = {
  id: 'm-w26-ga-1v2',
  tournament_id: WC2026_TOURNAMENT_ID,
  stage: 'Group',
  group_code: 'A',
  home_team_id: 't-usa',
  away_team_id: 't-mex',
  venue_id: null,
  kickoff_utc: '2026-06-15T18:00:00.000Z',
  status: 'scheduled',
  minute: 0,
  home_score: 0,
  away_score: 0,
  home_xg: 0,
  away_xg: 0,
  home_name: 'United States',
  away_name: 'Mexico',
  home_short: 'USA',
  away_short: 'MEX',
  home_country_code: 'US',
  away_country_code: 'MX',
};

const slug = 'vong-bang-a-united-states-vs-mexico';

function dbForMatchRef(opts: {
  byId?: Record<string, unknown> | null;
  allMatches?: Array<Record<string, unknown>>;
}) {
  return createMockDb({
    first: (sql, binds) => {
      if (sql.includes('m.id = ?')) {
        const id = String(binds[binds.length - 1] ?? '');
        return opts.byId?.[id] ?? null;
      }
      return null;
    },
    all: () => ({ results: opts.allMatches ?? [matchRow] }),
  });
}

describe('resolveMatchRef', () => {
  it('returns cached match ref from KV without hitting D1', async () => {
    const kv = createMockKv({
      [`cache:match-ref:${slug}`]: JSON.stringify({ ...matchRow, slug }),
    });
    const db = dbForMatchRef({});

    const result = await resolveMatchRef(db, slug, kv);
    expect(result?.id).toBe('m-w26-ga-1v2');
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('resolves legacy internal ids directly', async () => {
    const kv = createMockKv();
    const db = dbForMatchRef({ byId: { 'm-w26-ga-1v2': matchRow } });

    const result = await resolveMatchRef(db, 'm-w26-ga-1v2', kv);

    expect(result?.slug).toBe(slug);
    expect(kv.put).toHaveBeenCalledWith(
      'cache:match-ref:m-w26-ga-1v2',
      expect.any(String),
      { expirationTtl: 300 },
    );
  });

  it('resolves slug refs via cached slug index', async () => {
    const kv = createMockKv({
      'cache:match-slug-index': JSON.stringify({ [slug]: 'm-w26-ga-1v2' }),
    });
    const db = dbForMatchRef({ byId: { 'm-w26-ga-1v2': matchRow } });

    const result = await resolveMatchRef(db, slug, kv);

    expect(result?.id).toBe('m-w26-ga-1v2');
    expect(kv.put).toHaveBeenCalledWith(
      `cache:match-ref:${slug}`,
      expect.any(String),
      { expirationTtl: 300 },
    );
  });

  it('builds slug index from D1 when KV index is missing', async () => {
    const kv = createMockKv();
    const db = dbForMatchRef({
      allMatches: [matchRow],
      byId: { 'm-w26-ga-1v2': matchRow },
    });

    const result = await resolveMatchRef(db, slug, kv);

    expect(result?.slug).toBe(slug);
    expect(kv.put).toHaveBeenCalledWith(
      'cache:match-slug-index',
      JSON.stringify({ [slug]: 'm-w26-ga-1v2' }),
      { expirationTtl: 600 },
    );
  });

  it('returns null when slug is unknown', async () => {
    const kv = createMockKv();
    const db = dbForMatchRef({ allMatches: [matchRow], byId: {} });

    expect(await resolveMatchRef(db, 'unknown-slug', kv)).toBeNull();
  });

  it('returns null when slug index points to a missing match', async () => {
    const kv = createMockKv({
      'cache:match-slug-index': JSON.stringify({ [slug]: 'm-missing' }),
    });
    const db = dbForMatchRef({ byId: {} });

    expect(await resolveMatchRef(db, slug, kv)).toBeNull();
  });

  it('builds slug index when D1 returns no rows', async () => {
    const kv = createMockKv();
    const db = createMockDb({
      all: () => ({}),
      first: () => null,
    });

    expect(await resolveMatchRef(db, slug, kv)).toBeNull();
    expect(kv.put).toHaveBeenCalledWith('cache:match-slug-index', '{}', { expirationTtl: 600 });
  });

  it('works without KV namespace', async () => {
    const db = dbForMatchRef({
      allMatches: [matchRow],
      byId: { 'm-w26-ga-1v2': matchRow },
    });

    const result = await resolveMatchRef(db, slug);
    expect(result?.id).toBe('m-w26-ga-1v2');
  });

  it('returns null for unknown legacy id', async () => {
    const db = dbForMatchRef({ byId: {} });
    expect(await resolveMatchRef(db, 'm-missing')).toBeNull();
  });
});

describe('listMatchesWithSlug', () => {
  it('maps all tournament matches with generated slugs', async () => {
    const db = dbForMatchRef({ allMatches: [matchRow] });
    const rows = await listMatchesWithSlug(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe(slug);
  });

  it('preserves slug when row already includes one', async () => {
    const db = dbForMatchRef({
      allMatches: [{ ...matchRow, slug: 'custom-slug' }],
    });
    const rows = await listMatchesWithSlug(db);
    expect(rows[0].slug).toBe('custom-slug');
  });
});

describe('attachSlugToScheduleRow', () => {
  it('adds slug from team and stage fields', () => {
    const row = attachSlugToScheduleRow({
      stage: 'Group',
      group_code: 'A',
      home_name: 'United States',
      away_name: 'Mexico',
      extra: 1,
    });

    expect(row.slug).toBe(slug);
    expect(row.extra).toBe(1);
  });

  it('handles missing names with empty slug segments', () => {
    const row = attachSlugToScheduleRow({ stage: null, group_code: null });
    expect(row.slug).toBe('vong-dau-team-vs-team');
  });
});
