// The flat oval every headless physics tool runs on. Keep it here so the tools stay in sync.
import type { TrackDef } from '../track.ts';

export const CAL_TRACK: TrackDef = {
  name: 'calibration',
  width: 1.5,
  area: [70, 30],
  points: [[0, -8.5], [28, -8], [31, 0], [28, 8], [0, 8.5], [-28, 8], [-31, 0], [-28, -8]],
  features: [],
};
