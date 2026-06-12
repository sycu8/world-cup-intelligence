import { describe, expect, it } from 'vitest';
import {
  buildMatchThumbnailSvg,
  matchThumbnailPublicPath,
  matchToThumbnailInput,
} from '../src/services/matchThumbnail';
import { injectMatchPageHtml } from '../src/services/spaMatchMeta';
import { parseMatchPageSlug } from '../src/utils/matchPath';
import { resolveTeamFlagSlug } from '../src/lib/teamFlags';

describe('matchThumbnail', () => {
  it('resolves Mexico and South Africa flag slugs', () => {
    expect(resolveTeamFlagSlug({ countryCode: 'MX', teamName: 'Mexico' })).toBe('mx');
    expect(resolveTeamFlagSlug({ countryCode: 'ZA', teamName: 'South Africa' })).toBe('za');
  });

  it('builds public thumbnail path from slug', () => {
    expect(matchThumbnailPublicPath('vong-bang-a-mexico-vs-south-africa')).toBe(
      '/api/matches/vong-bang-a-mexico-vs-south-africa/thumbnail',
    );
  });

  it('maps match row to thumbnail input', () => {
    const input = matchToThumbnailInput({
      id: 'm-w26-ga-1v2',
      slug: 'vong-bang-a-mexico-vs-south-africa',
      home_name: 'Mexico',
      away_name: 'South Africa',
      home_country_code: 'MX',
      away_country_code: 'ZA',
      home_score: 2,
      away_score: 0,
      status: 'completed',
      stage: 'Group',
      group_code: 'A',
    } as never);
    expect(input.homeName).toBe('Mexico');
    expect(input.stageLabel).toBe('Bảng A');
  });

  it('generates svg with team labels', async () => {
    const svg = await buildMatchThumbnailSvg({
      homeName: 'Mexico',
      awayName: 'South Africa',
      homeCountryCode: 'MX',
      awayCountryCode: 'ZA',
      homeScore: 2,
      awayScore: 0,
      status: 'completed',
      stageLabel: 'Bảng A',
    });
    expect(svg).toContain('Mexico');
    expect(svg).toContain('South Africa');
    expect(svg).toContain('2 – 0');
    expect(svg.startsWith('<?xml')).toBe(true);
  });
});

describe('spaMatchMeta', () => {
  it('injects og:image for match pages', () => {
    const html = `<!DOCTYPE html><html><head><title>Old</title><meta property="og:image" content="/og-cover.jpg" /></head><body></body></html>`;
    const out = injectMatchPageHtml(
      html,
      {
        slug: 'vong-bang-a-mexico-vs-south-africa',
        home_name: 'Mexico',
        away_name: 'South Africa',
      } as never,
      'https://wcstat.orangecloud.vn',
    );
    expect(out).toContain('Mexico vs South Africa');
    expect(out).toContain('/api/matches/vong-bang-a-mexico-vs-south-africa/thumbnail');
  });
});

describe('matchPath', () => {
  it('parses match slug from pathname', () => {
    expect(parseMatchPageSlug('/matches/vong-bang-a-mexico-vs-south-africa')).toBe(
      'vong-bang-a-mexico-vs-south-africa',
    );
    expect(parseMatchPageSlug('/matches/vong-bang-a-mexico-vs-south-africa/analysis')).toBe(
      'vong-bang-a-mexico-vs-south-africa',
    );
    expect(parseMatchPageSlug('/matches')).toBeNull();
  });
});
