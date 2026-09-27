import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { TRACK_DETAIL } from './config.ts';

export interface TrackFeature {
  /** Position along the lap, 0..1. */
  t: number;
  kind: 'jump' | 'dip';
}

export interface TrackDef {
  name: string;
  /** Track width in world units (1.5 = 15 cm, an adult foot). */
  width: number;
  /** Closed loop control points on the ground plane, [x, z]. */
  points: [number, number][];
  features: TrackFeature[];
  /** Total terrain size [x, z]. */
  area: [number, number];
}

export const TRACKS: TrackDef[] = [
  {
    name: 'Hietsu',
    width: 1.5,
    area: [56, 40],
    points: [
      [1, -12.8], [8, -13], [18, -9], [21, -1], [15, 5], [7, 3],
      [1, 8], [-7, 13], [-17, 10], [-22, 1], [-18, -9], [-6, -12],
    ],
    features: [
      { t: 0.27, kind: 'jump' },
      { t: 0.62, kind: 'dip' },
    ],
  },
];

export interface GeoData {
  positions: Float32Array;
  indices: Uint32Array;
  uvs?: Float32Array;
  colors?: Float32Array;
}

export interface TrackQuery {
  /** Nearest centreline sample index. */
  index: number;
  /** Lap fraction 0..1. */
  t: number;
  /** Signed lateral distance from the centreline, positive to the right of travel. */
  d: number;
  onTrack: boolean;
}

/** A regular height grid: the shape Rapier's heightfield collider and our meshes share. */
interface Grid {
  cell: number;
  ncols: number;
  nrows: number;
  /** Grid centre in world space. */
  cx: number;
  cz: number;
  /** Column-major heights, (ncols+1) x (nrows+1), as Rapier expects. */
  heights: Float32Array;
}

/** Centreline samples are this far apart; also the ribbon's ring spacing. */
const SAMPLE_STEP = 0.1;
/** Physics and visual grid for the loose sand outside: 5 cm, low-poly on purpose. */
const CELL_COARSE = 0.5;
/** Cars whose centre is within this margin outside the strip still count as on the track. */
const ON_TRACK_MARGIN = 0.15;
const FLOOR_DEPTH = 0.08;
const RIDGE_HEIGHT = 0.12;
const RIDGE_HALF = 0.3;
/** The ribbon reaches this far beyond the ridge, as a band of foot-smoothed sand. */
const RIBBON_EXTRA = 0.45;
/** The coarse surface is sunk over this distance in from the ribbon edge. */
const OVERLAP = 0.3;
/**
 * The coarse mesh is cut per pixel this far inside the ribbon edge. Inside the cut nothing of it
 * is drawn, so it can never poke through the ribbon; outside, every pixel is covered by one or
 * the other. The margin covers the error of interpolating the lateral distance across a cell.
 */
const CUT_INSET = 0.1;
/** Whichever surface is hidden under the other is sunk at least this far, so it is never touched. */
const SINK = 0.03;

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0, 1]. */
function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** Height of a grid's triangulated surface at a point, split on the same diagonal Rapier uses. */
function gridHeightAt(g: Grid, x: number, z: number): number {
  const fj = (x - g.cx) / g.cell + g.ncols / 2;
  const fi = (z - g.cz) / g.cell + g.nrows / 2;
  const j = Math.max(0, Math.min(g.ncols - 1, Math.floor(fj)));
  const i = Math.max(0, Math.min(g.nrows - 1, Math.floor(fi)));
  const u = Math.max(0, Math.min(1, fj - j));
  const v = Math.max(0, Math.min(1, fi - i));
  const h = (jj: number, ii: number) => g.heights[jj * (g.nrows + 1) + ii];
  const a = h(j, i);
  const b = h(j, i + 1);
  const c = h(j + 1, i);
  const d = h(j + 1, i + 1);
  // Triangles (a, b, c) and (b, d, c): the diagonal runs from b to c.
  if (u + v <= 1) return a + (c - a) * u + (b - a) * v;
  return d + (b - d) * (1 - u) + (c - d) * (1 - v);
}

