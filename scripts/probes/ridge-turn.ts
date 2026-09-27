// A car straddling the ridge, nose turned by the aim preview, then flicked: does it go where the nose points?
//   ./node_modules/.bin/tsx scripts/probes/ridge-turn.ts [lateral] [turnDeg] [power]   RIDGE=height overrides the ridge
import * as THREE from 'three';
import { initPhysics } from '../../src/physics.ts';
import { Track } from '../../src/track.ts';
import { TEST_TRACK } from '../../src/tracks/test.ts';
import { Game } from '../../src/game.ts';
import { DEFAULT_RULES, PHYS_DT, TRACK_DETAIL } from '../../src/config.ts';

if (process.env.RIDGE) TRACK_DETAIL.ridgeHeight = Number(process.env.RIDGE);

const lateral = Number(process.argv[2] ?? -1.0);
const turnDeg = Number(process.argv[3] ?? 40);
const power = Number(process.argv[4] ?? 0.5);
const world = await initPhysics();
const track = new Track(TEST_TRACK);
track.createCollider(world);
const game = new Game(world, track, new THREE.Scene(), { ...DEFAULT_RULES, orderByPosition: false }, {
  message: (t) => console.log('  ' + t), turnStart: () => {}, flick: () => {}, changed: () => {}, raceOver: () => {},
}, 1);
game.start([{ name: 'P', ai: false, pose: { t: 0.12, lateral, heading: 0 } }]);
const car = game.current!.car;
for (let i = 0; i < 120; i++) { world.step(); game.afterStep(PHYS_DT); }
const deg = (r: number) => ((r * 180) / Math.PI).toFixed(1);
const q0 = track.query(car.position.x, car.position.z);
console.log(`rest: lateral ${q0.d.toFixed(2)} yaw ${deg(car.yaw)} upDot ${car.upDot.toFixed(3)} y-ground ${(car.position.y - track.heightAt(car.position.x, car.position.z)).toFixed(3)}`);
const wanted = car.yaw - (turnDeg * Math.PI) / 180; // positive turnDeg = right, as in scenarios
const taken = game.rotateCurrent(wanted)!;
console.log(`aim: wanted ${deg(wanted)} taken ${deg(taken)}`);
const x0 = car.position.x, z0 = car.position.z;
game.flick({ x: 0, z: 0 }, power);
console.log(`after commit: yaw ${deg(car.yaw)} upDot ${car.upDot.toFixed(3)} y-ground ${(car.position.y - track.heightAt(car.position.x, car.position.z)).toFixed(3)}`);
// Placement quality: each wheel's clearance over the physics surface (negative = sunk in) and the chassis floor's.
const clear = car.wheels.map((w) => { const t = w.translation(); return (t.y - 0.12 - track.surfaceHeightAt(t.x, t.z)).toFixed(3); });
const b = car.body.translation();
console.log(`wheel clearance FL FR RL RR: ${clear.join(' ')}  chassis floor over ground at centre: ${(b.y - 0.07 - track.surfaceHeightAt(b.x, b.z)).toFixed(3)}`);
for (const tEnd of [0.05, 0.15, 0.4, 1.0]) {
  let t = 0;
  while (t < tEnd) { world.step(); game.afterStep(PHYS_DT); t += PHYS_DT; }
  const dx = car.position.x - x0, dz = car.position.z - z0;
  console.log(`t=${tEnd}s moved ${Math.hypot(dx, dz).toFixed(2)} along ${deg(Math.atan2(-dz, dx))} nose ${deg(car.yaw)} upDot ${car.upDot.toFixed(2)} speed ${car.speed.toFixed(1)}`);
}
