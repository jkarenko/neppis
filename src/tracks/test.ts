// A small loop for scenario tests in the headless browser: one clean straight from the start line, a right-hand
// bend, then the jump and the dip on the back straight. Builds and renders fast under SwiftShader.
//
//   t 0.00 – 0.28  start straight, +x, no features; dead straight from 0.10 to 0.22
//   t 0.30 – 0.52  right-hand bend
//   t 0.55 – 0.78  back straight, -x, jump at 0.57 and dip at 0.70
//   t 0.80 – 1.00  left-hand bend back to the start
// Lap length is about 71 units, so 0.01 of a lap is 0.7 units, roughly one car length.
import type { TrackDef } from '../track.ts';

export const TEST_TRACK: TrackDef = {
  name: 'test',
  width: 1.5,
  area: [34, 18],
  // Extra points along the straights keep the Catmull-Rom spline straight there.
  points: [[-10, -5], [-3, -5], [4, -5], [10, -5], [13, 0], [10, 5], [4, 5], [-3, 5], [-10, 5], [-13, 0]],
  features: [
    { t: 0.57, kind: 'jump' },
    { t: 0.7, kind: 'dip' },
  ],
};
