import * as THREE from 'three';
import { CAR } from './config.ts';

/** Pulsing glowing ring under the car: the first-turn "this one is yours, drag from here" cue. */
export class TurnCue {
  readonly group: THREE.Group;
  private readonly ring: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  private readonly ringMaterial: THREE.MeshBasicMaterial;
  private readonly glowMaterial: THREE.MeshBasicMaterial;
  private active = false;

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
