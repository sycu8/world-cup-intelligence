import { describe, expect, it } from 'vitest';
import { pathCacheKey } from '../src/services/workersPathCache';

describe('workersPathCache', () => {
  it('builds stable internal cache keys', () => {
    expect(pathCacheKey('spa:/matches').url).toBe('https://pitchintel.internal/spa:/matches');
    expect(pathCacheKey('/api/home').url).toBe('https://pitchintel.internal/api/home');
  });
});
