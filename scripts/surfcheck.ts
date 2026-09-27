// Which collider does a downward ray hit along the calibration straight, and at what height?
// Exits 1 if any ray misses or lands more than TOLERANCE off the expected physics surface.
import { initPhysics, RAPIER } from '../src/physics.ts';
import { Track } from '../src/track.ts';
import { CAL_TRACK } from '../src/tracks/calibration.ts';
import { TRACK_DETAIL } from '../src/config.ts';
if (process.env.FINE_CELL) TRACK_DETAIL.fineCell = Number(process.env.FINE_CELL);
const TOLERANCE = Number(process.env.TOLERANCE ?? 0.003);
const world = await initPhysics();
const tTrack = performance.now();
const track = new Track(CAL_TRACK);
console.log(`track built in ${(performance.now() - tTrack).toFixed(0)} ms (coarse ${track.coarse.ncols}x${track.coarse.nrows}, fine ${track.fine.ncols}x${track.fine.nrows})`);
const t0 = performance.now();
const [coarseCol, fineCol] = track.createCollider(world);
console.log(`colliders built in ${(performance.now() - t0).toFixed(0)} ms; sand tris ${track.coarseGeo().indices.length / 3}, ribbon tris ${track.ribbonGeo().indices.length / 3}`);
world.step();
let failures = 0;
function probe(label: string, x: number, z: number, extra = ''): void {
  const hit = world.castRay(new RAPIER.Ray({ x, y: 5, z }, { x: 0, y: -1, z: 0 }), 20, true);
  const which = hit ? (hit.collider.handle === fineCol.handle ? 'fine' : hit.collider.handle === coarseCol.handle ? 'coarse' : 'other') : 'none';
  const expected = track.surfaceHeightAt(x, z);
  const y = hit ? 5 - hit.timeOfImpact : null;
  const err = y === null ? Infinity : Math.abs(y - expected);
  const bad = err > TOLERANCE;
  if (bad) failures++;
  console.log(`${bad ? 'FAIL ' : ''}${label} hit=${which} y=${y?.toFixed(4) ?? '-'} expected=${expected.toFixed(4)}${extra}`);
}
for (const d of [0, 0.7, 1.0, 1.5, 1.64, 1.66, 1.8, 2.5, 4]) {
  const p0 = track.pointAt(200); const tg0 = track.tangentAt(200);
  const x = p0.x + -tg0.z * d, z = p0.z + tg0.x * d;
  probe(`d=${d}`, x, z, ` ribbon=${track.ribbonHeightAt(x, z)?.toFixed(4)} analytic=${track.heightAt(x, z).toFixed(4)}`);
}
for (let x = 0; x <= 20; x += 2) {
  const p = track.pointAt(track.nearest(x, -8.5));
  probe(`x=${p.x.toFixed(1)} z=${p.z.toFixed(2)}`, p.x, p.z);
}
if (failures > 0) {
  console.error(`${failures} probe(s) off the physics surface by more than ${TOLERANCE * 1000} mm`);
  process.exit(1);
}
console.log(`all probes within ${TOLERANCE * 1000} mm of the physics surface`);
