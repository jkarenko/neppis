// Scenario mode: load the game straight into a known situation from the URL, for headless tests and screenshots.
//
//   ?scenario=<preset>            one of PRESETS below
//   ?track=test|cal|hietsu        (default test)
//   ?car=t,lateral,heading[,along] the human car; heading in degrees relative to travel, positive right, along in
//                                 world units from t
//   ?ai=t,lateral,heading         an AI car; repeatable
//   ?seed=n                       RNG seed (default 1)
//   ?cam=chase|top|side           camera (default chase)
//   ?laps=n
//
// Explicit parameters override the preset. With a scenario active the setup screen is skipped, the camera does
// not glide, the first-turn finger cue is off, turns run in setup order (human first) and window.__neppis exposes
// the debug handle below.
import type { PlayerSetup, TrackPose } from './game.ts';

export type CameraMode = 'chase' | 'top' | 'side';

export interface Scenario {
  name: string;
  track: string;
  players: PlayerSetup[];
  seed: number;
  cam: CameraMode;
  laps: number;
}

export interface CarState {
  name: string;
  ai: boolean;
  x: number;
  z: number;
  /** World yaw in degrees. */
  yaw: number;
  /** Heading relative to the direction of travel, degrees, positive right. */
  heading: number;
  upDot: number;
  onTrack: boolean;
  t: number;
  lateral: number;
  lap: number;
  progress: number;
}

export interface GameState {
  phase: string;
  round: number;
  current: string | null;
  flicksLeft: number;
  lastOutcome: string | null;
  cars: CarState[];
}

/** window.__neppis in scenario mode. Headings are degrees relative to the direction of travel, positive right. */
export interface NeppisDebug {
  state(): GameState;
  /** Show the aim as a pointer drag would: nose turned, ribbon and power readout visible. */
  aim(headingDeg: number, power: number): GameState;
  /** Aim and release. */
  flick(headingDeg: number, power: number): GameState;
  /** Step physics synchronously for this many seconds. */
  step(seconds: number): GameState;
  /** Step physics synchronously until the flick has been resolved (or maxSeconds have passed). */
  settle(maxSeconds?: number): GameState;
  /** Screen position of the current car, for real pointer drags. */
  carScreen(): { x: number; y: number } | null;
  camera(mode: CameraMode): void;
}

const pose = (t: number, lateral: number, headingDeg: number, along = 0): TrackPose => ({ t, along, lateral, heading: (headingDeg * Math.PI) / 180 });
const human = (p: TrackPose): PlayerSetup => ({ name: 'You', ai: false, pose: p });
const rival = (p: TrackPose, name = 'Rival'): PlayerSetup => ({ name, ai: true, pose: p });

/** Named situations. The test track's ridge crest is 0.9 from the centreline, its outer slope ends at 1.2. */
export const PRESETS: Record<string, Partial<Scenario>> = {
  /** Middle of the start straight, nose along the track. */
  straight: { players: [human(pose(0.12, 0, 0))] },
  /** On the ridge crest, leaning, nose along the track. */
  ridge: { players: [human(pose(0.12, 0.95, 0))] },
  /** Entering the right-hand bend. */
  bend: { players: [human(pose(0.28, 0, 0))] },
  /** Turned around on the straight: nose pointing back the way it came. */
  reversed: { players: [human(pose(0.15, 0, 180))] },
  /** A rival parked one car length ahead. */
  rival: { players: [human(pose(0.12, 0, 0)), rival(pose(0.12, 0.2, 0, 1.0))] },
  /** Three car lengths before the jump. */
  jump: { players: [human(pose(0.57, 0, 0, -2.4))] },
};

function parsePose(s: string): TrackPose {
  const [t, lateral, heading, along = 0] = s.split(',').map(Number);
  if (![t, lateral, heading, along].every(Number.isFinite)) throw new Error(`bad pose ${JSON.stringify(s)}: expected t,lateral,heading[,along]`);
  return pose(t, lateral, heading, along);
}

/** The scenario from the page URL, or null when the game should start normally. */
export function scenarioFromUrl(search = location.search): Scenario | null {
  const q = new URLSearchParams(search);
  const name = q.get('scenario');
  if (!name && !q.has('car')) return null;
  const preset = name ? PRESETS[name] : undefined;
  if (name && !preset) throw new Error(`unknown scenario ${JSON.stringify(name)}: ${Object.keys(PRESETS).join(', ')}`);
  const players = q.has('car') ? [human(parsePose(q.get('car')!)), ...q.getAll('ai').map((a, i) => rival(parsePose(a), `Rival ${i + 1}`))] : preset!.players!;
  return {
    name: name ?? 'custom',
    track: q.get('track') ?? preset?.track ?? 'test',
    players,
    seed: Number(q.get('seed') ?? preset?.seed ?? 1),
    cam: (q.get('cam') as CameraMode) ?? preset?.cam ?? 'chase',
    laps: Number(q.get('laps') ?? preset?.laps ?? 1),
  };
}
