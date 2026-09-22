// Does the terrain alone produce kellis? Flick over the jump and into the ridge at rising power.
import { initPhysics } from '../src/physics.ts';
import { Track, TRACKS } from '../src/track.ts';
import { Car } from '../src/car.ts';
import { PHYS_DT } from '../src/config.ts';

const world = await initPhysics();
const track = new Track(TRACKS[0]);
track.createCollider(world);
world.step();
const car = new Car(world, 0xff0000, 0, 0, 0, 0);

function trial(startIdx: number, angleOff: number, power: number): string {
  const p = track.pointAt(startIdx);
  const tg = track.tangentAt(startIdx);
  const yaw = Math.atan2(-tg.z, tg.x) + angleOff;
  car.setPose(p.x, p.z, yaw, track.heightAt(p.x, p.z));
  for (let i = 0; i < 30; i++) world.step();
  car.flick(power);
  let t = 0;
  while (t < 12) {
    world.step();
    t += PHYS_DT;
    if (t > 0.3 && car.settled(PHYS_DT)) break;
  }
  const q = track.query(car.position.x, car.position.z);
  const dist = track.distanceAlong(startIdx, q.index).toFixed(1);
  if (car.upDot < -0.2) return `kelli (${dist})`;
  if (car.upDot < 0.6) return `puolikelli (${dist})`;
  if (!q.onTrack) return `off track (${dist})`;
  return `ok (${dist})`;
}

const jumpIdx = track.indexOffset(Math.round(0.27 * track.n), -3);
const straightIdx = track.indexOffset(0, 2);
const powers = [0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
console.log('power | jump ahead, straight | straight, 25° into ridge | straight, 50° into ridge');
for (const pw of powers) {
  console.log(
    `${pw.toFixed(1)}   | ${trial(jumpIdx, 0, pw).padEnd(20)} | ${trial(straightIdx, 0.44, pw).padEnd(24)} | ${trial(straightIdx, 0.87, pw)}`,
  );
}
