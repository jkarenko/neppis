// A car parked against the track edge, aimed away from it: does the launch follow the previewed nose?
// Prints the previewed yaw, the body yaw after the release settle, and the direction of travel early in the flick.
//   ./node_modules/.bin/tsx scripts/probes/edge-away.ts [lateral] [turnDeg] [power]
import * as THREE from 'three';
import { initPhysics } from '../../src/physics.ts';
import { Track } from '../../src/track.ts';
import { TEST_TRACK } from '../../src/tracks/test.ts';
import { Game } from '../../src/game.ts';
import { DEFAULT_RULES, PHYS_DT } from '../../src/config.ts';

const lateral = Number(process.argv[2] ?? 0.6);
const turnDeg = Number(process.argv[3] ?? -40);
const power = Number(process.argv[4] ?? 0.4);
const world = await initPhysics();
const track = new Track(TEST_TRACK);
track.createCollider(world);
const game = new Game(world, track, new THREE.Scene(), { ...DEFAULT_RULES, orderByPosition: false }, {
  message: () => {}, turnStart: () => {}, flick: () => {}, changed: () => {}, raceOver: () => {},
}, 1);
game.start([{ name: 'P', ai: false, pose: { t: 0.12, lateral, heading: 0 } }]);
const car = game.current!.car;
for (let i = 0; i < 120; i++) { world.step(); game.afterStep(PHYS_DT); }
const deg = (r: number) => ((r * 180) / Math.PI).toFixed(1);
const restYaw = car.yaw;
const wanted = restYaw - (turnDeg * Math.PI) / 180;
const taken = game.rotateCurrent(wanted)!;
// Peek at the preview pose through the mesh the preview drives.
const meshYaw = () => { const f = new THREE.Vector3(1, 0, 0).applyQuaternion(car.mesh.children[0].quaternion); return Math.atan2(-f.z, f.x); };
const previewYaw = meshYaw();
const x0 = car.position.x, z0 = car.position.z;
game.flick({ x: 0, z: 0 }, power);
const bodyYawAtLaunch = car.yaw;
const wheelClear = car.wheels.map((w) => { const t = w.translation(); return (t.y - 0.12 - track.surfaceHeightAt(t.x, t.z)).toFixed(3); });
console.log(`lateral ${lateral} aim ${turnDeg}° power ${power}`);
console.log(`  rest yaw ${deg(restYaw)}  wanted ${deg(wanted)}  taken ${deg(taken)}  preview mesh ${deg(previewYaw)}  body after settle ${deg(bodyYawAtLaunch)}  drift in settle ${deg(bodyYawAtLaunch - taken)}`);
console.log(`  wheel clearance at launch FL FR RL RR: ${wheelClear.join(' ')}`);
for (const tEnd of [0.03, 0.08, 0.15, 0.3, 0.8]) {
  let t = 0;
  while (t < tEnd) { world.step(); game.afterStep(PHYS_DT); t += PHYS_DT; }
  const dx = car.position.x - x0, dz = car.position.z - z0;
  const q = track.query(car.position.x, car.position.z);
  console.log(`  t=${tEnd}s moved ${Math.hypot(dx, dz).toFixed(2)} along ${deg(Math.atan2(-dz, dx))}  nose ${deg(car.yaw)}  lateral ${q.d.toFixed(2)}  speed ${car.speed.toFixed(1)}`);
}
