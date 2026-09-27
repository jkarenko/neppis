// Time the physics step with cars rolling on the real track.
// Usage: tsx scripts/probes/perf.ts [nofine]   env: CARS, HZ, SOLVER_ITERS, FINE_CELL, NO_CHASSIS
import { initPhysics } from '../../src/physics.ts';
import { Track, TRACKS } from '../../src/track.ts';
import { Car } from '../../src/car.ts';
import { PHYS_DT, TRACK_DETAIL } from '../../src/config.ts';
if (process.env.FINE_CELL) TRACK_DETAIL.fineCell = Number(process.env.FINE_CELL);

const world = await initPhysics();
if (process.env.SOLVER_ITERS) world.integrationParameters.numSolverIterations = Number(process.env.SOLVER_ITERS);
if (process.env.HZ) world.timestep = 1 / Number(process.env.HZ);
const track = new Track(TRACKS[0]);
const [, fine] = track.createCollider(world);
if (process.argv[2] === 'nofine') world.removeCollider(fine, false);
const slot = track.startSlots(1)[0];
const car = new Car(world, 0, slot.x, slot.z, track.surfaceHeightAt(slot.x, slot.z), slot.yaw);
if (process.env.NO_CHASSIS) world.removeCollider(car.body.collider(0), false);
const cars = [car];
for (let k = 1; k < Number(process.env.CARS ?? 1); k++) {
  const sl = track.startSlots(6)[k];
  cars.push(new Car(world, 0, sl.x, sl.z, track.surfaceHeightAt(sl.x, sl.z), sl.yaw));
}
for (let i = 0; i < 60; i++) world.step();
car.flick(0.6);
let steps = 0;
const t0 = performance.now();
while (steps < 480) {
  world.step();
  steps++;
}
const ms = performance.now() - t0;
console.log(`fine=${TRACK_DETAIL.fineCell} chassis=${!process.env.NO_CHASSIS} cars=${cars.length} iters=${world.integrationParameters.numSolverIterations} hz=${(1 / world.timestep).toFixed(0)}: ${steps} steps (${(steps * PHYS_DT).toFixed(1)} s sim) in ${ms.toFixed(0)} ms = ${(ms / steps).toFixed(2)} ms/step, ${(ms / (steps * PHYS_DT) / 10).toFixed(0)}% of real time`);
