export function normalizeScorelineKey(score: string): string {
  return score.replace(/\s+/g, '').replace(':', '-');
}

export function topScorelines(
  matrix: Record<string, number>,
  k = 3,
): Array<{ score: string; prob: number }> {
  return Object.entries(matrix)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([score, prob]) => ({ score, prob }));
}

export function scorelineTop1Hit(matrix: Record<string, number>, actualScore: string): boolean {
  const top = topScorelines(matrix, 1)[0]?.score;
  return top === normalizeScorelineKey(actualScore);
}

export function scorelineTopKHit(
  matrix: Record<string, number>,
  actualScore: string,
  k: number,
): boolean {
  const key = normalizeScorelineKey(actualScore);
  return topScorelines(matrix, k).some((row) => row.score === key);
}

export function actualScoreProbability(matrix: Record<string, number>, actualScore: string): number {
  return matrix[normalizeScorelineKey(actualScore)] ?? 0;
}

export function scorelineLogLoss(matrix: Record<string, number>, actualScore: string): number {
  const p = Math.max(1e-15, actualScoreProbability(matrix, actualScore));
  return -Math.log(p);
}
