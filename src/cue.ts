import * as THREE from 'three';
import { CAR, FLICK } from './config.ts';
import { maxPowerForTurn } from './ai.ts';
import { powerColor } from './indicator.ts';

/** Ground height under a point; the cue conforms its wedge to it. */
export type HeightAt = (x: number, z: number) => number;

const WEDGE_RADIUS = 2.4;
const WEDGE_RINGS = 12;
const WEDGE_SEGMENTS = 48;
const RING_INNER = 0.62;
const RING_OUTER = 0.74;
const GLOW_RADIUS = 0.9;
const DISC_SEGMENTS = 48;

/**
 * A flat annulus (or disc, with inner 0) as rows of rings so that, like the wedge, every vertex can be lifted to
 * the ground under it. The polar template is kept so the ring can be resized and re-laid each frame as it pulses.
 */
class Disc {
  readonly geometry: THREE.BufferGeometry;
  private readonly radius: Float32Array;
  private readonly angle: Float32Array;

  constructor(inner: number, outer: number, rows: number) {
    const n = (rows + 1) * (DISC_SEGMENTS + 1);
    this.radius = new Float32Array(n);
    this.angle = new Float32Array(n);
    let v = 0;
    for (let r = 0; r <= rows; r++) {
      for (let i = 0; i <= DISC_SEGMENTS; i++) {
        this.radius[v] = inner + ((outer - inner) * r) / rows;
        this.angle[v] = (2 * Math.PI * i) / DISC_SEGMENTS;
        v++;
      }
    }
    const idx: number[] = [];
    const row = DISC_SEGMENTS + 1;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < DISC_SEGMENTS; i++) {
        const a = r * row + i;
        idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    this.geometry.setIndex(idx);
    this.lay(0, 0, 1, () => 0);
  }

  /** Lay the disc around a point, scaled, each vertex a little above the ground under it. */
  lay(cx: number, cz: number, scale: number, heightAt: HeightAt): void {
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const r = this.radius[i] * scale;
      const x = Math.cos(this.angle[i]) * r;
      const z = -Math.sin(this.angle[i]) * r;
      pos.setXYZ(i, x, heightAt(cx + x, cz + z) + 0.05, z);
    }
    pos.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}

/**
 * A 90° sector in front of the car: the headings a flick may take, each coloured by the most power it may have
 * there (the ribbon's own scale: red straight ahead, blue at the edges). It is a grid of rings and slices so that
 * every vertex can take its own angle's colour (the colour runs the full length of a radius) and its own ground
 * height (the wedge climbs the ridge and the jump instead of vanishing under them). Positions are in the wedge's
 * local frame, x along the centre line; `conform` sets the heights for a car position and heading.
 */
