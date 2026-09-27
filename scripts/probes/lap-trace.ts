// One AI driver alone for a lap: per flick, the planned distance against what it actually gained along the track.
//   ./node_modules/.bin/tsx scripts/probes/lap-trace.ts [driver-id]     TRACK=hietsu|cal|test
import * as THREE from 'three';
import { initPhysics } from '../../src/physics.ts';
import { Track } from '../../src/track.ts';
import { TRACK_BY_NAME } from '../../src/tracks/index.ts';
import { Game } from '../../src/game.ts';
import { DEFAULT_RULES, PHYS_DT } from '../../src/config.ts';
import { distanceForPower } from '../../src/flickmodel.ts';
import { DRIVER_BY_ID } from '../../src/roster.ts';
const world = await initPhysics();
const track = new Track(TRACK_BY_NAME[process.env.TRACK ?? 'hietsu']);
track.createCollider(world);
const who = process.argv[2] ?? 'gene-lazy';
const d = DRIVER_BY_ID[who];
let over = false;
let before = { t: 0, x: 0, z: 0, heading: 0 };
let n = 0;
const heading = (p: { car: { position: { x: number; z: number }; yaw: number } }) => { const q = track.query(p.car.position.x, p.car.position.z); const g = track.tangentAt(q.index); return ((Math.atan2(-g.z, g.x) - p.car.yaw) * 180 / Math.PI + 540) % 360 - 180; };
const game = new Game(world, track, new THREE.Scene(), { ...DEFAULT_RULES, laps: 1 }, {
  message: (t) => console.log('    ' + t),
  turnStart: () => {},
  flick: (p) => { before = { t: p.progress, x: p.car.position.x, z: p.car.position.z, heading: heading(p) }; },
  changed: () => {
    if (game.lastOutcome && game.current && game.lastPlan) {
      const p = game.current; n++;
      const planned = distanceForPower(game.lastPlan.power);
      const gained = (p.progress - before.t) * track.length;
      const moved = Math.hypot(p.car.position.x - before.x, p.car.position.z - before.z);
      console.log(`${String(n).padStart(2)} t=${before.t.toFixed(2)} head=${before.heading.toFixed(0).padStart(4)}° ${game.lastPlan.kind.padEnd(7)} pow=${game.lastPlan.power.toFixed(2)} planned=${planned.toFixed(1).padStart(4)} moved=${moved.toFixed(1).padStart(4)} gained=${gained.toFixed(1).padStart(5)} ${game.lastPlan.clamped ? 'clamped' : ''} ${game.lastOutcome !== 'ok' ? game.lastOutcome : ''}`);
      game.lastOutcome = null;
    }
  },
  raceOver: () => { over = true; },
}, 3);
game.start([{ name: d.name, ai: true, profile: d.profile }]);
let t = 0;
while (!over && t < 600) { world.step(); game.afterStep(PHYS_DT); t += PHYS_DT; }
console.log(`${d.name}: ${n} flicks for one lap`);
