// How long a car takes to come to rest after landing on its roof or its side, and whether it creeps meanwhile.
// Drops the car in a chosen attitude from just above the ground at a few spots (flat centreline, the ridge slope,
// the ridge crest) on the test track, then logs speed, spin, up-vector and sleep state until Car.settled() says
// done. Usage: tsx scripts/probes/flip-settle.ts [roof|side|wheels|all]  TRACK=test|hietsu
import * as THREE from 'three';
import { initPhysics } from '../../src/physics.ts';
import { Track } from '../../src/track.ts';
import { TRACK_BY_NAME } from '../../src/tracks/index.ts';
import { Car, WHEEL_OFFSETS } from '../../src/car.ts';
import { CAR, PHYS_DT } from '../../src/config.ts';

const what = process.argv[2] ?? 'all';
const attitudes = what === 'all' ? ['roof', 'side', 'wheels'] : [what];
const world = await initPhysics();
// Knobs to try a cause: SOLVER_ITERS, ANG_DAMP (chassis and wheels), CHASSIS_DENSITY.
if (process.env.SOLVER_ITERS) world.integrationParameters.numSolverIterations = Number(process.env.SOLVER_ITERS);
const track = new Track(TRACK_BY_NAME[process.env.TRACK ?? 'test']);
track.createCollider(world);

const spots: { name: string; t: number; lateral: number }[] = [
  { name: 'flat', t: 0.12, lateral: 0 },
  { name: 'ridge slope', t: 0.12, lateral: 0.75 },
  { name: 'ridge crest', t: 0.12, lateral: 0.95 },
  { name: 'bend', t: 0.3, lateral: 0.3 },
];

function poseAt(t: number, lateral: number) {
  const idx = Math.round(t * track.n);
  const p = track.pointAt(idx);
  const tg = track.tangentAt(idx);
  return { x: p.x + -tg.z * lateral, z: p.z + tg.x * lateral, yaw: Math.atan2(-tg.z, tg.x) };
}

for (const attitude of attitudes) {
  for (const spot of spots) {
    const { x, z, yaw } = poseAt(spot.t, spot.lateral);
    const ground = track.heightAt(x, z);
    const car = new Car(world, 0xff0000, x, z, ground, yaw);
    if (process.env.ANG_DAMP) {
      car.body.setAngularDamping(Number(process.env.ANG_DAMP));
      for (const w of car.wheels) w.setAngularDamping(Number(process.env.ANG_DAMP));
    }
    if (process.env.CHASSIS_DENSITY) {
      car.body.collider(0).setDensity(Number(process.env.CHASSIS_DENSITY));
    }
    // Re-pose the bodies: roll about the car's own forward axis, lifted so the lowest point clears the ground.
    const roll = attitude === 'roof' ? Math.PI : attitude === 'side' ? Math.PI / 2 : 0;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), roll));
    const y = ground + CAR.restHeight + 0.15;
    car.body.setTranslation({ x, y, z }, true);
    car.body.setRotation(q, true);
    car.wheels.forEach((w, i) => {
      const p = new THREE.Vector3(...WHEEL_OFFSETS[i]).applyQuaternion(q);
      w.setTranslation({ x: x + p.x, y: y + p.y, z: z + p.z }, true);
      w.setRotation(q, true);
    });
    // A small shove sideways, as a landing would leave.
    car.body.setLinvel({ x: 0, y: 0, z: 0.8 }, true);
    let t = 0;
    let settledAt = -1;
    let creepStart = -1;
    const lines: string[] = [];
    while (t < 12 && settledAt < 0) {
      world.step();
      t += PHYS_DT;
      const v = car.body.linvel();
      const a = car.body.angvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      const spin = Math.hypot(a.x, a.y, a.z);
      // Wheel spin about its axle relative to the chassis, as opposed to the whole wheel wobbling with the car.
      const axleSpin = Math.max(
        ...car.wheels.map((w) => {
          const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(car.quaternion);
          const wa = w.angvel();
          return Math.abs((wa.x - a.x) * axis.x + (wa.y - a.y) * axis.y + (wa.z - a.z) * axis.z);
        }),
      );
      const wheelSpin = Math.max(...car.wheels.map((w) => Math.hypot(w.angvel().x, w.angvel().y, w.angvel().z)));
      if (creepStart < 0 && speed < 0.5 && spin < 1) creepStart = t;
      if (car.settled(PHYS_DT)) settledAt = t;
      if (Math.round(t / PHYS_DT) % 24 === 0 || settledAt >= 0) {
        lines.push(`  t=${t.toFixed(2)} v=${speed.toFixed(3)} w=${spin.toFixed(3)} wheel=${wheelSpin.toFixed(2)} axle=${axleSpin.toFixed(2)} up=${car.upDot.toFixed(2)} y=${(car.position.y - ground).toFixed(3)} sleep=${car.body.isSleeping()}/${car.wheels.filter((w) => w.isSleeping()).length}`);
      }
    }
    console.log(`${attitude} on ${spot.name}: nearly still at ${creepStart < 0 ? 'never' : creepStart.toFixed(2) + ' s'}, settled at ${settledAt < 0 ? 'never (12 s cap)' : settledAt.toFixed(2) + ' s'}`);
    if (settledAt < 0 || settledAt - creepStart > 1) console.log(lines.filter((_, i) => i % 5 === 0 || i === lines.length - 1).join('\n'));
    car.dispose();
  }
}
