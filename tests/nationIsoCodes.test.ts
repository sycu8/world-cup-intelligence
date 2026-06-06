import { describe, expect, it } from 'vitest';
import { NATION_ISO, nationMeta } from '../scripts/nationIsoCodes.mjs';

describe('nationIsoCodes', () => {
  it('uses ISO 3166-1 alpha-2 codes, not name-prefix slices', () => {
    expect(nationMeta('United States').iso).toBe('US');
    expect(nationMeta('Mexico').iso).toBe('MX');
    expect(nationMeta('Poland').iso).toBe('PL');
    expect(nationMeta('Ukraine').iso).toBe('UA');
    expect(nationMeta('Cameroon').iso).toBe('CM');
    expect(nationMeta('Senegal').iso).toBe('SN');
    expect(nationMeta('Serbia').iso).toBe('RS');
    expect(nationMeta('Sweden').iso).toBe('SE');
    expect(nationMeta('Austria').iso).toBe('AT');
    expect(nationMeta('Denmark').iso).toBe('DK');
    expect(nationMeta('Switzerland').iso).toBe('CH');
    expect(nationMeta('Algeria').iso).toBe('DZ');
  });

  it('keeps ISO codes unique among WC 2026 placeholder nations', () => {
    const placeholderNations = [
      'United States', 'Mexico', 'Canada', 'Argentina', 'Brazil', 'France', 'England', 'Spain',
      'Germany', 'Italy', 'Netherlands', 'Portugal', 'Belgium', 'Croatia', 'Uruguay', 'Colombia',
      'Ecuador', 'Chile', 'Paraguay', 'Peru', 'Japan', 'South Korea', 'Australia', 'Saudi Arabia',
      'Iran', 'Qatar', 'Morocco', 'Senegal', 'Nigeria', 'Ghana', 'Cameroon', 'Tunisia',
      'Egypt', 'Algeria', 'Poland', 'Switzerland', 'Austria', 'Denmark', 'Sweden', 'Norway',
      'Serbia', 'Ukraine',
    ];
    const codes = placeholderNations.map((n) => nationMeta(n).iso);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('covers every nation in the generator list', () => {
    for (const nation of Object.keys(NATION_ISO)) {
      expect(nationMeta(nation).iso).toHaveLength(2);
    }
  });
});
