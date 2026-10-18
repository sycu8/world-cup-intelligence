// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('I18nContext SSR branch', () => {
  it('readStoredMode returns vi when window is undefined', async () => {
    const { readStoredMode } = await import('../app/lib/i18n/I18nContext');
    expect(readStoredMode()).toBe('vi');
  });
});
