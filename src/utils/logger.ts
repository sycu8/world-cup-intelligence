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

/** Label safe for logs. Omits stacks and messages that may quote model text. */
export function summarizeError(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  if (error.name === 'ZodError' || error instanceof SyntaxError) return error.name;
  const message = error.message.replace(/[\r\n]+/g, ' ').slice(0, 80);
  return message ? `${error.name}: ${message}` : error.name;
}
