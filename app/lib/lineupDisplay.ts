export type LineupPlayerEntry = {
  shirtNumber: number | null;
  name: string;
  position: string;
};

export function formatLineupPlayerLine(entry: LineupPlayerEntry): string {
  const num = entry.shirtNumber != null ? `(${entry.shirtNumber})` : '(—)';
  return `${num} - ${entry.name} - ${entry.position}`;
}
