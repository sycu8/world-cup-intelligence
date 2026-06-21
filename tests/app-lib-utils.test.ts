import { describe, expect, it } from 'vitest';
import { brandTheme } from '../app/lib/brand/brandTheme';
import { normalizeLocalized, pickLocalized } from '../app/lib/briefingText';
import { colors } from '../app/lib/colors';
import {
  defaultContributionSegments,
  derivePlayerImpact,
} from '../app/lib/derivePlayerImpact';
import {
  formatScoreline,
  normalizeScorelineKey,
  pct,
  pctCompact,
  xg,
} from '../app/lib/format';
import {
  lineupSourceBadgeClass,
  lineupSourceLocaleKey,
} from '../app/lib/lineupSourceLabel';
import {
  compactTeamLabel,
  formatMatchVersus,
  resolveTeamDisplayName,
  TEAM_DISPLAY_NAMES,
} from '../app/lib/matchTeams';
import {
  resolveLineupHref,
  resolveMatchAnalysisHref,
  resolveMatchHref,
} from '../app/lib/matchPaths';
import { adjustProbabilities } from '../app/lib/simulator';

describe('format', () => {
  it('formats percentages and scorelines', () => {
    expect(pct(0.367)).toBe('36.7%');
    expect(pctCompact(0.367)).toBe('37');
    expect(xg(1.234)).toBe('1.23');
    expect(formatScoreline(2, 1)).toBe('2-1');
    expect(normalizeScorelineKey('2–1')).toBe('2-1');
  });
});

describe('colors', () => {
  it('exports design token palette', () => {
    expect(colors.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(colors.live).toBe(colors.pressing);
    expect(Object.keys(colors).length).toBeGreaterThanOrEqual(10);
  });
});

describe('briefingText', () => {
  it('normalizes and picks localized strings', () => {
    expect(normalizeLocalized('hello')).toEqual({ vi: 'hello', en: 'hello' });
    expect(normalizeLocalized('vi only', 'en fallback')).toEqual({
      vi: 'vi only',
      en: 'en fallback',
    });
    expect(normalizeLocalized({ vi: 'xin chào', en: 'hello' })).toEqual({
      vi: 'xin chào',
      en: 'hello',
    });
    expect(pickLocalized({ vi: 'vi', en: 'en' }, 'en')).toBe('en');
    expect(pickLocalized('same', 'vi')).toBe('same');
  });
});

describe('simulator', () => {
  it('adjusts probabilities and renormalizes', () => {
    const base = { homeWin: 0.4, draw: 0.3, awayWin: 0.3, xgHome: 1.2, xgAway: 1.0 };
    const adjusted = adjustProbabilities(base, { homeBoost: 1, awayBoost: 0, tempo: 0.5 });

    expect(adjusted.homeWin + adjusted.draw + adjusted.awayWin).toBeCloseTo(1, 5);
    expect(adjusted.homeWin).toBeGreaterThan(base.homeWin);
    expect(adjusted.xgHome).toBeGreaterThan(base.xgHome);
  });
});

describe('matchPaths', () => {
  it('resolves hrefs from slug or legacy id', () => {
    const match = { id: 'm-w26-ga-1v2', slug: 'vong-bang-a-usa-vs-mex' };
    expect(resolveMatchHref(match)).toBe('/matches/vong-bang-a-usa-vs-mex');
    expect(resolveMatchAnalysisHref(match)).toBe('/matches/vong-bang-a-usa-vs-mex/analysis');
    expect(resolveLineupHref(match)).toBe('/lineups/vong-bang-a-usa-vs-mex');
    expect(resolveMatchHref({ id: 'm-w26-ga-1v2' })).toBe('/matches/m-w26-ga-1v2');
  });
});

describe('lineupSourceLabel', () => {
  it('maps source to locale keys and badge classes', () => {
    expect(lineupSourceLocaleKey('official')).toBe('match.lineupOfficial');
    expect(lineupSourceLocaleKey('squad')).toBe('match.lineupSquad');
    expect(lineupSourceLocaleKey('projected')).toBe('match.lineupProjected');
    expect(lineupSourceLocaleKey('other')).toBe('match.lineupUnknown');
    expect(lineupSourceBadgeClass('official')).toContain('green');
    expect(lineupSourceBadgeClass('unknown')).toContain('muted');
  });
});

describe('derivePlayerImpact', () => {
  it('returns demo data for empty events', () => {
    expect(derivePlayerImpact([])).toHaveLength(2);
  });

  it('returns demo when events have no goals or shots', () => {
    expect(derivePlayerImpact([{ event_type: 'pass' }])).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Key forward' }),
    ]));
  });

  it('boosts impact when goals or shots exist', () => {
    const impacts = derivePlayerImpact([
      { event_type: 'goal', xg: 0.4 },
      { event_type: 'shot', xg: 0.1 },
    ]);
    expect(impacts.length).toBeGreaterThan(0);
    expect(impacts[0].impact).toBeGreaterThan(0.45);
  });

  it('provides default contribution segments', () => {
    const segments = defaultContributionSegments();
    expect(segments).toHaveLength(5);
    expect(segments.every((s) => s.labelKey.startsWith('contribution.'))).toBe(true);
  });
});

describe('brandTheme', () => {
  it('defines brand tokens and SEO defaults', () => {
    expect(brandTheme.name).toBe('PitchIntel');
    expect(brandTheme.colors.cyan).toMatch(/^#/);
    expect(brandTheme.fonts.body[0]).toContain('Be Vietnam Pro');
    expect(brandTheme.seo.ogImage).toBe('/og-cover.png');
  });
});

describe('matchTeams', () => {
  it('resolves display names and compact labels', () => {
    expect(resolveTeamDisplayName('team-usa')).toBe(TEAM_DISPLAY_NAMES['team-usa']);
    expect(resolveTeamDisplayName('team-usa', 'U.S.A.')).toBe('U.S.A.');
    expect(formatMatchVersus('team-usa', 'team-mex')).toBe('United States vs Mexico');
    expect(compactTeamLabel('United States')).toBe('USA');
    expect(compactTeamLabel('Very Long National Team Name')).toBe('Very');
    expect(compactTeamLabel('Superlongsingleword')).toHaveLength(10);
  });
});
