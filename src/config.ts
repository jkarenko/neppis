// World units: 1 unit = 1 dm (10 cm). A Formula-Neppis car is 8 x 4.5 x 3 cm.
export const GRAVITY = -98.1;
// 240 Hz: a wheel at full speed moves well under its own radius per step, so no CCD is needed.
// Rapier's CCD clamps the motion of fast small bodies, which throttled the wheels at 120 Hz.
export const PHYS_DT = 1 / 240;
/** At most this many physics steps per rendered frame: a slow device gets slow motion, not a stall. */
export const MAX_STEPS_PER_FRAME = 8;

/** Track grid detail. Mutable so calibration scripts can sweep it. */
export const TRACK_DETAIL = {
  /** Physics grid under the track (world units). 12.5 mm stays within 2 mm of the drawn ribbon. */
  fineCell: 0.125,
  /** Multiplier on the millimetre texture of the damp floor; 0 is glass-smooth. */
  fineTexture: 1,
  /** Height of the pushed-up sand ridge along the track edge, world units. The wheel radius is 0.12. */
  ridgeHeight: 0.12,
};

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
  /** Launch speed at full power, units/s. */
  maxSpeed: 20,
  /** Drags shorter than this on screen are not flicks: releasing simply cancels. */
  cancelPx: 44,
  /** speed = maxSpeed * power^speedExp. */
  speedExp: 0.5,
  /** A flick may turn the nose at most this far either way from the heading the car came to rest with. */
  maxTurnDeg: 45,
};

export const WHEEL = {
  /** Half the tyre width. */
  halfWidth: 0.05,
  /** Rounding of the tyre's rims. */
  rimRadius: 0.015,
  /** Rubber on damp sand. */
  friction: 0.9,
  /** Heavy wheels keep the centre of mass low, like the weighted bottoms of tuned cars. */
  density: 4.0,
  /** Rolling resistance coefficient of damp sand (deceleration = coefficient x g). */
  rollingCoefficient: 0.12,
  /** How sharply the axle brake reaches its full torque as the wheel starts to spin. */
  brakeStiffness: 50,
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
