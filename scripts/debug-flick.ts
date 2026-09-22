import { initPhysics, RAPIER } from '../src/physics.ts';
import { Track, type TrackDef } from '../src/track.ts';
import { Car } from '../src/car.ts';
import { PHYS_DT, TYRE } from '../src/config.ts';
TYRE.rollDecel = 6; TYRE.rollDamp = 0.35;

const CAL_TRACK: TrackDef = {
  name: 'calibration', width: 1.5, area: [70, 30],
  points: [[0, -8.5], [28, -8], [31, 0], [28, 8], [0, 8.5], [-28, 8], [-31, 0], [-28, -8]], features: [],
};
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
const f = car.forward;
car.flick(f.x, f.z, p);
let t = 0;
let next = 0;
while (t < 4) {
  car.updateTyres(PHYS_DT);
  world.step();
  t += PHYS_DT;
  if (t >= next && t < 1.6) {
    const v = car.body.linvel();
    const a = car.body.angvel();
    const pos = car.position;
    const g = (car as any).grounded();
    console.log(`t=${t.toFixed(2)} x=${pos.x.toFixed(2)} y=${pos.y.toFixed(3)} z=${pos.z.toFixed(2)} v=(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}) w=(${a.x.toFixed(1)},${a.y.toFixed(1)},${a.z.toFixed(1)}) up=${car.upDot.toFixed(2)} grounded=${g} sleep=${car.body.isSleeping()}`);
    next += 0.05;
  }
}
