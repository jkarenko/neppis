// Headless AI-vs-AI race to exercise the rules engine without a browser.
import * as THREE from 'three';
import { initPhysics } from '../src/physics.ts';
import { Track, TRACKS } from '../src/track.ts';
import { Game } from '../src/game.ts';
import { DEFAULT_RULES, PHYS_DT } from '../src/config.ts';

const world = await initPhysics();
const track = new Track(TRACKS[0]);
track.createCollider(world);
const scene = new THREE.Scene();
console.log(`track "${track.def.name}" length ${track.length.toFixed(1)} units, ${track.samples.length} samples`);

let turns = 0;
let flicks = 0;
const outcomes: Record<string, number> = {};
let over = false;
const game = new Game(world, track, scene, { ...DEFAULT_RULES, laps: 1 }, {
  message: (t) => console.log('  ' + t),
  turnStart: (p) => {
    turns++;
    console.log(`round ${game.round} turn ${turns}: ${p.name} progress=${p.progress.toFixed(2)} at (${p.car.position.x.toFixed(1)}, ${p.car.position.z.toFixed(1)})`);
  },
  flick: () => flicks++,
  changed: () => {
    if (game.lastOutcome) outcomes[game.lastOutcome] = (outcomes[game.lastOutcome] ?? 0) + 1;
    game.lastOutcome = null;
  },
  raceOver: (placings) => {
    over = true;
    console.log('RACE OVER:', placings.map((p) => `${p.place}. ${p.name}`).join('  '));
  },
}, 42);
game.start([{ name: 'Kalle', ai: true }, { name: 'Pena', ai: true }, { name: 'Simo', ai: true }]);

let t = 0;
while (!over && t < 600) {
  game.beforeStep(PHYS_DT);
  world.step();
  game.afterStep(PHYS_DT);
  t += PHYS_DT;
}
console.log(`simulated ${t.toFixed(0)} s, ${turns} turns, ${flicks} flicks, outcomes`, outcomes);
if (!over) {
  console.log('race did not finish', game.players.map((p) => `${p.name} lap=${p.lap} t=${p.t.toFixed(2)}`));
  process.exit(1);
}
