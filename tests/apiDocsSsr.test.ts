// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('ApiDocsPage SSR branches', () => {
  it('resolveApiDocsOrigin uses deployment fallback without window', async () => {
    const { resolveApiDocsOrigin } = await import('../app/pages/ApiDocsPage');
    expect(resolveApiDocsOrigin()).toBe('https://wcstat.orangecloud.vn');
  });
});
