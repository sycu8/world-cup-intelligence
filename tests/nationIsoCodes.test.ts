import { describe, expect, it } from 'vitest';
import { GROUPS } from '../scripts/fifa-wc2026-official-data.mjs';
import { NATION_ISO, nationMeta } from '../scripts/nationIsoCodes.mjs';

const FIFA_2026_TEAMS = Object.values(GROUPS).flat();

describe('nationIsoCodes', () => {
  it('uses ISO 3166-1 alpha-2 codes, not name-prefix slices', () => {
    expect(nationMeta('United States').iso).toBe('US');
    expect(nationMeta('Mexico').iso).toBe('MX');
    expect(nationMeta('Czechia').iso).toBe('CZ');
    expect(nationMeta('Curaçao').iso).toBe('CW');
    expect(nationMeta('Cabo Verde').iso).toBe('CV');
    expect(nationMeta('Senegal').iso).toBe('SN');
    expect(nationMeta('Sweden').iso).toBe('SE');
    expect(nationMeta('Austria').iso).toBe('AT');
    expect(nationMeta('Switzerland').iso).toBe('CH');
    expect(nationMeta('Algeria').iso).toBe('DZ');
  });

  it('keeps FIFA short codes unique among all 48 teams (GB shared by England/Scotland)', () => {
    const shorts = FIFA_2026_TEAMS.map((n) => nationMeta(n).short);
    expect(new Set(shorts).size).toBe(shorts.length);
    expect(FIFA_2026_TEAMS).toHaveLength(48);
  });

  it('covers every FIFA 2026 team in the official draw', () => {
    for (const nation of FIFA_2026_TEAMS) {
      expect(nationMeta(nation).iso).toHaveLength(2);
    }
  });

  it('covers every nation in the generator list', () => {
    for (const nation of Object.keys(NATION_ISO)) {
      expect(nationMeta(nation).iso).toHaveLength(2);
    }
  });
});
