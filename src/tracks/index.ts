import { TRACKS, type TrackDef } from '../track.ts';
import { CAL_TRACK } from './calibration.ts';
import { TEST_TRACK } from './test.ts';

/** Every track the app can load by name: the real ones plus the two headless test loops. */
export const TRACK_BY_NAME: Record<string, TrackDef> = {
  hietsu: TRACKS[0],
  cal: CAL_TRACK,
  test: TEST_TRACK,
};
