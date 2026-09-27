import type { Track } from './track.ts';
import type { Car } from './car.ts';
import type { Rng } from './rng.ts';
import { distanceForPower, powerForDistance } from './flickmodel.ts';
import { CAR, FLICK } from './config.ts';

export interface Plan {
  yaw: number;
  dir: { x: number; z: number };
  power: number;
  /** The line it wanted was outside the turn wedge; this is the best it could do inside it. */
  clamped: boolean;
  /** Which branch of the planner produced the flick. */
  kind: 'recover' | 'bully' | 'line';
}

/** How a driver plays. Every knob is data; there is no per-driver code. See docs/drivers.md. */
export interface AiProfile {
  /** Never flick harder than this (0..1). */
  maxPower: number;
  /** Fraction of the longest safe straight shot the AI actually goes for. Above 1 it overshoots the safe line. */
  aggression: number;
  /** Aim noise in radians (standard deviation). */
  aimNoise: number;
  /** Power noise (standard deviation, 0..1 scale): consistency. */
  powerNoise: number;
  /** 0 ignores the jump and dip, 1 stops short of them whenever the line would cross one. */
  jumpCaution: number;
  /** Aggression multiplier for the flick after a flip. */
  afterFlip: number;
  /** Aggression added per place behind the leader. */
  tilt: number;
  /** Chance (0..1) to aim at a rival within reach instead of the line. */
  bully: number;
  /** Aggression multiplier when leading. */
  leadEase: number;
  /** Preference for the inside of the coming bend, -1 (outside) .. 1 (inside). */
  lineBias: number;
}

/** What the planner knows about the race beyond the car itself. */
export interface RaceContext {
  /** 1 = leading. */
  place: number;
  /** Positions of the other cars still racing. */
  rivals: { x: number; z: number }[];
  /** The driver's previous flick ended on the roof. */
  afterFlip: boolean;
}

export const DEFAULT_AI: AiProfile = {
  maxPower: 0.72,
  aggression: 0.85,
  aimNoise: 0.03,
  powerNoise: 0,
  jumpCaution: 0,
  afterFlip: 1,
  tilt: 0,
  bully: 0,
  leadEase: 1,
  lineBias: 0,
};

const NO_RACE: RaceContext = { place: 1, rivals: [], afterFlip: false };
const MAX_TURN = (FLICK.maxTurnDeg * Math.PI) / 180;

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** The yaw, pulled inside the turn wedge around the reference heading. */
export function clampTurn(yaw: number, ref: number, maxTurn = MAX_TURN): number {
  const d = wrapAngle(yaw - ref);
  return ref + Math.max(-maxTurn, Math.min(maxTurn, d));
}

/**
 * The most power a flick may have when the nose is turned `turn` radians from the rest heading: 1 straight ahead,
 * a sigmoid drop through the middle of the wedge, FLICK.turnPower.edgePower at its edge. Normalised so the centre is
 * exactly 1 and the edge exactly edgePower.
 */
export function maxPowerForTurn(turn: number): number {
  const { halfDeg, widthDeg, edgePower } = FLICK.turnPower;
  const deg = Math.min(FLICK.maxTurnDeg, (Math.abs(turn) * 180) / Math.PI);
  const sig = (d: number) => 1 / (1 + Math.exp((d - halfDeg) / widthDeg));
  const k = (sig(deg) - sig(FLICK.maxTurnDeg)) / (sig(0) - sig(FLICK.maxTurnDeg));
  return edgePower + (1 - edgePower) * k;
}

/** How far a straight line from (x, z) along dir stays at least `margin` inside the track edge, up to max. */
export function clearDistance(track: Track, x: number, z: number, dir: { x: number; z: number }, max: number, margin = 0): number {
  const step = 0.25;
  const limit = track.halfWidth - margin;
  for (let s = step; s <= max; s += step) {
    if (Math.abs(track.query(x + dir.x * s, z + dir.z * s).d) > limit) return s - step;
  }
  return max;
}

/** Distance along the lap from index to the first jump or dip within `within` units ahead, or null. */
function featureAhead(track: Track, index: number, within: number): number | null {
  let best: number | null = null;
  for (const f of track.def.features) {
    const d = track.distanceAlong(index, Math.round(f.t * track.n));
    if (d > 0 && d <= within && (best === null || d < best)) best = d;
  }
  return best;
}

/**
 * Pick a flick. In order: off the track, get back on; a rival within reach may be hit instead of the line;
 * otherwise the longest straight line ahead that stays inside the track, scaled by aggression and the race
 * situation, with the power that lands there. The nose may only turn FLICK.maxTurnDeg from the heading the car
 * rests with; a line outside that wedge is pulled to its edge and the power cut to what stays on the track along
 * the pulled line.
 */
