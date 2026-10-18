import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError, logInfo } from '../src/utils/logger';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logInfo writes structured JSON to console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logInfo('hello', { userId: 'u1', active: true });
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(spy.mock.calls[0][0]));
    expect(payload.level).toBe('info');
    expect(payload.message).toBe('hello');
    expect(payload.userId).toBe('u1');
    expect(payload.active).toBe(true);
    expect(payload.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('logError writes structured JSON to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logError('boom');
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(spy.mock.calls[0][0]));
    expect(payload.level).toBe('error');
    expect(payload.message).toBe('boom');
    expect(payload.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
