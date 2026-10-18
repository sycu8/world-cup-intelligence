import { poissonPmf } from './poisson';
import { dixonColesAdjust } from './dixonColes';
import { aggregateWdl } from './scorelineWdl';

const MAX_GOALS = 6;

/** Skew strength for clear favorites — boosts 1-0 / 2-0 over 1-1 (mirrors MC tight-win sampling). */
function favoriteTightWinSkewStrength(
  wdl: { homeWin: number; draw: number; awayWin: number },
  lambdaHome: number,
  lambdaAway: number,
): { strength: number; favorHome: boolean } {
  const favorHome = wdl.homeWin >= wdl.awayWin;
  const favorProb = Math.max(wdl.homeWin, wdl.awayWin);
  const favoriteLambda = favorHome ? lambdaHome : lambdaAway;
  const underdogLambda = favorHome ? lambdaAway : lambdaHome;
  const lambdaRatio = favoriteLambda / Math.max(0.28, underdogLambda);

  if (favorProb < 0.54 || lambdaRatio < 1.32) {
    return { strength: 0, favorHome };
  }

  const fromWin = (favorProb - 0.54) / 0.28;
  const fromRatio = (lambdaRatio - 1.32) / 1.1;
  const fromLowScoringUnderdog =
    underdogLambda < 1.05 ? (1.05 - underdogLambda) * 0.55 : 0;

  const strength = Math.min(1, fromWin * 0.45 + fromRatio * 0.35 + fromLowScoringUnderdog * 0.35);
  return { strength, favorHome };
}

function applyFavoriteTightWinSkew(
  matrix: Record<string, number>,
  lambdaHome: number,
  lambdaAway: number,
): Record<string, number> {
  const wdl = aggregateWdl(matrix);
  const { strength, favorHome } = favoriteTightWinSkewStrength(wdl, lambdaHome, lambdaAway);
  if (strength <= 0) return matrix;

  const skewed = { ...matrix };
  const tightWins = favorHome ? ['1-0', '2-0'] : ['0-1', '0-2'];
  const boost = 1 + 0.3 * strength;
  const drawCut = 1 - 0.24 * strength;

  for (const key of Object.keys(skewed)) {
    if (tightWins.includes(key)) {
      skewed[key] *= boost;
    } else if (key === '1-1') {
      skewed[key] *= drawCut;
    } else if (strength > 0.45) {
      const [h, a] = key.split('-').map(Number);
      const margin = favorHome ? h - a : a - h;
      if (margin === 1 && h + a >= 3) {
        skewed[key] *= 1 - 0.1 * strength;
      }
    }
  }

  let total = 0;
  for (const key of Object.keys(skewed)) total += skewed[key];
  for (const key of Object.keys(skewed)) skewed[key] /= total;
  return skewed;
}

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

  let normalized = matrix;
  if (drawInflation !== 1) {
    const inflated = { ...matrix };
    for (const [key, p] of Object.entries(matrix)) {
      const [h, a] = key.split('-').map(Number);
      if (h === a) inflated[key] = p * drawInflation;
    }
    const sum = Object.values(inflated).reduce((s, v) => s + v, 0);
    for (const key of Object.keys(inflated)) {
      inflated[key] /= sum;
    }
    normalized = inflated;
  }

  return applyFavoriteTightWinSkew(normalized, lambdaHome, lambdaAway);
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