export function planFlick(track: Track, car: Car, rng: Rng, p: AiProfile = DEFAULT_AI, race: RaceContext = NO_RACE): Plan {
  const pos = car.position;
  const q = track.query(pos.x, pos.z);
  const hw = track.halfWidth;

  if (!q.onTrack) {
    const target = track.pointAt(q.index + 6);
    const d = Math.hypot(target.x - pos.x, target.z - pos.z);
    return aimAt(track, pos.x, pos.z, target.x, target.z, Math.min(0.35, powerForDistance(d * 1.2)), rng, p, car.yaw, 'recover');
  }

  // Bully: a rival within reach, roughly ahead, on the track. Land just past it.
  if (p.bully > 0 && race.rivals.length > 0 && rng.next() < p.bully) {
    const reach = distanceForPower(p.maxPower);
    let best: { x: number; z: number; d: number } | null = null;
    for (const r of race.rivals) {
      const d = Math.hypot(r.x - pos.x, r.z - pos.z);
      if (d < 0.6 || d > reach) continue;
      const ang = Math.abs(wrapAngle(Math.atan2(-(r.z - pos.z), r.x - pos.x) - car.yaw));
      if (ang > MAX_TURN || !track.query(r.x, r.z).onTrack) continue;
      if (!best || d < best.d) best = { ...r, d };
    }
    if (best) {
      const power = Math.min(p.maxPower, powerForDistance(best.d + 1.0));
      return aimAt(track, pos.x, pos.z, best.x, best.z, power, rng, p, car.yaw, 'bully');
    }
  }

  // The longest straight shot that stays inside the track: targets anywhere across the width, so a bend can be
  // cut, with a margin from the edge that a steady hand can afford to shave. lineBias picks among equally long
  // lines by which side of the coming bend they favour.
  // The whole car has to stay on the floor: a wheel on the ridge ramp stops it like a kerb.
  const margin = Math.min(hw - 0.1, CAR.width / 2 + 0.06 + 3 * p.aimNoise);
  const lateral = [0, -0.5, 0.5, -0.9, 0.9].map((k) => k * (hw - margin));
  let bestS = 0.5;
  let best = track.pointAt(track.indexOffset(q.index, 3)).clone();
  let bestSide = 0;
  for (let s = 1; s <= 32; s += 0.5) {
    const idx = track.indexOffset(q.index, s);
    const c = track.pointAt(idx);
    const tg = track.tangentAt(idx);
    let found = false;
    for (const off of lateral) {
      const tx = c.x + -tg.z * off;
      const tz = c.z + tg.x * off;
      const dx = tx - pos.x;
      const dz = tz - pos.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.5) continue;
      const dir = { x: dx / len, z: dz / len };
      if (clearDistance(track, pos.x, pos.z, dir, len, margin) < len) continue;
      const ahead = track.tangentAt(track.indexOffset(idx, 3));
      const turn = tg.x * ahead.z - tg.z * ahead.x; // > 0: the track bends right
      const side = Math.abs(turn) > 0.02 ? Math.sign(turn) * Math.sign(off) : 0; // 1 = inside of the bend
      if (!found || side * p.lineBias > bestSide * p.lineBias) {
        best = { x: tx, y: 0, z: tz } as typeof best;
        bestSide = side;
        found = true;
      }
    }
    if (!found) break;
    bestS = s;
  }

  let aggression = p.aggression + p.tilt * (race.place - 1);
  if (race.place === 1) aggression *= p.leadEase;
  if (race.afterFlip) aggression *= p.afterFlip;
  let desired = Math.max(1.5, bestS * aggression);
  // Jump caution: with 1, stop short of a jump or dip the line would cross; with 0, ignore it. Once the feature is
  // close there is no room left to stop short, and a gentle flick only rolls back down its face, so it is taken
  // with enough speed to clear it.
  const feature = featureAhead(track, q.index, Math.max(desired, 3));
  let minPower = 0;
  if (feature !== null) {
    if (feature < 2.5) minPower = 0.45;
    else if (p.jumpCaution > 0) desired = Math.max(1.0, desired + (Math.max(0.8, feature - 0.6) - desired) * p.jumpCaution);
  }

  // Within the safe line, aim at its end and land at `desired`. Beyond it (aggression above 1) the driver goes for
  // the point that far along the track even though the straight line there leaves the corridor: the risky flick.
  const target = desired > bestS ? track.pointAt(track.indexOffset(q.index, desired)) : best;
  const power = Math.max(minPower, Math.min(p.maxPower, powerForDistance(desired)));
  return aimAt(track, pos.x, pos.z, target.x, target.z, power, rng, p, car.yaw, 'line', desired);
}

function aimAt(
  track: Track,
  x: number,
  z: number,
  tx: number,
  tz: number,
  power: number,
  rng: Rng,
  p: AiProfile,
  restYaw: number,
  kind: Plan['kind'],
  desired = 0,
): Plan {
  const dx = tx - x;
  const dz = tz - z;
  const wanted = Math.atan2(-dz, dx);
  let yaw = clampTurn(wanted, restYaw);
  const clamped = Math.abs(wrapAngle(yaw - wanted)) > 1e-6;
  if (clamped && desired > 0) {
    // The pulled line probably points at the edge: only go as far as stays on the track.
    const clear = clearDistance(track, x, z, { x: Math.cos(yaw), z: -Math.sin(yaw) }, desired);
    power = Math.min(power, powerForDistance(Math.max(1.0, clear - 0.3)));
  }
  // A sharp turn cannot be taken at speed: the same cap the game puts on a human's flick.
  power = Math.min(power, maxPowerForTurn(wrapAngle(yaw - restYaw)));
  yaw += rng.gauss() * p.aimNoise;
  power = Math.min(p.maxPower, power + rng.gauss() * p.powerNoise);
  return { yaw, dir: { x: Math.cos(yaw), z: -Math.sin(yaw) }, power: Math.max(0.08, power), clamped, kind };
}
