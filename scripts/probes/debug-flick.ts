// Trace one flick step by step: position, velocity, spin and upright-ness every 50 ms.
// Usage: tsx scripts/probes/debug-flick.ts [power 0..1]
import { initPhysics, RAPIER } from '../../src/physics.ts';
import { Track } from '../../src/track.ts';
import { CAL_TRACK } from '../lib/cal-track.ts';
import { Car } from '../../src/car.ts';
import { PHYS_DT } from '../../src/config.ts';
const p = Number(process.argv[2] ?? '0.5');
const world = await initPhysics();
const track = new Track(CAL_TRACK);
track.createCollider(world);
world.step();
for (const [x, z] of [[0, -8.5], [0, -7.2], [0, 9.5], [-20, 0]]) {
  const hit = world.castRay(new RAPIER.Ray({ x, y: 5, z }, { x: 0, y: -1, z: 0 }), 20, true);
  console.log(`h(${x},${z}) rapier=${hit ? (5 - hit.timeOfImpact).toFixed(3) : 'null'} analytic=${track.heightAt(x, z).toFixed(3)}`);
}
const slot = track.startSlots(1)[0];
const car = new Car(world, 0xff0000, slot.x, slot.z, track.heightAt(slot.x, slot.z), slot.yaw);
console.log('mass', car.body.mass().toFixed(3), 'slot', slot, 'ground', track.heightAt(slot.x, slot.z).toFixed(3));
for (let i = 0; i < 60; i++) world.step();
console.log('rest y', car.position.y.toFixed(3), 'up', car.upDot.toFixed(3));
car.flick(p);
let t = 0;
let next = 0;
while (t < 4) {
  world.step();
  t += PHYS_DT;
  if (t >= next && t < 1.6) {
    const v = car.body.linvel();
    const a = car.body.angvel();
    const pos = car.position;
    console.log(`t=${t.toFixed(2)} x=${pos.x.toFixed(2)} y=${pos.y.toFixed(3)} z=${pos.z.toFixed(2)} v=(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}) w=(${a.x.toFixed(1)},${a.y.toFixed(1)},${a.z.toFixed(1)}) up=${car.upDot.toFixed(2)} sleep=${car.body.isSleeping()}`);
    next += 0.05;
  }
}
