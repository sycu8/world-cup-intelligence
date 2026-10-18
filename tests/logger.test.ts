import { afterEach, describe, expect, it, vi } from 'vitest';
import { logAiCallFailure, logError, logInfo, logWarn, summarizeError } from '../src/utils/logger';
import { TacticalBriefingSchema } from '../src/ai/schemas';
import realOutputs from './fixtures/wc55-real-outputs.json';

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

  it('logs the error class and a short path, not model text or Zod issue JSON', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const strict = TacticalBriefingSchema.safeParse(realOutputs[0]);
    expect(strict.success).toBe(false);
    if (strict.success) return;

    logAiCallFailure('tactical briefing workers ai failed', strict.error, {
      model: '@cf/meta/llama-3.1-8b-instruct-fp8',
      durationMs: 34810,
      matchId: 'm-w26-gd-1v2',
    });
    logAiCallFailure(
      'tactical briefing workers ai failed',
      new SyntaxError('Unexpected token, "Đội nhà có khả năng" is not valid JSON'),
      { model: '@cf/meta/llama-3.1-8b-instruct-fp8', durationMs: 12, matchId: 'm-1' },
    );

    const payloads = spy.mock.calls.map((call) => JSON.parse(String(call[0])) as {
      errorName: string;
      errorMessage: string;
    });
    expect(payloads[0]?.errorName).toBe('ZodError');
    expect(payloads[0]?.errorMessage).toContain('tacticalThemes.0.confidence');
    expect(payloads[1]?.errorName).toBe('SyntaxError');
    expect(payloads[1]?.errorMessage).toBe('invalid JSON');
    const logged = spy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).not.toContain('Đội nhà');
    expect(logged).not.toContain('invalid_type');
    expect(logged).not.toContain('required');
  });
});
