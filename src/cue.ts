import * as THREE from 'three';
import { CAR, FLICK } from './config.ts';
import { maxPowerForTurn } from './ai.ts';
import { powerColor } from './indicator.ts';

/** Ground height under a point; the cue conforms its wedge to it. */
export type HeightAt = (x: number, z: number) => number;

const WEDGE_RADIUS = 2.4;
const WEDGE_RINGS = 12;
const WEDGE_SEGMENTS = 48;

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
 * Pulsing glowing ring under the car: the "this one is yours, drag from here" cue. While a drag is on, the ring gives
 * way to the turn wedge: the 90° sector of headings the flick may take, centred on the heading the car rests with.
 */
export class TurnCue {
  readonly group: THREE.Group;
  private readonly ring: THREE.Mesh;
  private readonly glow: THREE.Mesh;
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
    const ringGeo = new THREE.RingGeometry(0.62, 0.74, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, this.ringMaterial);
    this.ring.renderOrder = 9;

    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
    const glowGeo = new THREE.CircleGeometry(0.9, 48);
    glowGeo.rotateX(-Math.PI / 2);
    this.glow = new THREE.Mesh(glowGeo, this.glowMaterial);
    this.glow.renderOrder = 8;

    this.group.add(this.glow, this.ring);
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

  /** Follow the car and pulse. */
  update(car: THREE.Vector3, time: number): void {
    if (!this.active) return;
    const groundY = car.y - CAR.restHeight + 0.05;
    this.group.position.set(car.x, groundY, car.z);
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
    const k = 1 + pulse * 0.14;
    this.ring.scale.set(k, 1, k);
    this.ringMaterial.opacity = 0.6 + pulse * 0.4;
    this.glow.scale.set(1 + pulse * 0.25, 1, 1 + pulse * 0.25);
    this.glowMaterial.opacity = 0.08 + pulse * 0.14;
  }
}
