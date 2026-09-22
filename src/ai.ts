import type { Track } from './track.ts';
import type { Car } from './car.ts';
import type { Rng } from './rng.ts';
import { powerForDistance } from './flickmodel.ts';

export interface Plan {
  yaw: number;
  dir: { x: number; z: number };
  power: number;
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

/**
 * Pick a flick: find the longest straight line ahead that stays inside the track,
 * point the nose at it and choose a power that lands a bit short of the end.
 */
export function planFlick(track: Track, car: Car, rng: Rng, opts: AiOptions = DEFAULT_AI): Plan {
  const pos = car.position;
  const q = track.query(pos.x, pos.z);
  const hw = track.halfWidth;

  if (!q.onTrack) {
    const target = track.pointAt(q.index + 6);
    const d = Math.hypot(target.x - pos.x, target.z - pos.z);
    return aimAt(pos.x, pos.z, target.x, target.z, Math.min(0.35, powerForDistance(d * 1.2)), rng, opts);
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
  return aimAt(pos.x, pos.z, target.x, target.z, power, rng, opts);
}

function aimAt(
  x: number,
  z: number,
  tx: number,
  tz: number,
  power: number,
  rng: Rng,
  opts: AiOptions,
): Plan {
  let dx = tx - x;
  let dz = tz - z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const err = rng.gauss() * opts.aimNoise;
  const c = Math.cos(err);
  const s = Math.sin(err);
  [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
  return { yaw: Math.atan2(-dz, dx), dir: { x: dx, z: dz }, power: Math.max(0.08, power) };
}
