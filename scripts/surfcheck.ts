// Which collider does a downward ray hit along the calibration straight, and at what height?
import { initPhysics, RAPIER } from '../src/physics.ts';
import { Track, type TrackDef } from '../src/track.ts';
const CAL_TRACK: TrackDef = { name: 'c', width: 1.5, area: [70, 30], points: [[0, -8.5], [28, -8], [31, 0], [28, 8], [0, 8.5], [-28, 8], [-31, 0], [-28, -8]], features: [] };
const world = await initPhysics();
const tTrack = performance.now();
const track = new Track(CAL_TRACK);
console.log(`track built in ${(performance.now() - tTrack).toFixed(0)} ms (${track.ncols}x${track.nrows} cells)`);
const t0 = performance.now();
const ground = track.createCollider(world);
console.log(`collider built in ${(performance.now() - t0).toFixed(0)} ms; terrain tris ${track.terrainGeo().indices.length / 3}, ribbon tris ${track.ribbonGeo().positions.length / 9}`);
world.step();
for (let x = 0; x <= 20; x += 2) {
  const idx = track.nearest(x, -8.5);
  const p = track.pointAt(idx);
  const hit = world.castRay(new RAPIER.Ray({ x: p.x, y: 5, z: p.z }, { x: 0, y: -1, z: 0 }), 20, true);
  const which = hit ? (hit.collider.handle === ground.handle ? 'ground' : 'other') : 'none';
  console.log(`x=${p.x.toFixed(1)} z=${p.z.toFixed(2)} hit=${which} y=${hit ? (5 - hit.timeOfImpact).toFixed(4) : '-'} expected=${track.heightAt(p.x, p.z).toFixed(4)}`);
}
