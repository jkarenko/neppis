import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

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

export interface TrackQuery {
  /** Nearest centreline sample index. */
  index: number;
  /** Lap fraction 0..1. */
  t: number;
  /** Signed lateral distance from the centreline, positive to the right of travel. */
  d: number;
  onTrack: boolean;
}

const CELL = 0.125;
const SAMPLE_STEP = 0.1;
/** Cars whose centre is within this margin outside the strip still count as on the track. */
const ON_TRACK_MARGIN = 0.15;
const FLOOR_DEPTH = 0.08;
const RIDGE_HEIGHT = 0.12;
const RIDGE_HALF = 0.3;

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

export class Track {
  readonly def: TrackDef;
  readonly curve: THREE.CatmullRomCurve3;
  readonly samples: THREE.Vector3[];
  readonly tangents: THREE.Vector3[];
  readonly length: number;
  readonly n: number;
  readonly sizeX: number;
  readonly sizeZ: number;
  readonly nrows: number;
  readonly ncols: number;
  readonly heights: Float32Array;
  mesh: THREE.Group | null = null;

  private readonly coarseStep: number;

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
    this.coarseStep = 12;

    this.sizeX = def.area[0];
    this.sizeZ = def.area[1];
    this.ncols = Math.round(this.sizeX / CELL);
    this.nrows = Math.round(this.sizeZ / CELL);
    this.heights = this.buildHeights();
  }

  get halfWidth(): number {
    return this.def.width / 2;
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

  /** Analytic terrain height at a point. */
  heightAt(x: number, z: number): number {
    const q = this.query(x, z);
    return this.profile(q, x, z);
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
    // Loose sand outside the track is rough.
    const rough = 0.035 * (noise2(x * 2.1, z * 2.1) - 0.5) + 0.015 * (noise2(x * 7, z * 7) - 0.5);
    const outsideMix = smooth(Math.max(0, Math.min(1, (ad - hw) / RIDGE_HALF)));
    h += rough * outsideMix;
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

  private buildHeights(): Float32Array {
    const { nrows, ncols } = this;
    const heights = new Float32Array((nrows + 1) * (ncols + 1));
    for (let j = 0; j <= ncols; j++) {
      const x = -this.sizeX / 2 + (j / ncols) * this.sizeX;
      for (let i = 0; i <= nrows; i++) {
        const z = -this.sizeZ / 2 + (i / nrows) * this.sizeZ;
        heights[j * (nrows + 1) + i] = this.heightAt(x, z);
      }
    }
    return heights;
  }

  vertexX(j: number): number {
    return -this.sizeX / 2 + (j / this.ncols) * this.sizeX;
  }

  vertexZ(i: number): number {
    return -this.sizeZ / 2 + (i / this.nrows) * this.sizeZ;
  }

  createCollider(world: RAPIER.World): RAPIER.Collider {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const desc = RAPIER.ColliderDesc.heightfield(
      this.nrows,
      this.ncols,
      this.heights,
      { x: this.sizeX, y: 1, z: this.sizeZ },
      RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES,
    )
      .setFriction(0.8)
      .setRestitution(0.05);
    return world.createCollider(desc, body);
  }

  /** Visual meshes: flat-shaded terrain, a smooth track ribbon and a crisp finish line. */
  createMesh(): THREE.Group {
    const group = new THREE.Group();
    group.add(this.createTerrainMesh());
    group.add(this.createRibbonMesh());
    group.add(this.createFinishLine());
    this.mesh = group;
    return group;
  }

  private createTerrainMesh(): THREE.Mesh {
    const { nrows, ncols } = this;
    const vertCount = (nrows + 1) * (ncols + 1);
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const outer = this.halfWidth + RIDGE_HALF * 1.5;
    const sand = new THREE.Color(0xdcc7a0);
    const sandDark = new THREE.Color(0xc4ad82);
    const floor = new THREE.Color(0x9d8562);
    const c = new THREE.Color();
    for (let j = 0; j <= ncols; j++) {
      const x = this.vertexX(j);
      for (let i = 0; i <= nrows; i++) {
        const z = this.vertexZ(i);
        const v = j * (nrows + 1) + i;
        positions[v * 3] = x;
        positions[v * 3 + 1] = this.heights[v];
        positions[v * 3 + 2] = z;
        const q = this.query(x, z);
        if (Math.abs(q.d) < outer) {
          c.copy(floor);
        } else {
          // Coarse patches of lighter and darker sand with crisp edges.
          const level = Math.floor(noise2(x * 0.45, z * 0.45) * 4) / 3;
          c.copy(sand).lerp(sandDark, level);
        }
        colors[v * 3] = c.r;
        colors[v * 3 + 1] = c.g;
        colors[v * 3 + 2] = c.b;
      }
    }
    const indices = new Uint32Array(nrows * ncols * 6);
    let k = 0;
    for (let j = 0; j < ncols; j++) {
      for (let i = 0; i < nrows; i++) {
        const a = j * (nrows + 1) + i;
        const b = a + 1;
        const cIdx = a + (nrows + 1);
        const d = cIdx + 1;
        indices[k++] = a;
        indices[k++] = b;
        indices[k++] = cIdx;
        indices[k++] = b;
        indices[k++] = d;
        indices[k++] = cIdx;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
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

  /** Tiny pixel texture across the track: ridge, damp floor, ridge. Nearest filtering keeps it crisp. */
  private createRibbonTexture(): THREE.CanvasTexture {
    const w = 16;
    const h = 16;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const ridge = ['#e9d9b3', '#f1e3c0', '#e2d0a8'];
    const floor = ['#9d8562', '#a68d69', '#95805e'];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const edge = y < 3 || y >= h - 3;
        const n = hash2(x, y);
        const palette = edge ? ridge : floor;
        ctx.fillStyle = n < 0.72 ? palette[0] : n < 0.88 ? palette[1] : palette[2];
        if (edge && (y === 1 || y === h - 2)) ctx.fillStyle = '#f4e8c8';
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
    const hw = this.halfWidth;
    const outer = hw + RIDGE_HALF * 1.5;
    const offsets = [-outer, -(hw + 0.3), -(hw + 0.15), -hw, -hw / 2, 0, hw / 2, hw, hw + 0.15, hw + 0.3, outer];
    const stride = 2; // one ring every 0.2 units
    const rings = Math.floor(this.samples.length / stride);
    const rows = offsets.length;
    const positions = new Float32Array(rings * rows * 3);
    const uvs = new Float32Array(rings * rows * 2);
    const texRepeat = outer * 2; // square pixels: the texture spans the ribbon width
    for (let r = 0; r < rings; r++) {
      const idx = r * stride;
      const p = this.samples[idx];
      const tg = this.tangents[idx];
      const rx = -tg.z;
      const rz = tg.x;
      for (let k = 0; k < rows; k++) {
        const d = offsets[k];
        const x = p.x + rx * d;
        const z = p.z + rz * d;
        const v = r * rows + k;
        positions[v * 3] = x;
        positions[v * 3 + 1] = this.heightAt(x, z) + 0.012;
        positions[v * 3 + 2] = z;
        uvs[v * 2] = (idx * SAMPLE_STEP) / texRepeat;
        uvs[v * 2 + 1] = (d + outer) / (2 * outer);
      }
    }
    const indices = new Uint32Array(rings * (rows - 1) * 6);
    let n = 0;
    for (let r = 0; r < rings; r++) {
      const r2 = (r + 1) % rings;
      for (let k = 0; k < rows - 1; k++) {
        const a = r * rows + k;
        const b = a + 1;
        const c = r2 * rows + k;
        const d = c + 1;
        indices[n++] = a;
        indices[n++] = c;
        indices[n++] = b;
        indices[n++] = b;
        indices[n++] = c;
        indices[n++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: this.createRibbonTexture(),
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  private createFinishLine(): THREE.Mesh {
    // Squares across the track (cols) and along it (rowsN). The quad's u axis runs along the
    // track and v across it, so the canvas is rowsN wide and cols tall.
    const cols = 6;
    const rowsN = 2;
    const canvas = document.createElement('canvas');
    canvas.width = rowsN;
    canvas.height = cols;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < cols; y++) {
      for (let x = 0; x < rowsN; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#f6f1e4' : '#2b2a28';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const square = this.def.width / cols;
    const geo = new THREE.PlaneGeometry(square * rowsN, this.def.width);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    const p = this.samples[0];
    const tg = this.tangents[0];
    mesh.position.set(p.x, this.heightAt(p.x, p.z) + 0.02, p.z);
    mesh.rotation.y = Math.atan2(-tg.z, tg.x);
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
