import { describe, expect, it } from 'vitest';
import { isMatchPagePath, parseMatchPageSlug } from '../src/utils/matchPath';

describe('parseMatchPageSlug', () => {
  it('returns null for non-match paths', () => {
    expect(parseMatchPageSlug('/')).toBeNull();
    expect(parseMatchPageSlug('/teams/usa')).toBeNull();
    expect(parseMatchPageSlug('/matches')).toBeNull();
    expect(parseMatchPageSlug('/matches/analysis')).toBeNull();
  });

  it('returns slug for two-segment match paths', () => {
    expect(parseMatchPageSlug('/matches/vong-bang-a-usa-vs-mex')).toBe(
      'vong-bang-a-usa-vs-mex',
    );
  });

  it('returns slug for analysis subpaths', () => {
    expect(parseMatchPageSlug('/matches/vong-bang-a-usa-vs-mex/analysis')).toBe(
      'vong-bang-a-usa-vs-mex',
    );
  });

  it('returns null for unexpected extra segments', () => {
    expect(parseMatchPageSlug('/matches/slug/extra/segment')).toBeNull();
  });
});

describe('isMatchPagePath', () => {
  it('is true for canonical slug paths', () => {
    expect(isMatchPagePath('/matches/vong-bang-a-usa-vs-mex')).toBe(true);
  });

  it('is true for legacy internal match ids in the path', () => {
    expect(isMatchPagePath('/matches/m-w26-ga-1v2')).toBe(true);
  });

  it('is true when only the trailing segment is a legacy id', () => {
    expect(isMatchPagePath('/legacy-redirect/m-w26-ga-1v2')).toBe(true);
  });

  it('is false for unrelated paths', () => {
    expect(isMatchPagePath('/schedule')).toBe(false);
    expect(isMatchPagePath('/matches/analysis')).toBe(false);
  });
});
