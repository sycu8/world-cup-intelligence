import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError, logInfo, logWarn, summarizeError } from '../src/utils/logger';

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

  it('logWarn writes structured JSON to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logWarn('degraded', { section: 'schedule' });
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(spy.mock.calls[0][0]));
    expect(payload.level).toBe('warn');
    expect(payload.message).toBe('degraded');
    expect(payload.section).toBe('schedule');
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

  it('summarizeError drops parse messages that quote model text', () => {
    expect(summarizeError(new SyntaxError('Unexpected token, "Phân tích bị cắt" is not valid JSON'))).toBe(
      'SyntaxError',
    );
    expect(summarizeError(new Error('workers down'))).toBe('Error: workers down');
    expect(summarizeError('nope')).toBe('unknown error');
  });
});
