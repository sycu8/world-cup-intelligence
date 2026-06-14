import { describe, expect, it } from 'vitest';
import { getTeamHistoricalFormSnapshot } from '../src/services/teamFormStats';

describe('getTeamHistoricalFormSnapshot', () => {
  it('is exported for champion MC strength loading', () => {
    expect(typeof getTeamHistoricalFormSnapshot).toBe('function');
  });
});
