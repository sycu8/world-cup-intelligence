/** Run work after first paint / when the browser is idle. */
export function deferNonCritical(work: () => void, timeoutMs = 2000): void {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => work(), { timeout: timeoutMs });
    return;
  }
  setTimeout(work, 50);
}
