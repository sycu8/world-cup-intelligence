import { describe, it, expect } from 'vitest';
import {
  areTeamMatchStatsComplete,
} from '../src/ingestion/fifa/teamMatchStatsComplete';

describe('teamMatchStatsComplete', () => {
  it('requires possession and passes for both teams', () => {
    expect(
      areTeamMatchStatsComplete(
        { possession: 60, passes: 520 },
        { possession: 40, passes: 334 },
      ),
    ).toBe(true);
  });

  it('rejects timeline-only partial stats (shots without possession/passes)', () => {
    expect(
      areTeamMatchStatsComplete(
        { possession: 0, passes: 0 },
        { possession: 0, passes: 0 },
      ),
    ).toBe(false);

    expect(
      areTeamMatchStatsComplete(
        { possession: 0, passes: 0 },
        { possession: 0, passes: 0 },
      ),
    ).toBe(false);

    expect(
      areTeamMatchStatsComplete(
        { possession: 55, passes: 0 },
        { possession: 45, passes: 300 },
      ),
    ).toBe(false);
  });

  it('rejects when either side is missing', () => {
    expect(areTeamMatchStatsComplete(null, { possession: 50, passes: 400 })).toBe(false);
    expect(areTeamMatchStatsComplete({ possession: 50, passes: 400 }, null)).toBe(false);
  });
});
