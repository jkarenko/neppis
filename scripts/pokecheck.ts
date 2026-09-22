// How far does the terrain grid surface rise above the draped track ribbon underneath it?
import { Track, TRACKS } from '../src/track.ts';
const track = new Track(TRACKS[0]);
const hw = track.halfWidth;
const outer = track.ribbonOuter;
const cell = track.sizeX / track.ncols;
// Terrain surface as rendered: triangles over the grid, bilinear-ish via the same split as createTerrainMesh.
function terrainY(x: number, z: number): number {
  const fj = (x + track.sizeX / 2) / cell;
  const fi = (z + track.sizeZ / 2) / cell;
  const j = Math.floor(fj);
  const i = Math.floor(fi);
  const u = fj - j;
  const v = fi - i;
  const h = (jj: number, ii: number) => track.heights[jj * (track.nrows + 1) + ii];
  const a = h(j, i), b = h(j, i + 1), c = h(j + 1, i), d = h(j + 1, i + 1);
  // triangles (a,b,c) and (b,d,c): diagonal from b to c
  if (u + v <= 1) return a + (b - a) * v + (c - a) * u;
  return d + (b - d) * (1 - u) + (c - d) * (1 - v);
}
// Ribbon surface: rings every 0.2 along, rows across at fixed offsets, linear between.
const offsets = track.ribbonOffsets();
function ribbonY(x: number, z: number): number {
  const q = track.query(x, z);
  const i0 = Math.floor(q.index / 2) * 2;
  const i1 = track.wrapIndex(i0 + 2);
  const t = (q.index - i0) / 2;
  const rowY = (idx: number, d: number) => {
    const p = track.pointAt(idx);
    const tg = track.tangentAt(idx);
    return track.heightAt(p.x + -tg.z * d, p.z + tg.x * d) + 0.02;
  };
  let k = 0;
  while (k < offsets.length - 2 && offsets[k + 1] < q.d) k++;
  const s = (q.d - offsets[k]) / (offsets[k + 1] - offsets[k]);
  const y0 = rowY(i0, offsets[k]) * (1 - s) + rowY(i0, offsets[k + 1]) * s;
  const y1 = rowY(i1, offsets[k]) * (1 - s) + rowY(i1, offsets[k + 1]) * s;
  return y0 * (1 - t) + y1 * t;
}
let worst = 0;
let count = 0;
let n = 0;
const byBand: Record<string, number> = {};
for (let x = -track.sizeX / 2 + 1; x < track.sizeX / 2 - 1; x += 0.07) {
  for (let z = -track.sizeZ / 2 + 1; z < track.sizeZ / 2 - 1; z += 0.07) {
    const q = track.query(x, z);
    // Only where terrain is still rendered: quads not touching the cut band.
    if (Math.abs(q.d) >= outer - 0.02 || Math.abs(q.d) < outer - 0.45 + 0.15 - 0.18) continue;
    n++;
    const poke = terrainY(x, z) - ribbonY(x, z);
    if (poke > 0) {
      count++;
      worst = Math.max(worst, poke);
      const band = Math.abs(q.d) < hw ? 'floor' : 'ridge';
      byBand[band] = (byBand[band] ?? 0) + 1;
    }
  }
}
console.log(`samples under ribbon: ${n}, terrain above ribbon: ${count} (${((100 * count) / n).toFixed(1)}%), worst ${worst.toFixed(3)} units`, byBand);
