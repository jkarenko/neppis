// Top-down map of one six-car heat on Hietsu: the track edges and every flick as a line from start to rest,
// one colour per driver, written as an SVG. `DRIVERS=id,id,...`, `SEED=`, `OUT=map.svg`.
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { initPhysics } from '../../src/physics.ts';
import { Track } from '../../src/track.ts';
import { TRACK_BY_NAME } from '../../src/tracks/index.ts';
import { Game } from '../../src/game.ts';
import { DEFAULT_RULES, PHYS_DT } from '../../src/config.ts';
import { DRIVER_BY_ID } from '../../src/roster.ts';
const world = await initPhysics();
const track = new Track(TRACK_BY_NAME['hietsu']);
track.createCollider(world);
const ids = (process.env.DRIVERS ?? 'bastion-vette,harald-frost,bea-line,mike-rometer,the-dune,gene-lazy').split(',');
const colors = ['#e63946', '#1d7ed8', '#2a9d8f', '#f4a261', '#8338ec', '#444444'];
const lines: string[] = [];
let over = false; let start: { x: number; z: number } | null = null; let who = 0;
const game = new Game(world, track, new THREE.Scene(), { ...DEFAULT_RULES, laps: 1 }, {
  message: () => {}, turnStart: () => {}, raceOver: () => { over = true; },
  flick: (p) => { who = game.players.indexOf(p); start = { x: p.car.position.x, z: p.car.position.z }; },
  changed: () => {
    if (game.lastOutcome && start) {
      const p = game.players[who]; const e = p.car.position;
      lines.push(`<line x1="${start.x.toFixed(2)}" y1="${start.z.toFixed(2)}" x2="${e.x.toFixed(2)}" y2="${e.z.toFixed(2)}" stroke="${colors[who]}" stroke-width="0.12" stroke-linecap="round"/><circle cx="${e.x.toFixed(2)}" cy="${e.z.toFixed(2)}" r="0.16" fill="${colors[who]}"/>`);
      game.lastOutcome = null; start = null;
    }
  },
}, Number(process.env.SEED ?? 5));
game.start(ids.map((id) => ({ name: DRIVER_BY_ID[id].name, ai: true, profile: DRIVER_BY_ID[id].profile })));
let t = 0;
while (!over && t < 2000) { world.step(); game.afterStep(PHYS_DT); t += PHYS_DT; }
const hw = track.halfWidth; const n = track.n;
const edge = (side: number) => Array.from({ length: n + 1 }, (_, i) => { const p = track.pointAt(i % n); const g = track.tangentAt(i % n); return `${(p.x - g.z * hw * side).toFixed(2)},${(p.z + g.x * hw * side).toFixed(2)}`; }).join(' ');
const xs: number[] = [], zs: number[] = [];
for (let i = 0; i < n; i++) { const p = track.pointAt(i); xs.push(p.x); zs.push(p.z); }
const minX = Math.min(...xs) - 2, maxX = Math.max(...xs) + 2, minZ = Math.min(...zs) - 2, maxZ = Math.max(...zs) + 2;
const legend = ids.map((id, i) => `<text x="${(minX + 0.5).toFixed(1)}" y="${(minZ + 1 + i * 0.9).toFixed(1)}" font-size="0.7" fill="${colors[i]}" font-family="sans-serif">${DRIVER_BY_ID[id].name}: ${game.players[i].flicks} flicks</text>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}" width="1600"><rect x="${minX}" y="${minZ}" width="${maxX - minX}" height="${maxZ - minZ}" fill="#f1e6cf"/><polygon points="${edge(1)}" fill="#c9b48d"/><polygon points="${edge(-1)}" fill="#f1e6cf"/><polyline points="${edge(1)}" fill="none" stroke="#7a6a4a" stroke-width="0.06"/><polyline points="${edge(-1)}" fill="none" stroke="#7a6a4a" stroke-width="0.06"/>${lines.join('')}${legend}</svg>`;
writeFileSync(process.env.OUT ?? 'map.svg', svg);
console.log(`wrote ${process.env.OUT ?? 'map.svg'}: ${lines.length} flicks`);
