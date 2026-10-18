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
