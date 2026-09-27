// Headless AI-vs-AI racing to exercise the rules engine and tune the drivers without a browser.
//   pnpm simrace                 three default drivers, one lap, turn-by-turn log
//   pnpm simrace roster [heats]  the whole ladder in heats of six (default: enough for everyone to race twice),
//                                then a table per driver: races, wins, mean place, flips, tips, off-tracks,
//                                flicks per lap, pulled-in flicks. LAPS=n, SEED=n, TRACK=hietsu|test|cal.
import * as THREE from 'three';
import { initPhysics } from '../src/physics.ts';
import { Track } from '../src/track.ts';
import { TRACK_BY_NAME } from '../src/tracks/index.ts';
import { Game, type PlayerSetup } from '../src/game.ts';
import { DEFAULT_RULES, FLICK, PHYS_DT } from '../src/config.ts';
import { ROSTER } from '../src/roster.ts';
import { Rng } from '../src/rng.ts';

const mode = process.argv[2] ?? 'default';
const laps = Number(process.env.LAPS ?? 1);
const seed = Number(process.env.SEED ?? 42);
const trackDef = TRACK_BY_NAME[process.env.TRACK ?? 'hietsu'];
if (!trackDef) throw new Error(`unknown TRACK: ${Object.keys(TRACK_BY_NAME).join(', ')}`);

const world = await initPhysics();
const track = new Track(trackDef);
track.createCollider(world);
const scene = new THREE.Scene();
console.log(`track "${track.def.name}" length ${track.length.toFixed(1)} units, ${track.samples.length} samples`);

interface Tally { races: number; wins: number; places: number; kelli: number; puolikelli: number; offtrack: number; flicks: number; laps: number }
const tally = new Map<string, Tally>();
const tallyOf = (name: string): Tally => {
  let t = tally.get(name);
  if (!t) tally.set(name, (t = { races: 0, wins: 0, places: 0, kelli: 0, puolikelli: 0, offtrack: 0, flicks: 0, laps: 0 }));
  return t;
};

/** One race to the finish; returns the placings. Logs turns when verbose. */
function race(setups: PlayerSetup[], raceSeed: number, verbose: boolean): { placings: string[]; flicks: number; clamped: number; seconds: number } {
  let turns = 0;
  let flicks = 0;
  let over = false;
  let placings: string[] = [];
  const outcomes: Record<string, number> = {};
  const game = new Game(world, track, scene, { ...DEFAULT_RULES, laps }, {
    message: (t) => verbose && console.log('  ' + t),
    turnStart: (p) => {
      turns++;
      if (verbose) console.log(`round ${game.round} turn ${turns}: ${p.name} progress=${p.progress.toFixed(2)} at (${p.car.position.x.toFixed(1)}, ${p.car.position.z.toFixed(1)})`);
    },
    flick: (p) => {
      flicks++;
      tallyOf(p.name).flicks++;
    },
    changed: () => {
      if (game.lastOutcome && game.current) {
        outcomes[game.lastOutcome] = (outcomes[game.lastOutcome] ?? 0) + 1;
        const t = tallyOf(game.current.name);
        if (game.lastOutcome === 'kelli') t.kelli++;
        else if (game.lastOutcome === 'puolikelli') t.puolikelli++;
        else if (game.lastOutcome === 'offtrack') t.offtrack++;
        game.lastOutcome = null;
      }
    },
    raceOver: (ps) => {
      over = true;
      placings = ps.map((p) => p.name);
      if (verbose) console.log('RACE OVER:', ps.map((p) => `${p.place}. ${p.name}`).join('  '));
    },
  }, raceSeed);
  game.start(setups);
  let t = 0;
  while (!over && t < 900) {
    world.step();
    game.afterStep(PHYS_DT);
    t += PHYS_DT;
  }
  if (verbose) {
    console.log(`simulated ${t.toFixed(0)} s, ${turns} turns, ${flicks} flicks, outcomes`, outcomes);
    console.log(`${game.aiClamped} of ${flicks} flicks had their line pulled into the ${FLICK.maxTurnDeg}° turn wedge`);
  }
  if (!over) {
    console.log('race did not finish', game.players.map((p) => `${p.name} lap=${p.lap} t=${p.t.toFixed(2)}`));
    if (mode !== 'roster') process.exit(1);
  }
  const clamped = game.aiClamped;
  game.clear();
  return { placings, flicks, clamped, seconds: t };
}

if (mode === 'roster') {
  const heats = Number(process.argv[3] ?? Math.ceil((ROSTER.length * 2) / 6));
  const rng = new Rng(seed);
  let clampedTotal = 0;
  let flicksTotal = 0;
  // Shuffle the ladder once, then deal consecutive windows of six around it, so everyone races equally often.
  const order = [...ROSTER].sort(() => rng.next() - 0.5);
  for (let h = 0; h < heats; h++) {
    const field = Array.from({ length: 6 }, (_, k) => order[(h * 6 + k) % order.length]);
    const setups = field.map((d) => ({ name: d.name, ai: true, profile: d.profile }));
    const t0 = performance.now();
    const r = race(setups, seed + h, false);
    clampedTotal += r.clamped;
    flicksTotal += r.flicks;
    r.placings.forEach((name, i) => {
      const t = tallyOf(name);
      t.races++;
      t.places += i + 1;
      t.laps += laps;
      if (i === 0) t.wins++;
    });
    console.log(`heat ${h + 1}/${heats}: ${r.placings.join(' > ')}  (${r.seconds.toFixed(0)} s simulated, ${((performance.now() - t0) / 1000).toFixed(0)} s real)`);
  }
  console.log(`\n${clampedTotal} of ${flicksTotal} flicks pulled into the ${FLICK.maxTurnDeg}° wedge\n`);
  console.log('#  driver              races wins  place  flips tips  off  flicks/lap');
  ROSTER.forEach((d, i) => {
    const t = tally.get(d.name);
    if (!t || t.races === 0) return console.log(`${String(i + 1).padStart(2)} ${d.name.padEnd(20)} did not race`);
    console.log(
      `${String(i + 1).padStart(2)} ${d.name.padEnd(20)} ${String(t.races).padStart(5)} ${String(t.wins).padStart(4)} ${(t.places / t.races).toFixed(2).padStart(6)} ` +
        `${String(t.kelli).padStart(6)} ${String(t.puolikelli).padStart(4)} ${String(t.offtrack).padStart(4)} ${(t.flicks / t.laps).toFixed(1).padStart(11)}`,
    );
  });
} else {
  race([{ name: 'Kalle', ai: true }, { name: 'Pena', ai: true }, { name: 'Simo', ai: true }], seed, true);
}
