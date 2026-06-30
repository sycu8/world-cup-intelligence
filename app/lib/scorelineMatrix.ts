import { normalizeScorelineKey } from './format';

/** Minimum probability shown in the scoreline matrix UI (0.1%). */
export const SCORELINE_MATRIX_MIN_PROB = 0.001;

export function scorelinesForMatrixDisplay(
  distribution: Record<string, number>,
  options?: { highlight?: string; actualScore?: string },
): string[] {
  const predictedKey = options?.highlight ? normalizeScorelineKey(options.highlight) : null;
  const actualKey = options?.actualScore ? normalizeScorelineKey(options.actualScore) : null;

  return Object.keys(distribution)
    .filter((key) => {
      const prob = distribution[key] ?? 0;
      if (prob >= SCORELINE_MATRIX_MIN_PROB) return true;
      if (predictedKey && key === predictedKey) return true;
      if (actualKey && key === actualKey) return true;
      return false;
    })
    .sort();
}