export class Track {
  readonly def: TrackDef;
  readonly curve: THREE.CatmullRomCurve3;
  readonly samples: THREE.Vector3[];
  readonly tangents: THREE.Vector3[];
  readonly length: number;
  readonly n: number;
  readonly sizeX: number;
  readonly sizeZ: number;
  mesh: THREE.Group | null = null;

  /** Lateral offsets of the ribbon's vertex rows, ridge and smoothed band included. */
  readonly rows: number[];
  /** Ribbon vertex heights, [ring * rows + row]. Every vertex is the analytic height. */
  readonly ribbonHeights: Float32Array;
  readonly coarse: Grid;
  readonly fine: Grid;

  private readonly coarseStep = 12;
  private coarseGeoCache: GeoData | null = null;
  private ribbonGeoCache: GeoData | null = null;

  constructor(def: TrackDef) {
    this.def = def;
    this.curve = new THREE.CatmullRomCurve3(
      def.points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      'centripetal',
    );
    this.length = this.curve.getLength();
    this.n = Math.ceil(this.length / SAMPLE_STEP);
    const pts = this.curve.getSpacedPoints(this.n);
    pts.pop();
    this.samples = pts;
    this.tangents = pts.map((_, i) => {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const next = pts[(i + 1) % pts.length];
      return next.clone().sub(prev).setY(0).normalize();
    });
    this.sizeX = def.area[0];
    this.sizeZ = def.area[1];

    const hw = this.halfWidth;
    const outer = this.ribbonOuter;
    // Floor rows every 12.5 mm so the millimetre roughness is resolved across as well as along.
    const half: number[] = [];
    for (let d = 0; d < hw - 1e-6; d += 0.125) half.push(d);
    half.push(hw, hw + 0.15, hw + 0.3, hw + 0.45, outer - 0.3, outer - 0.15, outer);
    this.rows = [...half.slice(1).reverse().map((d) => -d), ...half];
    this.coarse = this.buildCoarse();
    this.ribbonHeights = this.buildRibbonHeights();
    this.fine = this.buildFine();
  }

  get halfWidth(): number {
    return this.def.width / 2;
  }

  /** How far from the centreline the ribbon reaches: ridge plus a band of smoothed sand. */
  get ribbonOuter(): number {
    return this.halfWidth + RIDGE_HALF * 1.5 + RIBBON_EXTRA;
  }

