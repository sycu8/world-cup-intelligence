import { describe, expect, it } from 'vitest';
import { paginationSchema, searchQuerySchema } from '../src/utils/zod';

describe('paginationSchema', () => {
  it('applies defaults when fields are omitted', () => {
    expect(paginationSchema.parse({})).toEqual({ limit: 50, offset: 0 });
  });

  it('coerces string query params to integers', () => {
    expect(paginationSchema.parse({ limit: '25', offset: '10' })).toEqual({
      limit: 25,
      offset: 10,
    });
  });

  it('rejects limit below 1 or above 100', () => {
    expect(() => paginationSchema.parse({ limit: 0 })).toThrow();
    expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects negative offset', () => {
    expect(() => paginationSchema.parse({ offset: -1 })).toThrow();
  });
});

describe('searchQuerySchema', () => {
  it('accepts a non-empty query up to 200 characters', () => {
    expect(searchQuerySchema.parse({ q: 'argentina' })).toEqual({ q: 'argentina' });
    expect(searchQuerySchema.parse({ q: 'x'.repeat(200) })).toEqual({ q: 'x'.repeat(200) });
  });

  it('rejects empty or overlong queries', () => {
    expect(() => searchQuerySchema.parse({ q: '' })).toThrow();
    expect(() => searchQuerySchema.parse({ q: 'x'.repeat(201) })).toThrow();
  });
});
