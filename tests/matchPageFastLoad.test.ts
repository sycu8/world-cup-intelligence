import { describe, expect, it, vi } from 'vitest';

const syncFifaLineups = vi.fn(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 80)));

vi.mock('../src/ingestion/fifa/fifaLineupSync', () => ({
  syncFifaMatchLineupsByRef: (...args: unknown[]) => syncFifaLineups(...args),
}));

vi.mock('../src/db/repositories/lineupsRepo', () => ({
  getMatchLineupRow: vi.fn().mockResolvedValue({ source_type: 'match_official' }),
}));

vi.mock('../src/services/officialLineupSync', () => ({
  syncOfficialSquadToMatch: vi.fn().mockResolvedValue(undefined),
}));

import { ensureMatchLineups } from '../src/services/lineupDisplay';

describe('match page fast load', () => {
  it('ensureMatchLineups returns immediately when waitUntil is provided', async () => {
    syncFifaLineups.mockClear();
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ home_team_id: 'h1', away_team_id: 'a1' }),
          }),
        }),
      },
    } as unknown as Parameters<typeof ensureMatchLineups>[0];

    const scheduled: Promise<unknown>[] = [];
    const started = Date.now();
    await ensureMatchLineups(env, 'match-1', {
      waitUntil: (promise) => {
        scheduled.push(promise);
      },
    });
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(40);
    expect(scheduled).toHaveLength(1);

    await scheduled[0];
    expect(syncFifaLineups).toHaveBeenCalledWith(env, 'match-1');
  });
});