  /** Index of the nearest centreline sample (coarse pass, then local refinement). */
  nearest(x: number, z: number): number {
    const s = this.samples;
    const n = s.length;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i += this.coarseStep) {
      const dx = s[i].x - x;
      const dz = s[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    for (let k = -this.coarseStep; k <= this.coarseStep; k++) {
      const i = (best + k + n) % n;
      const dx = s[i].x - x;
      const dz = s[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  query(x: number, z: number): TrackQuery {
    const index = this.nearest(x, z);
    const p = this.samples[index];
    const tg = this.tangents[index];
    // right = forward x up
    const rx = -tg.z;
    const rz = tg.x;
    const d = (x - p.x) * rx + (z - p.z) * rz;
    return {
      index,
      t: index / this.n,
      d,
      onTrack: Math.abs(d) <= this.halfWidth + ON_TRACK_MARGIN,
    };
  }

  wrapIndex(i: number): number {
    const n = this.samples.length;
    return ((Math.round(i) % n) + n) % n;
  }

  pointAt(index: number): THREE.Vector3 {
    return this.samples[this.wrapIndex(index)];
  }

  tangentAt(index: number): THREE.Vector3 {
    return this.tangents[this.wrapIndex(index)];
  }

  /** Signed distance along the lap from a to b in world units, in (-length/2, length/2]. */
  distanceAlong(fromIndex: number, toIndex: number): number {
    const n = this.samples.length;
    let di = (toIndex - fromIndex) % n;
    if (di > n / 2) di -= n;
    if (di <= -n / 2) di += n;
    return di * SAMPLE_STEP;
  }

  indexOffset(index: number, distance: number): number {
    return this.wrapIndex(index + distance / SAMPLE_STEP);
  }

  /** Analytic terrain height at a point: the design the meshes are built from. */
  heightAt(x: number, z: number): number {
    const q = this.query(x, z);
    return this.profile(q, x, z);
  }

  /** Height of the physics surface at a point, i.e. what a wheel would rest on. */
  surfaceHeightAt(x: number, z: number): number {
    const r = this.ribbonHeightAt(x, z);
    const c = gridHeightAt(this.coarse, x, z);
    return r === null ? c : Math.max(r, c);
  }

  private profile(q: TrackQuery, x: number, z: number): number {
    const hw = this.halfWidth;
    const ad = Math.abs(q.d);
    const ridgeCentre = hw + RIDGE_HALF * 0.5;
    const outer = ridgeCentre + RIDGE_HALF;
    let h: number;
    if (ad < hw) {
      h = -FLOOR_DEPTH;
    } else if (ad < outer) {
      const u = (ad - ridgeCentre) / RIDGE_HALF; // -0.5 .. 1
      const bump = Math.cos((Math.PI / 2) * Math.max(-1, Math.min(1, u)));
      const base = ad < ridgeCentre ? -FLOOR_DEPTH * (1 - (ad - hw) / (ridgeCentre - hw)) : 0;
      h = base + RIDGE_HEIGHT * bump * bump;
    } else {
      h = 0;
    }
    // Loose sand outside the track undulates gently. Wavelengths stay well above the coarse cell.
    const rough = 0.05 * (noise2(x * 0.6, z * 0.6) - 0.5) + 0.02 * (noise2(x * 0.9 + 5, z * 0.9 + 9) - 0.5);
    const outsideMix = smooth(Math.max(0, Math.min(1, (ad - hw) / RIDGE_HALF)));
    h += rough * outsideMix;
    // Damp, foot-smoothed sand still has millimetre texture: rolling bumps, no rigid grains.
    const fine = TRACK_DETAIL.fineTexture * (0.006 * (noise2(x * 2 + 11, z * 2 + 5) - 0.5) + 0.004 * (noise2(x * 2.7 + 3, z * 2.7 + 17) - 0.5));
    h += fine * (1 - outsideMix);
    // Features (jumps, dips) across the track, fading out over the ridge.
    const inTrack = 1 - smooth(Math.max(0, Math.min(1, (ad - hw) / (RIDGE_HALF * 1.5))));
    if (inTrack > 0) {
      for (const f of this.def.features) {
        const s = this.distanceAlong(Math.round(f.t * this.n), q.index);
        if (f.kind === 'jump') {
          const half = 1.3;
          if (Math.abs(s) < half) {
            const c = Math.cos((Math.PI / 2) * (s / half));
            h += 0.28 * c * c * inTrack;
          }
        } else {
          const half = 1.1;
          if (Math.abs(s) < half) {
            const c = Math.cos((Math.PI / 2) * (s / half));
            h -= 0.16 * c * c * inTrack;
          }
        }
      }
    }
    return h;
  }

  // ---- Ribbon: the track as a strip of quads along the centreline ------------------------

  private ribbonVertex(ring: number, row: number): { x: number; z: number } {
    const p = this.samples[ring];
    const tg = this.tangents[ring];
    const d = this.rows[row];
    return { x: p.x + -tg.z * d, z: p.z + tg.x * d };
  }

  private buildRibbonHeights(): Float32Array {
    const rings = this.samples.length;
    const rows = this.rows.length;
    const heights = new Float32Array(rings * rows);
    for (let r = 0; r < rings; r++) {
      for (let k = 0; k < rows; k++) {
        const v = this.ribbonVertex(r, k);
        // The outermost rows lie exactly on the coarse sand surface, so the seam is watertight.
        const edge = k === 0 || k === rows - 1;
        heights[r * rows + k] = edge ? gridHeightAt(this.coarse, v.x, v.z) : this.heightAt(v.x, v.z);
      }
    }
    return heights;
  }

  /**
   * Height of the ribbon's triangulated surface at a point, or null outside the ribbon.
   * Uses the same triangle split as the ribbon mesh, so the physics grid built from this is
   * the drawn surface itself, resampled.
   */
  ribbonHeightAt(x: number, z: number): number | null {
    const q = this.query(x, z);
    const outer = this.ribbonOuter;
    if (Math.abs(q.d) >= outer) return null;
    const rings = this.samples.length;
    const rows = this.rows.length;
    const p = this.samples[q.index];
    const tg = this.tangents[q.index];
    // Continuous ring coordinate: nearest sample plus the projection along its tangent.
    const along = ((x - p.x) * tg.x + (z - p.z) * tg.z) / SAMPLE_STEP;
    let r0 = q.index + Math.floor(along);
    const fs = along - Math.floor(along);
    r0 = ((r0 % rings) + rings) % rings;
    const r1 = (r0 + 1) % rings;
    let k = 0;
    while (k < rows - 2 && this.rows[k + 1] <= q.d) k++;
    const fd = (q.d - this.rows[k]) / (this.rows[k + 1] - this.rows[k]);
    const H = this.ribbonHeights;
    const a = H[r0 * rows + k];
    const b = H[r0 * rows + k + 1];
    const c = H[r1 * rows + k];
    const d = H[r1 * rows + k + 1];
    // Quad split into (a, b, c) and (b, d, c), as in ribbonGeo().
    if (fs + fd <= 1) return a + (c - a) * fs + (b - a) * fd;
    return d + (b - d) * (1 - fs) + (c - d) * (1 - fd);
  }

  ribbonGeo(): GeoData {
    if (this.ribbonGeoCache) return this.ribbonGeoCache;
    const rings = this.samples.length;
    const rows = this.rows.length;
    const outer = this.ribbonOuter;
    const positions = new Float32Array(rings * rows * 3);
    const uvs = new Float32Array(rings * rows * 2);
    for (let r = 0; r < rings; r++) {
      for (let k = 0; k < rows; k++) {
        const v = this.ribbonVertex(r, k);
        const i = r * rows + k;
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = this.ribbonHeights[i];
        positions[i * 3 + 2] = v.z;
        // u runs once around the lap, v across the ribbon.
        uvs[i * 2] = r / rings;
        uvs[i * 2 + 1] = (this.rows[k] + outer) / (2 * outer);
      }
    }
    // The last ring joins the first; duplicate it with u = 1 so the texture does not smear at the seam.
    const seamPos = new Float32Array((rings + 1) * rows * 3);
    const seamUv = new Float32Array((rings + 1) * rows * 2);
    seamPos.set(positions);
    seamUv.set(uvs);
    for (let k = 0; k < rows; k++) {
      const src = k;
      const dst = rings * rows + k;
      seamPos[dst * 3] = positions[src * 3];
      seamPos[dst * 3 + 1] = positions[src * 3 + 1];
      seamPos[dst * 3 + 2] = positions[src * 3 + 2];
      seamUv[dst * 2] = 1;
      seamUv[dst * 2 + 1] = uvs[src * 2 + 1];
    }
    const indices = new Uint32Array(rings * (rows - 1) * 6);
    let n = 0;
    for (let r = 0; r < rings; r++) {
      for (let k = 0; k < rows - 1; k++) {
        const a = r * rows + k;
        const b = a + 1;
        const c = (r + 1) * rows + k;
        const d = c + 1;
        // Wound so the normal points up: rows run to the right, rings along the track.
        indices[n++] = a;
        indices[n++] = b;
        indices[n++] = c;
        indices[n++] = b;
        indices[n++] = d;
        indices[n++] = c;
      }
    }
    this.ribbonGeoCache = { positions: seamPos, indices, uvs: seamUv };
    return this.ribbonGeoCache;
  }

  // ---- Grids: coarse sand outside, fine physics under the ribbon ----------------------------

  private makeGrid(cell: number, sizeX: number, sizeZ: number, cx: number, cz: number, height: (x: number, z: number) => number): Grid {
    const ncols = Math.ceil(sizeX / cell);
    const nrows = Math.ceil(sizeZ / cell);
    const heights = new Float32Array((ncols + 1) * (nrows + 1));
    for (let j = 0; j <= ncols; j++) {
      const x = cx + (j - ncols / 2) * cell;
      for (let i = 0; i <= nrows; i++) {
        const z = cz + (i - nrows / 2) * cell;
        heights[j * (nrows + 1) + i] = height(x, z);
      }
    }
    return { cell, ncols, nrows, cx, cz, heights };
  }

  /** The loose sand. Under the ribbon it is sunk so the ribbon is always the surface on top. */
  private buildCoarse(): Grid {
    const outer = this.ribbonOuter;
    return this.makeGrid(CELL_COARSE, this.sizeX, this.sizeZ, 0, 0, (x, z) => {
      const q = this.query(x, z);
      const h = this.profile(q, x, z);
      const ad = Math.abs(q.d);
      if (ad >= outer) return h;
      // Ramp the sink in from the seam so the surface just outside the ribbon is untouched.
      const inward = outer - ad;
      return h - SINK * Math.min(1, inward / OVERLAP) - 0.15 * Math.max(0, inward - OVERLAP) / outer;
    });
  }

  /** Physics under the track: the ribbon surface resampled. Outside it, just below the coarse surface. */
  private buildFine(): Grid {
    const outer = this.ribbonOuter;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of this.samples) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const pad = outer + 1;
    const sizeX = maxX - minX + 2 * pad;
    const sizeZ = maxZ - minZ + 2 * pad;
    return this.makeGrid(TRACK_DETAIL.fineCell, sizeX, sizeZ, (minX + maxX) / 2, (minZ + maxZ) / 2, (x, z) => {
      const r = this.ribbonHeightAt(x, z);
      if (r !== null) return r;
      return gridHeightAt(this.coarse, x, z) - SINK;
    });
  }

  /**
   * Vertex-coloured coarse sand. The colour's alpha is not opacity: it is the lateral distance
   * past the cut line plus one half, unclamped, so it interpolates linearly across a triangle and
   * an alpha test at 0.5 discards exactly the pixels inside the cut. Triangles wholly inside are
   * left out altogether.
   */
  coarseGeo(): GeoData {
    if (this.coarseGeoCache) return this.coarseGeoCache;
    const g = this.coarse;
    const { ncols, nrows } = g;
    const vertCount = (ncols + 1) * (nrows + 1);
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 4);
    const lateral = new Float32Array(vertCount);
    const cut = this.ribbonOuter - CUT_INSET;
    const sand = new THREE.Color(0xdcc7a0);
    const sandDark = new THREE.Color(0xc4ad82);
    const c = new THREE.Color();
    for (let j = 0; j <= ncols; j++) {
      const x = g.cx + (j - ncols / 2) * g.cell;
      for (let i = 0; i <= nrows; i++) {
        const z = g.cz + (i - nrows / 2) * g.cell;
        const v = j * (nrows + 1) + i;
        positions[v * 3] = x;
        positions[v * 3 + 1] = g.heights[v];
        positions[v * 3 + 2] = z;
        lateral[v] = Math.abs(this.query(x, z).d);
        // Coarse patches of lighter and darker sand with crisp edges.
        const level = Math.floor(noise2(x * 0.45, z * 0.45) * 4) / 3;
        c.copy(sand).lerp(sandDark, level);
        colors[v * 4] = c.r;
        colors[v * 4 + 1] = c.g;
        colors[v * 4 + 2] = c.b;
        colors[v * 4 + 3] = lateral[v] - cut + 0.5;
      }
    }
    const keep = cut;
    const indices: number[] = [];
    for (let j = 0; j < ncols; j++) {
      for (let i = 0; i < nrows; i++) {
        const a = j * (nrows + 1) + i;
        const b = a + 1;
        const cIdx = a + (nrows + 1);
        const d = cIdx + 1;
        const tri = (p: number, q: number, r: number) => {
          if (Math.max(lateral[p], lateral[q], lateral[r]) >= keep) indices.push(p, q, r);
        };
        tri(a, b, cIdx);
        tri(b, d, cIdx);
      }
    }
    this.coarseGeoCache = { positions, indices: new Uint32Array(indices), colors };
    return this.coarseGeoCache;
  }

  // ---- Physics and visuals -----------------------------------------------------------------

  createCollider(world: RAPIER.World): RAPIER.Collider[] {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const make = (g: Grid) =>
      world.createCollider(
        RAPIER.ColliderDesc.heightfield(
          g.nrows,
          g.ncols,
          g.heights,
          { x: g.ncols * g.cell, y: 1, z: g.nrows * g.cell },
          RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES,
        )
          .setTranslation(g.cx, 0, g.cz)
          .setFriction(0.8)
          .setRestitution(0.05),
        body,
      );
    return [make(this.coarse), make(this.fine)];
  }

  /** Visual meshes. Browser only (textures). */
  createMesh(): THREE.Group {
    const group = new THREE.Group();
    group.add(this.createCoarseMesh());
    group.add(this.createRibbonMesh());
    this.mesh = group;
    return group;
  }

  private createCoarseMesh(): THREE.Mesh {
    const g = this.coarseGeo();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(g.colors!, 4));
    geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      // See coarseGeo(): the vertex alpha encodes the cut line, this test applies it.
      alphaTest: 0.5,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * One pixel texture for the whole lap, never repeated, so anything painted on the track
   * (the finish line, later tyre marks or grid slots) is simply part of the track's texture.
   * 24 rows across: smoothed sand, ridge, damp floor, ridge, smoothed sand. Nearest filtering keeps it crisp.
   */
  private createRibbonTexture(): THREE.CanvasTexture {
    const h = 24;
    const pixel = (2 * this.ribbonOuter) / h;
    const w = Math.max(8, Math.round(this.length / pixel));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const sand = ['#dcc7a0', '#d4be96', '#e2cfaa'];
    const ridge = ['#e9d9b3', '#f1e3c0', '#e2d0a8'];
    const floor = ['#9d8562', '#a68d69', '#95805e'];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const fromEdge = Math.min(y, h - 1 - y);
        const palette = fromEdge < 3 ? sand : fromEdge < 6 ? ridge : floor;
        const n = hash2(x, y);
        ctx.fillStyle = n < 0.72 ? palette[0] : n < 0.88 ? palette[1] : palette[2];
        if (fromEdge === 4) ctx.fillStyle = '#f4e8c8';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Finish line: 2 x 2 pixel checker squares across the damp floor, straddling u = 0.
    for (let y = 6; y < h - 6; y++) {
      for (let dx = -2; dx < 2; dx++) {
        const x = (dx + w) % w;
        const square = Math.floor((y - 6) / 2) + Math.floor((dx + 2) / 2);
        ctx.fillStyle = square % 2 === 0 ? '#f6f1e4' : '#2b2a28';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createRibbonMesh(): THREE.Mesh {
    const g = this.ribbonGeo();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(g.uvs!, 2));
    geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: this.createRibbonTexture(), roughness: 0.95, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Starting grid: staggered slots just behind the start line, nose along the track. */
  startSlots(count: number): { x: number; z: number; yaw: number; index: number }[] {
    const slots: { x: number; z: number; yaw: number; index: number }[] = [];
    for (let k = 0; k < count; k++) {
      const idx = this.indexOffset(0, -(1.0 + k * 1.1));
      const p = this.pointAt(idx);
      const tg = this.tangentAt(idx);
      const lateral = (k % 2 === 0 ? -1 : 1) * 0.33;
      slots.push({
        x: p.x + -tg.z * lateral,
        z: p.z + tg.x * lateral,
        yaw: Math.atan2(-tg.z, tg.x),
        index: idx,
      });
    }
    return slots;
  }
}
