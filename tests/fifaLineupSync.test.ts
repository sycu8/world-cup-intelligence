import { describe, it, expect } from 'vitest';
import {
  countFifaStarters,
  isFifaLineupReady,
  shouldSyncFifaLineupForKickoff,
  isPreKickoffLineupWindow,
} from '../src/ingestion/fifa/fifaLineupSync';
import { mapFifaPlayerPosition } from '../src/ingestion/fifa/fifaPlayerResolve';

describe('fifaPlayerResolve', () => {
  it('maps FIFA position codes', () => {
    expect(mapFifaPlayerPosition(0)).toBe('GK');
    expect(mapFifaPlayerPosition(1)).toBe('CB');
    expect(mapFifaPlayerPosition(2)).toBe('CM');
    expect(mapFifaPlayerPosition(3)).toBe('ST');
  });
});

describe('fifaLineupSync', () => {
  const kickoff = '2026-06-13T01:00:00Z';

  it('detects full FIFA starting elevens', () => {
    const info = {
      HomeTeam: { Players: Array.from({ length: 11 }, () => ({ Status: 1 })) },
      AwayTeam: { Players: Array.from({ length: 11 }, () => ({ Status: 1 })) },
    };
    expect(countFifaStarters(info.HomeTeam)).toBe(11);
    expect(isFifaLineupReady(info)).toBe(true);
  });

  it('syncs from 10 minutes before kickoff through live', () => {
    const kickMs = new Date(kickoff).getTime();
    expect(shouldSyncFifaLineupForKickoff(kickoff, 'scheduled', kickMs - 5 * 60_000)).toBe(true);
    expect(shouldSyncFifaLineupForKickoff(kickoff, 'scheduled', kickMs - 30 * 60_000)).toBe(true);
    expect(shouldSyncFifaLineupForKickoff(kickoff, 'scheduled', kickMs - 120 * 60_000)).toBe(false);
    expect(shouldSyncFifaLineupForKickoff(kickoff, 'live', kickMs + 30 * 60_000)).toBe(true);
  });

  it('flags the final 10-minute pre-kickoff window', () => {
    const kickMs = new Date(kickoff).getTime();
    expect(isPreKickoffLineupWindow(kickoff, kickMs - 8 * 60_000)).toBe(true);
    expect(isPreKickoffLineupWindow(kickoff, kickMs - 20 * 60_000)).toBe(false);
  });
});
