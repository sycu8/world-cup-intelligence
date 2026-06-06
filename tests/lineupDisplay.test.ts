import { describe, expect, it } from 'vitest';
import {
  formatLineupPlayerLine,
  normalizeLineupPosition,
} from '../src/services/lineupDisplay';

describe('lineupDisplay', () => {
  it('formats official player line as (number) - name - position', () => {
    expect(
      formatLineupPlayerLine({ shirtNumber: 10, name: 'Lionel Messi', position: 'ST' }),
    ).toBe('(10) - Lionel Messi - ST');
  });

  it('normalizes long position labels to short codes', () => {
    expect(normalizeLineupPosition(null, null, 'Goalkeeper')).toBe('GK');
    expect(normalizeLineupPosition('DM', null, null)).toBe('DM');
  });

  it('uses em dash placeholder when shirt number missing', () => {
    expect(formatLineupPlayerLine({ shirtNumber: null, name: 'Player', position: 'CM' })).toBe(
      '(—) - Player - CM',
    );
  });
});
