import { describe, expect, it } from 'vitest';
import {
  applyEffectiveTeamProfile,
  deriveTeamProfile,
  isPlaceholderTeam,
} from '../src/services/teamProfile';
import { FIXTURE_TEAMS } from './helpers/fixtures';

describe('teamProfile', () => {
  it('derives deterministic ratings from team id', () => {
    const a = deriveTeamProfile('team-w26-c3');
    const b = deriveTeamProfile('team-w26-c3');
    const c = deriveTeamProfile('team-w26-d4');
    expect(a).toEqual(b);
    expect(a.elo_rating).toBeGreaterThanOrEqual(1580);
    expect(a.collective_strength_rating).toBeGreaterThan(0.5);
    expect(c.elo_rating).not.toBe(a.elo_rating);
  });

  it('detects placeholder teams and applies derived profile', () => {
    const placeholder = {
      ...FIXTURE_TEAMS[0],
      id: 'team-w26-z9',
      elo_rating: 1500,
      collective_strength_rating: 0.5,
    };
    expect(isPlaceholderTeam(placeholder)).toBe(true);
    const effective = applyEffectiveTeamProfile(placeholder);
    expect(effective.elo_rating).toBeGreaterThan(1500);
    expect(effective.collective_strength_rating).toBeGreaterThan(0.5);
  });

  it('leaves known teams unchanged', () => {
    const known = { ...FIXTURE_TEAMS[0], id: 'team-arg', elo_rating: 2100, collective_strength_rating: 0.9 };
    expect(isPlaceholderTeam(known)).toBe(false);
    expect(applyEffectiveTeamProfile(known)).toEqual(known);
  });
});
