import * as THREE from 'three';
import { CAR, FLICK } from './config.ts';

/** A 90° sector on the ground in front of the car: the headings a flick may take. */
function sector(radius: number, halfAngle: number, segments = 24): THREE.BufferGeometry {
  const pts = [0, 0, 0];
  for (let i = 0; i <= segments; i++) {
    const a = -halfAngle + (2 * halfAngle * i) / segments;
    pts.push(Math.cos(a) * radius, 0, -Math.sin(a) * radius);
  }
  const idx: number[] = [];
  for (let i = 1; i <= segments; i++) idx.push(0, i + 1, i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
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
  private readonly wedgeFill: THREE.MeshBasicMaterial;
  private readonly wedgeRim: THREE.LineBasicMaterial;
  private active = false;
  private wedgeOn = false;

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
    this.wedgeFill = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide });
    const fill = new THREE.Mesh(sector(2.4, halfAngle), this.wedgeFill);
    fill.renderOrder = 7;
    this.wedgeRim = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    const rimPts: THREE.Vector3[] = [new THREE.Vector3(Math.cos(halfAngle) * 2.4, 0, Math.sin(halfAngle) * 2.4), new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(halfAngle) * 2.4, 0, -Math.sin(halfAngle) * 2.4)];
    const rim = new THREE.Line(new THREE.BufferGeometry().setFromPoints(rimPts), this.wedgeRim);
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
   * Show the wedge in the driver's colour, its centre line along `yaw`, at the car. `pushing` means the finger asks
   * for more turn than the wedge gives: the fill brightens and the rim goes white, a change that reads in every car
   * colour (red would clash with the ribbon's own "risky" red).
   */
  showWedge(color: number, car: THREE.Vector3, yaw: number, pushing = false): void {
    this.wedgeFill.color.set(color);
    this.wedgeFill.opacity = pushing ? 0.34 : 0.16;
    this.wedgeRim.color.set(pushing ? 0xffffff : color);
    this.wedgeRim.opacity = pushing ? 1 : 0.85;
    this.wedge.position.set(car.x, car.y - CAR.restHeight + 0.045, car.z);
    this.wedge.rotation.y = yaw;
    this.wedge.visible = true;
    this.wedgeOn = true;
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
