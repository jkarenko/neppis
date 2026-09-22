// World units: 1 unit = 1 dm (10 cm). A Formula-Neppis car is 8 x 4.5 x 3 cm.
export const GRAVITY = -98.1;
export const PHYS_DT = 1 / 120;

export const CAR = {
  length: 0.8,
  width: 0.45,
  height: 0.3,
  wheelRadius: 0.12,
  /** Height of the body origin above the ground when resting on its wheels. */
  restHeight: 0.2,
};

export const FLICK = {
  /** Drag length for full power, as a fraction of the shorter viewport side. */
  maxDragFraction: 0.33,
  /** Pixels of drag around the car that count as no power at all. */
  deadZonePx: 12,
  /** A flick drag must start within this distance of the car on the ground (world units)... */
  grabRadius: 1.0,
  /** ...or within this many CSS pixels of it on screen, whichever is more generous. */
  grabRadiusPx: 36,
  /** Launch speed at full power, units/s. Speed scales with sqrt(power) so distance is roughly linear in power. */
  maxSpeed: 22,
  /** Drags shorter than this on screen are not flicks: releasing simply cancels. */
  cancelPx: 44,
  /** speed = maxSpeed * power^speedExp. */
  speedExp: 0.65,
  /** Where the finger meets the car, relative to the body origin: this far behind it... */
  contactBack: 0.4,
  /** ...and this far above it (0 = axle height, 0.02 = middle of the chassis). */
  contactHeight: 0.02,
};

export const TYRE = {
  /** Constant rolling deceleration on damp sand, units/s^2. */
  rollDecel: 7,
  /** Viscous longitudinal damping, 1/s. */
  rollDamp: 0.3,
  /** Lateral (skid) damping, 1/s. */
  lateralDamp: 9,
  /** How quickly the nose swings toward the direction of travel, 1/s. */
  yawAlign: 3,
};

export type OffTrackRule = 'lastOnTrack' | 'flickStart';
export type KelliRule = 'flickStart' | 'turnStart';

export interface Rules {
  flicksPerTurn: number;
  laps: number;
  /** Rounds proceed in track order (leader first) instead of a fixed order. */
  orderByPosition: boolean;
  offTrack: OffTrackRule;
  kelli: KelliRule;
}

export const DEFAULT_RULES: Rules = {
  flicksPerTurn: 3,
  laps: 1,
  orderByPosition: true,
  offTrack: 'lastOnTrack',
  kelli: 'flickStart',
};

/** Power -> indicator colour stops. */
export const POWER_COLORS: [number, string][] = [
  [0.0, '#3b82f6'],
  [0.45, '#22c55e'],
  [0.7, '#eab308'],
  [1.0, '#ef4444'],
];

export const PLAYER_COLORS = [0xe63946, 0x2a6fdb, 0xf4c20d, 0x2fbf71, 0xffffff, 0xff8c42];