function sector(halfAngle: number): THREE.BufferGeometry {
  const pts: number[] = [];
  const cols: number[] = [];
  const c = new THREE.Color();
  for (let r = 0; r <= WEDGE_RINGS; r++) {
    const radius = (WEDGE_RADIUS * r) / WEDGE_RINGS;
    for (let i = 0; i <= WEDGE_SEGMENTS; i++) {
      const a = -halfAngle + (2 * halfAngle * i) / WEDGE_SEGMENTS;
      pts.push(Math.cos(a) * radius, 0, -Math.sin(a) * radius);
      powerColor(maxPowerForTurn(a), c);
      cols.push(c.r, c.g, c.b);
    }
  }
  const idx: number[] = [];
  const row = WEDGE_SEGMENTS + 1;
  for (let r = 0; r < WEDGE_RINGS; r++) {
    for (let i = 0; i < WEDGE_SEGMENTS; i++) {
      const a = r * row + i;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  return g;
}

/**
 * Pulsing glowing ring under the car: the "this one is yours, drag from here" cue. It lies on the ground like the
 * wedge does, climbing the ridge and the jump. While a drag is on, the ring gives way to the turn wedge: the 90°
 * sector of headings the flick may take, centred on the heading the car rests with.
 */
export class TurnCue {
  readonly group: THREE.Group;
  private readonly ring: Disc;
  private readonly glow: Disc;
  private readonly ringMaterial: THREE.MeshBasicMaterial;
  private readonly glowMaterial: THREE.MeshBasicMaterial;
  private readonly wedge: THREE.Group;
  private readonly wedgeGeo: THREE.BufferGeometry;
  private readonly rimGeo: THREE.BufferGeometry;
  private readonly wedgeFill: THREE.MeshBasicMaterial;
  private readonly wedgeRim: THREE.LineBasicMaterial;
  private active = false;
  private wedgeOn = false;
  /** Where the wedge was last conformed, so the heights are resampled only when the car or heading changes. */
  private conformed = { x: NaN, z: NaN, yaw: NaN };

  constructor() {
    this.group = new THREE.Group();
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
    this.ring = new Disc(RING_INNER, RING_OUTER, 2);
    const ring = new THREE.Mesh(this.ring.geometry, this.ringMaterial);
    ring.renderOrder = 9;

    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
    this.glow = new Disc(0, GLOW_RADIUS, 5);
    const glow = new THREE.Mesh(this.glow.geometry, this.glowMaterial);
    glow.renderOrder = 8;

    this.group.add(glow, ring);
    this.group.visible = false;

    const halfAngle = (FLICK.maxTurnDeg * Math.PI) / 180;
    this.wedgeFill = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide });
    this.wedgeGeo = sector(halfAngle);
    const fill = new THREE.Mesh(this.wedgeGeo, this.wedgeFill);
    fill.renderOrder = 7;
    this.wedgeRim = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    // The rim follows the two edges out and the arc back, so it rides the ground with the fill.
    const rimPts: THREE.Vector3[] = [];
    for (let r = WEDGE_RINGS; r >= 0; r--) rimPts.push(new THREE.Vector3(Math.cos(-halfAngle) * (WEDGE_RADIUS * r) / WEDGE_RINGS, 0, -Math.sin(-halfAngle) * (WEDGE_RADIUS * r) / WEDGE_RINGS));
    for (let r = 1; r <= WEDGE_RINGS; r++) rimPts.push(new THREE.Vector3(Math.cos(halfAngle) * (WEDGE_RADIUS * r) / WEDGE_RINGS, 0, -Math.sin(halfAngle) * (WEDGE_RADIUS * r) / WEDGE_RINGS));
    for (let i = WEDGE_SEGMENTS - 1; i >= 0; i--) {
      const a = -halfAngle + (2 * halfAngle * i) / WEDGE_SEGMENTS;
      rimPts.push(new THREE.Vector3(Math.cos(a) * WEDGE_RADIUS, 0, -Math.sin(a) * WEDGE_RADIUS));
    }
    this.rimGeo = new THREE.BufferGeometry().setFromPoints(rimPts);
    const rim = new THREE.Line(this.rimGeo, this.wedgeRim);
    rim.renderOrder = 8;
    this.wedge = new THREE.Group();
    this.wedge.add(fill, rim);
    this.wedge.visible = false;
  }

  /** The scene object for the wedge; separate from the ring's group so each shows on its own. */
  get wedgeObject(): THREE.Object3D {
    return this.wedge;
  }

  /**
   * Show the wedge, its centre line along `yaw`, at the car. The fill is the power gradient; the rim is in the
   * driver's colour. `pushing` means the finger asks for more turn than the wedge gives: the fill brightens and the
   * rim goes white, a change that reads in every car colour.
   */
  showWedge(color: number, car: THREE.Vector3, yaw: number, pushing = false, heightAt?: HeightAt): void {
    this.wedgeFill.opacity = pushing ? 0.5 : 0.32;
    this.wedgeRim.color.set(pushing ? 0xffffff : color);
    this.wedgeRim.opacity = pushing ? 1 : 0.85;
    this.wedge.position.set(car.x, 0, car.z);
    this.wedge.rotation.y = yaw;
    if (heightAt) this.conform(car, yaw, heightAt);
    else this.wedge.position.y = car.y - CAR.restHeight + 0.045;
    this.wedge.visible = true;
    this.wedgeOn = true;
  }

  /** Lift every vertex to the ground under it, a little above so the fill sits on the sand and the ridge. */
  private conform(car: THREE.Vector3, yaw: number, heightAt: HeightAt): void {
    if (this.conformed.x === car.x && this.conformed.z === car.z && this.conformed.yaw === yaw) return;
    this.conformed = { x: car.x, z: car.z, yaw };
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const lift = (geo: THREE.BufferGeometry) => {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i);
        const lz = pos.getZ(i);
        // Local to world with the wedge's rotation about Y (three.js: x' = x cos + z sin, z' = -x sin + z cos).
        const wx = car.x + lx * cos + lz * sin;
        const wz = car.z - lx * sin + lz * cos;
        pos.setY(i, heightAt(wx, wz) + 0.05);
      }
      pos.needsUpdate = true;
      geo.computeBoundingSphere();
    };
    lift(this.wedgeGeo);
    lift(this.rimGeo);
  }

  hideWedge(): void {
    this.wedge.visible = false;
    this.wedgeOn = false;
  }

  get wedgeVisible(): boolean {
    return this.wedgeOn;
  }

  show(color: number): void {
    this.ringMaterial.color.set(color);
    this.glowMaterial.color.set(color);
    this.group.visible = true;
    this.active = true;
  }

  hide(): void {
    this.group.visible = false;
    this.active = false;
  }

  get visible(): boolean {
    return this.active;
  }

  /** Follow the car and pulse, laid on the ground under it; without a ground function it lies flat at the car's. */
  update(car: THREE.Vector3, time: number, heightAt?: HeightAt): void {
    if (!this.active) return;
    const flat = car.y - CAR.restHeight;
    this.group.position.set(car.x, heightAt ? 0 : flat, car.z);
    const ground = heightAt ?? (() => 0);
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
    this.ring.lay(car.x, car.z, 1 + pulse * 0.14, ground);
    this.ringMaterial.opacity = 0.6 + pulse * 0.4;
    this.glow.lay(car.x, car.z, 1 + pulse * 0.25, ground);
    this.glowMaterial.opacity = 0.08 + pulse * 0.14;
  }
}
