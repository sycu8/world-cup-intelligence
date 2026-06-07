import { describe, expect, it } from 'vitest';
import { isPlaceholderTeam } from '../app/lib/matchTeamDisplay';

describe('matchTeamDisplay', () => {
  it('detects knockout placeholder teams', () => {
    expect(isPlaceholderTeam('XX')).toBe(true);
    expect(isPlaceholderTeam('us')).toBe(false);
    expect(isPlaceholderTeam(null)).toBe(false);
  });
});
