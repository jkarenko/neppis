// Six-car heats on Hietsu: how often a flick moves a rival (a bump), by everyone and by the drivers who avoid
// contact, plus off-tracks, flips and flicks per lap. `HEATS=` (default 6). For tuning `avoid` in the planner.
import * as THREE from 'three';
import { initPhysics } from '../../src/physics.ts';
import { Track } from '../../src/track.ts';
import { TRACK_BY_NAME } from '../../src/tracks/index.ts';
import { Game } from '../../src/game.ts';
import { DEFAULT_RULES, PHYS_DT } from '../../src/config.ts';
import { ROSTER } from '../../src/roster.ts';
const avoider = (name: string) => { const d = ROSTER.find((r) => r.name === name)!; return d.profile.bully === 0 && d.nerve <= 3; };
const world = await initPhysics();
const track = new Track(TRACK_BY_NAME['hietsu']);
track.createCollider(world);
const scene = new THREE.Scene();
const HEATS = Number(process.env.HEATS ?? 6);
let flicks = 0, bumps = 0, bumpsByAvoiders = 0, flicksByAvoiders = 0, off = 0, flips = 0, laps = 0;
for (let h = 0; h < HEATS; h++) {
  const field = [0, 1, 2, 3, 4, 5].map((i) => ROSTER[(h * 5 + i * 4) % ROSTER.length]);
  let over = false;
  let before: { x: number; z: number }[] = [];
  let flicker = -1;
  const game = new Game(world, track, scene, { ...DEFAULT_RULES, laps: 2 }, {
    message: () => {}, turnStart: () => {}, raceOver: () => { over = true; },
    flick: (p) => { flicker = game.players.indexOf(p); before = game.players.map((o) => ({ x: o.car.position.x, z: o.car.position.z })); },
    changed: () => {
      if (game.lastOutcome && flicker >= 0) {
        const p = game.players[flicker];
        flicks++;
        if (avoider(p.name)) flicksByAvoiders++;
        const moved = game.players.some((o, i) => i !== flicker && Math.hypot(o.car.position.x - before[i].x, o.car.position.z - before[i].z) > 0.1);
        if (moved) { bumps++; if (avoider(p.name)) bumpsByAvoiders++; }
        if (game.lastOutcome === 'offtrack') off++;
        if (game.lastOutcome === 'kelli') flips++;
        game.lastOutcome = null; flicker = -1;
      }
    },
  }, 100 + h);
  game.start(field.map((d) => ({ name: d.name, ai: true, profile: d.profile })));
  let t = 0;
  while (!over && t < 3000) { world.step(); game.afterStep(PHYS_DT); t += PHYS_DT; }
  laps += game.players.reduce((a, p) => a + Math.max(p.lap, 0), 0);
  game.clear();
}
console.log(`${HEATS} heats: ${flicks} flicks, bumps ${bumps} (${(100 * bumps / flicks).toFixed(1)}/100), by avoiders ${bumpsByAvoiders}/${flicksByAvoiders} (${(100 * bumpsByAvoiders / Math.max(1, flicksByAvoiders)).toFixed(1)}/100), off ${off}, flips ${flips}, flicks/lap ${(flicks / laps).toFixed(1)}`);
