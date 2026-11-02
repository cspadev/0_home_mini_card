/** 100 up to expectedSec, then linear down to minScore at maxSec; minScore beyond that. */
export function computeScore(
  elapsedSec: number,
  expectedSec: number,
  maxSec: number,
  minScore: number,
): number {
  if (elapsedSec <= expectedSec) return 100;
  if (elapsedSec >= maxSec) return minScore;
  const t = (elapsedSec - expectedSec) / (maxSec - expectedSec);
  return Math.round(100 - t * (100 - minScore));
}
