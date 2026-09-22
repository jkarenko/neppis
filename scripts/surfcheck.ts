// Which collider does a downward ray hit along the calibration straight, and at what height?
import { initPhysics, RAPIER } from '../src/physics.ts';
import { Track, type TrackDef } from '../src/track.ts';
import { TRACK_DETAIL } from '../src/config.ts';
if (process.env.FINE_CELL) TRACK_DETAIL.fineCell = Number(process.env.FINE_CELL);
const CAL_TRACK: TrackDef = { name: 'c', width: 1.5, area: [70, 30], points: [[0, -8.5], [28, -8], [31, 0], [28, 8], [0, 8.5], [-28, 8], [-31, 0], [-28, -8]], features: [] };
const world = await initPhysics();
const tTrack = performance.now();
const track = new Track(CAL_TRACK);
console.log(`track built in ${(performance.now() - tTrack).toFixed(0)} ms (coarse ${track.coarse.ncols}x${track.coarse.nrows}, fine ${track.fine.ncols}x${track.fine.nrows})`);
const t0 = performance.now();
const [coarseCol, fineCol] = track.createCollider(world);
console.log(`colliders built in ${(performance.now() - t0).toFixed(0)} ms; sand tris ${track.coarseGeo().indices.length / 3}, ribbon tris ${track.ribbonGeo().indices.length / 3}`);
world.step();
for (const d of [0, 0.7, 1.0, 1.5, 1.64, 1.66, 1.8, 2.5, 4]) {
  const p0 = track.pointAt(200); const tg0 = track.tangentAt(200);
  const x = p0.x + -tg0.z * d, z = p0.z + tg0.x * d;
  const hit = world.castRay(new RAPIER.Ray({ x, y: 5, z }, { x: 0, y: -1, z: 0 }), 20, true);
  const which = hit ? (hit.collider.handle === fineCol.handle ? 'fine' : 'coarse') : 'none';
  console.log(`d=${d} hit=${which} y=${hit ? (5 - hit.timeOfImpact).toFixed(4) : '-'} ribbon=${track.ribbonHeightAt(x, z)?.toFixed(4)} analytic=${track.heightAt(x, z).toFixed(4)}`);
}
for (let x = 0; x <= 20; x += 2) {
  const idx = track.nearest(x, -8.5);
  const p = track.pointAt(idx);
  const hit = world.castRay(new RAPIER.Ray({ x: p.x, y: 5, z: p.z }, { x: 0, y: -1, z: 0 }), 20, true);
  const which = hit ? (hit.collider.handle === fineCol.handle ? 'fine' : hit.collider.handle === coarseCol.handle ? 'coarse' : 'other') : 'none';
  console.log(`x=${p.x.toFixed(1)} z=${p.z.toFixed(2)} hit=${which} y=${hit ? (5 - hit.timeOfImpact).toFixed(4) : '-'} expected=${track.surfaceHeightAt(p.x, p.z).toFixed(4)}`);
}
