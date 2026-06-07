import { describe, expect, it } from 'vitest';
import {
  GROUPS,
  GROUP_STAGE_MATCHES,
  KNOCKOUT_MATCHES,
  VENUES,
  allTeams,
  groupMatchId,
  resolvedGroupMatches,
  slotForTeam,
  teamId,
} from '../scripts/fifa-wc2026-official-data.mjs';

describe('fifaOfficialDraw', () => {
  it('defines 48 teams across 12 groups of 4', () => {
    const teams = allTeams();
    expect(teams).toHaveLength(48);
    expect(Object.keys(GROUPS)).toHaveLength(12);
    for (const groupTeams of Object.values(GROUPS)) {
      expect(groupTeams).toHaveLength(4);
    }
  });

  it('lists 72 group-stage and 32 knockout fixtures', () => {
    expect(GROUP_STAGE_MATCHES).toHaveLength(72);
    expect(KNOCKOUT_MATCHES).toHaveLength(32);
    expect(KNOCKOUT_MATCHES[0]?.fifaNumber).toBe(73);
    expect(KNOCKOUT_MATCHES.at(-1)?.fifaNumber).toBe(104);
  });

  it('maps each team to team-w26-{group}{slot} ids', () => {
    expect(teamId('A', 1)).toBe('team-w26-a1');
    expect(teamId('L', 3)).toBe('team-w26-l3');
    expect(allTeams().find((t) => t.name === 'Mexico')).toMatchObject({
      id: 'team-w26-a1',
      group: 'A',
      slot: 1,
    });
    expect(allTeams().find((t) => t.name === 'England')).toMatchObject({
      id: 'team-w26-l3',
      group: 'L',
      slot: 3,
    });
  });

  it('assigns official group draw slots', () => {
    expect(GROUPS.A).toEqual(['Mexico', 'South Africa', 'Korea Republic', 'Czechia']);
    expect(GROUPS.B).toEqual(['Canada', 'Bosnia and Herzegovina', 'Qatar', 'Switzerland']);
    expect(GROUPS.D).toEqual(['United States', 'Paraguay', 'Australia', 'Türkiye']);
    expect(slotForTeam('J', 'Argentina')).toBe(1);
    expect(slotForTeam('C', 'Brazil')).toBe(3);
  });

  it('resolves group matches to canonical m-w26-g* ids with FIFA opening kickoff', () => {
    const resolved = resolvedGroupMatches();
    expect(resolved).toHaveLength(72);

    const opening = resolved.find((m) => m.fifaNumber === 1);
    expect(opening).toMatchObject({
      matchId: 'm-w26-ga-1v2',
      home: 'Mexico',
      away: 'South Africa',
      homeTeamId: 'team-w26-a1',
      awayTeamId: 'team-w26-a2',
      kickoffUtc: '2026-06-11T19:00:00Z',
      venueId: 'v-mexico-city',
    });

    expect(groupMatchId('A', 1, 2)).toBe('m-w26-ga-1v2');
    expect(groupMatchId('A', 4, 2)).toBe('m-w26-ga-2v4');
  });

  it('maps all 16 FIFA venues to v-* ids', () => {
    expect(VENUES).toHaveLength(16);
    expect(VENUES.every((v) => v.id.startsWith('v-'))).toBe(true);
  });
});
