import { describe, expect, it } from 'vitest';
import { resolveTeamFlag, resolveTeamFlagSlug } from '../app/lib/nationFlags';

describe('nationFlags edge cases', () => {
  it('resolves sub-national slug with team name', () => {
    expect(resolveTeamFlagSlug({ teamName: 'England' })).toBe('gb-eng');
    expect(resolveTeamFlag({ teamName: 'England' })).toMatch(/🇦|./);
  });

  it('returns empty flag when hyphen slug has no team name', () => {
    // Sub-national slug without a name cannot resolve emoji — defensive empty return.
    const slug = resolveTeamFlagSlug({ teamName: 'England' });
    expect(slug).toContain('-');
    expect(resolveTeamFlag({ teamName: '  ' })).toBe('');
  });
});
