/**
 * Empirical flick distance table, [power, distance in world units], measured with
 * scripts/calibrate.ts on a flat piece of track. Used by the AI to pick a power.
 */
export const FLICK_TABLE: [number, number][] = [
  [0.0, 0.0],
  [0.1, 1.3],
  [0.2, 2.8],
  [0.3, 4.5],
  [0.4, 6.4],
  [0.5, 8.1],
  [0.6, 10.0],
  [0.7, 11.6],
  [0.8, 12.7],
  [0.9, 14.0],
  [1.0, 15.1],
];

export function distanceForPower(p: number): number {
  const t = FLICK_TABLE;
  if (p <= 0) return 0;
  for (let i = 1; i < t.length; i++) {
    if (p <= t[i][0]) {
      const k = (p - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
      return t[i - 1][1] + k * (t[i][1] - t[i - 1][1]);
    }
  }
  return t[t.length - 1][1];
}

export function powerForDistance(d: number): number {
  const t = FLICK_TABLE;
  if (d <= 0) return 0;
  for (let i = 1; i < t.length; i++) {
    if (d <= t[i][1]) {
      const k = (d - t[i - 1][1]) / (t[i][1] - t[i - 1][1]);
      return t[i - 1][0] + k * (t[i][0] - t[i - 1][0]);
    }
  }
  return 1;
}
