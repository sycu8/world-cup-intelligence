export type LogContext = Record<string, string | number | boolean | undefined>;

export function logInfo(message: string, ctx: LogContext = {}): void {
  console.log(JSON.stringify({ level: 'info', message, ...ctx, ts: new Date().toISOString() }));
}

export function logWarn(message: string, ctx: LogContext = {}): void {
  console.warn(JSON.stringify({ level: 'warn', message, ...ctx, ts: new Date().toISOString() }));
}

export function logError(message: string, ctx: LogContext = {}): void {
  console.error(JSON.stringify({ level: 'error', message, ...ctx, ts: new Date().toISOString() }));
}

/** Structured Workers log line. Message is capped so model text is not dumped. */
export function logAiCallFailure(
  message: string,
  error: unknown,
  fields: { model: string; durationMs: number; matchId?: string },
): void {
  const errorName = error instanceof Error ? error.name : 'Error';
  const errorMessage = sanitizedAiErrorMessage(error);
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      errorName,
      errorMessage,
      model: fields.model,
      durationMs: fields.durationMs,
      ...(fields.matchId ? { matchId: fields.matchId } : {}),
    }),
  );
}

/**
 * Class stays in errorName. The message is a short label only:
 * Zod paths, or "invalid JSON". Never the issue dump or a quoted model snippet.
 */
function sanitizedAiErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  if (error.name === 'ZodError') {
    const issues = (error as { issues?: Array<{ path?: unknown[] }> }).issues;
    const paths = Array.isArray(issues)
      ? issues
          .map((issue) => (Array.isArray(issue.path) ? issue.path.map(String).join('.') : ''))
          .filter(Boolean)
          .slice(0, 8)
      : [];
    return paths.length ? paths.join(', ') : error.name;
  }
  if (error instanceof SyntaxError) return 'invalid JSON';
  return error.message.replace(/[\r\n]+/g, ' ').slice(0, 180);
}

/** Label safe for logs. Omits stacks and messages that may quote model text. */
export function summarizeError(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  if (error.name === 'ZodError' || error instanceof SyntaxError) return error.name;
  const message = error.message.replace(/[\r\n]+/g, ' ').slice(0, 80);
  return message ? `${error.name}: ${message}` : error.name;
}
