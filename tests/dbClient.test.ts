import { describe, expect, it } from 'vitest';
import { getDb } from '../src/db/client';
import { createMockEnv } from './helpers/mockEnv';

describe('db/client', () => {
  it('returns env.DB', () => {
    const env = createMockEnv();
    expect(getDb(env)).toBe(env.DB);
  });
});
