export function aggregateWdl(matrix: Record<string, number>): {
  homeWin: number;
  draw: number;
  awayWin: number;
} {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  for (const [key, p] of Object.entries(matrix)) {
    const [h, a] = key.split('-').map(Number);
    if (h > a) homeWin += p;
    else if (h === a) draw += p;
    else awayWin += p;
  }
  return { homeWin, draw, awayWin };
}
