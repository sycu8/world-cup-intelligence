import { poissonPmf } from './poisson';
import { dixonColesAdjust } from './dixonColes';
import { aggregateWdl } from './scorelineWdl';

const MAX_GOALS = 6;

export type ScorelineMatrixOptions = {
  rho?: number;
  drawInflation?: number;
};

export function buildScorelineMatrix(
  lambdaHome: number,
  lambdaAway: number,
  options?: ScorelineMatrixOptions,
): Record<string, number> {
  const rho = options?.rho ?? -0.13;
  const drawInflation = options?.drawInflation ?? 1;
  const matrix: Record<string, number> = {};
  let total = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      let p = poissonPmf(i, lambdaHome) * poissonPmf(j, lambdaAway);
      p = dixonColesAdjust(i, j, p, lambdaHome, lambdaAway, rho);
      const key = `${i}-${j}`;
      matrix[key] = p;
      total += p;
    }
  }
  for (const key of Object.keys(matrix)) {
    matrix[key] /= total;
  }

  if (drawInflation === 1) return matrix;

  let inflated = { ...matrix };
  for (const [key, p] of Object.entries(matrix)) {
    const [h, a] = key.split('-').map(Number);
    if (h === a) inflated[key] = p * drawInflation;
  }
  const sum = Object.values(inflated).reduce((s, v) => s + v, 0);
  for (const key of Object.keys(inflated)) {
    inflated[key] /= sum;
  }
  return inflated;
}

export function mostLikelyScore(matrix: Record<string, number>): string {
  return Object.entries(matrix).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '0-0';
}

/** Rounded xG pair used as a secondary hint when it disagrees with the matrix argmax. */
export function roundedLambdaScore(lambdaHome: number, lambdaAway: number): string {
  return `${Math.round(lambdaHome)}-${Math.round(lambdaAway)}`;
}

export function secondaryExpectedScore(
  matrix: Record<string, number>,
  lambdaHome: number,
  lambdaAway: number,
): string | null {
  const top = mostLikelyScore(matrix);
  const rounded = roundedLambdaScore(lambdaHome, lambdaAway);
  return top !== rounded ? rounded : null;
}

export { aggregateWdl };
