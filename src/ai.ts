import type { Track } from './track.ts';
import type { Car } from './car.ts';
import type { Rng } from './rng.ts';
import { powerForDistance } from './flickmodel.ts';
import { FLICK } from './config.ts';

export interface Plan {
  yaw: number;
  dir: { x: number; z: number };
  power: number;
  /** The line it wanted was outside the turn wedge; this is the best it could do inside it. */
  clamped: boolean;
}

export interface AiOptions {
  /** Never flick harder than this (0..1). */
  maxPower: number;
  /** Fraction of the longest safe straight shot the AI actually goes for. */
  aggression: number;
  /** Aim noise in radians (standard deviation). */
  aimNoise: number;
}

export const DEFAULT_AI: AiOptions = { maxPower: 0.72, aggression: 0.85, aimNoise: 0.03 };

const MAX_TURN = (FLICK.maxTurnDeg * Math.PI) / 180;

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** The yaw, pulled inside the turn wedge around the reference heading. */
export function clampTurn(yaw: number, ref: number, maxTurn = MAX_TURN): number {
  const d = wrapAngle(yaw - ref);
  return ref + Math.max(-maxTurn, Math.min(maxTurn, d));
}

/** How far a straight line from (x, z) along dir stays on the track, up to max. */
export function clearDistance(track: Track, x: number, z: number, dir: { x: number; z: number }, max: number): number {
  const step = 0.25;
  for (let s = step; s <= max; s += step) {
    if (!track.query(x + dir.x * s, z + dir.z * s).onTrack) return s - step;
  }
  return max;
}

/**
 * Pick a flick: find the longest straight line ahead that stays inside the track,
 * point the nose at it and choose a power that lands a bit short of the end. The nose may only turn
 * FLICK.maxTurnDeg from the heading the car rests with; a line outside that wedge is pulled to its edge
 * and the power cut to what stays on the track along the pulled line.
 */
export function planFlick(track: Track, car: Car, rng: Rng, opts: AiOptions = DEFAULT_AI): Plan {
  const pos = car.position;
  const q = track.query(pos.x, pos.z);
  const hw = track.halfWidth;

  if (!q.onTrack) {
    const target = track.pointAt(q.index + 6);
    const d = Math.hypot(target.x - pos.x, target.z - pos.z);
    return aimAt(pos.x, pos.z, target.x, target.z, Math.min(0.35, powerForDistance(d * 1.2)), rng, opts, car.yaw);
  }

  const step = 0.5;
  let bestS = step;
  for (let s = step; s <= 32; s += step) {
    const tp = track.pointAt(track.indexOffset(q.index, s));
    const cx = tp.x - pos.x;
    const cz = tp.z - pos.z;
    const cl = Math.hypot(cx, cz);
    if (cl < 0.2) break;
    let ok = true;
    for (let u = step; u < s; u += step) {
      const sp = track.pointAt(track.indexOffset(q.index, u));
      const px = sp.x - pos.x;
      const pz = sp.z - pos.z;
      const perp = Math.abs(px * cz - pz * cx) / cl;
      if (perp > hw - 0.3) {
        ok = false;
        break;
      }
    }
    if (!ok) break;
    bestS = s;
  }

  const desired = Math.max(1.5, bestS * opts.aggression);
  const target = track.pointAt(track.indexOffset(q.index, Math.min(desired, bestS)));
  const power = Math.min(opts.maxPower, powerForDistance(desired));
  return aimAt(pos.x, pos.z, target.x, target.z, power, rng, opts, car.yaw, track, desired);
}

function aimAt(
  x: number,
  z: number,
  tx: number,
  tz: number,
  power: number,
  rng: Rng,
  opts: AiOptions,
  restYaw: number,
  track?: Track,
  desired = 0,
): Plan {
  const dx = tx - x;
  const dz = tz - z;
  const wanted = Math.atan2(-dz, dx);
  let yaw = clampTurn(wanted, restYaw);
  const clamped = Math.abs(wrapAngle(yaw - wanted)) > 1e-6;
  if (clamped && track) {
    // The pulled line probably points at the edge: only go as far as stays on the track.
    const clear = clearDistance(track, x, z, { x: Math.cos(yaw), z: -Math.sin(yaw) }, desired);
    power = Math.min(power, powerForDistance(Math.max(1.0, clear - 0.3)));
  }
  yaw += rng.gauss() * opts.aimNoise;
  return { yaw, dir: { x: Math.cos(yaw), z: -Math.sin(yaw) }, power: Math.max(0.08, power), clamped };
}
