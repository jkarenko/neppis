// Headless calibration: verifies the heightfield layout and measures flick distance / flip rate per power.
// Run with: pnpm calibrate
import { initPhysics, RAPIER } from '../src/physics.ts';
import { Track, type TrackDef } from '../src/track.ts';
import { Car } from '../src/car.ts';
import { PHYS_DT, WHEEL, FLICK } from '../src/config.ts';

const CAL_TRACK: TrackDef = {
  name: 'calibration',
  width: 1.5,
  area: [70, 30],
  points: [[0, -8.5], [28, -8], [31, 0], [28, 8], [0, 8.5], [-28, 8], [-31, 0], [-28, -8]],
  features: [],
};

async function main() {
  if (process.env.CRR) WHEEL.rollingCoefficient = Number(process.env.CRR);
  if (process.env.WFRICTION) WHEEL.friction = Number(process.env.WFRICTION);
  if (process.env.WDENSITY) WHEEL.density = Number(process.env.WDENSITY);
  if (process.env.MAX_SPEED) FLICK.maxSpeed = Number(process.env.MAX_SPEED);
  for (const k of ['speedExp'] as const) {
    const v = process.env[k.toUpperCase()];
    if (v) FLICK[k] = Number(v);
  }
  console.log('FLICK', JSON.stringify(FLICK));
  console.log('WHEEL', JSON.stringify(WHEEL));
  const world = await initPhysics();
  const track = new Track(CAL_TRACK);
  track.createCollider(world);
  world.step();

  // Collision surface check: raycast onto a few points and compare with the analytic height.
  let maxErr = 0;
  for (const [x, z] of [[0.03, -8.53], [10.03, -8.53], [0.03, -7.23], [-20.03, 0.03], [15.03, 3.03], [0.03, 9.53]]) {
    const ray = new RAPIER.Ray({ x, y: 5, z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(ray, 20, true);
    const y = hit ? 5 - hit.timeOfImpact : NaN;
    const err = hit ? Math.abs(y - track.heightAt(x, z)) : 1;
    maxErr = Math.max(maxErr, err);
    console.log(`height at (${x}, ${z}): rapier=${y.toFixed(3)} analytic=${track.heightAt(x, z).toFixed(3)}`);
  }
  console.log(`max surface error: ${maxErr.toFixed(4)} ${maxErr < 0.03 ? 'OK' : 'MISMATCH'}`);

  const slot = track.startSlots(1)[0];
  const car = new Car(world, 0xff0000, slot.x, slot.z, track.heightAt(slot.x, slot.z), slot.yaw);

  console.log('\npower  mean   sd    min    max   kelli% puoli% off%');
  const table: [number, number][] = [[0, 0]];
  const powers = process.env.POWERS
    ? process.env.POWERS.split(',').map(Number)
    : [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  for (const p of powers) {
    const dists: number[] = [];
    let kelli = 0;
    let puoli = 0;
    let off = 0;
    const trials = Number(process.env.TRIALS ?? 3);
    for (let k = 0; k < trials; k++) {
      car.setPose(slot.x, slot.z, slot.yaw, track.heightAt(slot.x, slot.z));
      for (let i = 0; i < 30; i++) world.step();
      car.flick(p);
      let t = 0;
      while (t < 12) {
        world.step();
        t += PHYS_DT;
        if (t > 0.3 && car.settled(PHYS_DT)) break;
      }
      const pos = car.position;
      const q = track.query(pos.x, pos.z);
      dists.push(track.distanceAlong(track.startSlots(1)[0].index, q.index));
      if (car.upDot < -0.2) kelli++;
      else if (car.upDot < 0.6) puoli++;
      else if (!q.onTrack) off++;
    }
    const mean = dists.reduce((a, b) => a + b, 0) / trials;
    const sd = Math.sqrt(dists.reduce((a, b) => a + (b - mean) ** 2, 0) / trials);
    console.log(
      `${p.toFixed(2)}  ${mean.toFixed(1).padStart(5)} ${sd.toFixed(1).padStart(5)} ${Math.min(...dists).toFixed(1).padStart(6)} ${Math.max(...dists).toFixed(1).padStart(6)}   ${((100 * kelli) / trials).toFixed(0).padStart(4)}   ${((100 * puoli) / trials).toFixed(0).padStart(4)}  ${((100 * off) / trials).toFixed(0).padStart(4)}`,
    );
    table.push([Number(p.toFixed(1)), Number(mean.toFixed(1))]);
  }
  console.log('\nFLICK_TABLE =', JSON.stringify(table));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
