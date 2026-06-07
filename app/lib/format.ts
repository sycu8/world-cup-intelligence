export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** Integer % for compact schedule rows (e.g. 36·27·37). */
export function pctCompact(n: number): string {
  return String(Math.round(n * 100));
}

export function xg(n: number): string {
  return n.toFixed(2);
}
