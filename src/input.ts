import * as THREE from 'three';
import { FLICK } from './config.ts';

export interface AimState {
  /** Where the pointer is now, on the ground plane. */
  current: THREE.Vector3;
  /** Unit flick direction on the ground plane (from the finger through the car). */
  dir: { x: number; z: number };
  power: number;
  /** False while the drag is still too short to count as a flick. */
  valid: boolean;
}

export interface InputHandlers {
  /** Car position to aim at, or null when flick input is not accepted right now. */
  target: () => THREE.Vector3 | null;
  /** The aim changed, or (null) the drag was let go without a flick. */
  onAim: (aim: AimState | null) => void;
  /** The drag was released as a flick; no onAim(null) precedes this. */
  onFlick: (dir: { x: number; z: number }, power: number) => void;
}

/**
 * Pointer handling for mouse, touch and pen. A drag that starts on the car winds up a flick:
 * the direction runs from the finger through the car and the power is how far the finger is
 * from the car on screen, so it does not depend on the camera zoom. Drags that start anywhere
 * else are left to the camera controls. A second pointer cancels the aim.
 */
export class FlickInput {
  private pointerId: number | null = null;
  private readonly active = new Set<number>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly ndc = new THREE.Vector2();
  private aim: AimState | null = null;
  private carPx = { x: 0, y: 0 };

  constructor(
    private readonly dom: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly h: InputHandlers,
  ) {
    // Capture phase so a drag that starts on the car never reaches the camera controls.
    dom.addEventListener('pointerdown', this.onDown, { capture: true });
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointercancel', this.onUp);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private groundPoint(ev: PointerEvent, y: number): THREE.Vector3 | null {
    return this.groundPointAt(ev.clientX, ev.clientY, y);
  }

  private groundPointAt(clientX: number, clientY: number, y: number): THREE.Vector3 | null {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.plane.constant = -y;
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.plane, out);
  }

  private screenPoint(world: THREE.Vector3): { x: number; y: number } {
    const rect = this.dom.getBoundingClientRect();
    const v = world.clone().project(this.camera);
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  /** Drag length in CSS pixels that gives full power. */
  private fullDragPx(): number {
    const rect = this.dom.getBoundingClientRect();
    return Math.min(rect.width, rect.height) * FLICK.maxDragFraction;
  }

  private cancel(): void {
    if (this.aim) this.h.onAim(null);
    this.pointerId = null;
    this.aim = null;
  }

  private readonly onDown = (ev: PointerEvent): void => {
    this.active.add(ev.pointerId);
    if (this.active.size > 1) {
      this.cancel();
      return;
    }
    if (this.pointerId !== null) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const target = this.h.target();
    if (!target) return;
    const g = this.groundPoint(ev, target.y);
    if (!g) return;
    // The drag has to begin on the car: close on the ground, or within a finger's width on screen.
    this.carPx = this.screenPoint(target);
    const groundDist = Math.hypot(g.x - target.x, g.z - target.z);
    const screenDist = Math.hypot(ev.clientX - this.carPx.x, ev.clientY - this.carPx.y);
    if (groundDist > FLICK.grabRadius && screenDist > FLICK.grabRadiusPx) return;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    this.pointerId = ev.pointerId;
    this.aim = { current: g.clone(), dir: this.dirTo(target, g), power: 0, valid: false };
    this.h.onAim(this.aim);
    try {
      this.dom.setPointerCapture(ev.pointerId);
    } catch {
      /* not supported */
    }
  };

  private dirTo(target: THREE.Vector3, from: THREE.Vector3): { x: number; z: number } {
    const dx = target.x - from.x;
    const dz = target.z - from.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.15) return this.aim?.dir ?? { x: 1, z: 0 };
    return { x: dx / len, z: dz / len };
  }

  private readonly onMove = (ev: PointerEvent): void => {
    if (ev.pointerId !== this.pointerId || !this.aim) return;
    const target = this.h.target();
    if (!target) {
      this.cancel();
      return;
    }
    const dragPx = Math.hypot(ev.clientX - this.carPx.x, ev.clientY - this.carPx.y);
    const maxPx = FLICK.deadZonePx + this.fullDragPx();
    // Past full power the drag saturates: the shown finger point stops moving away from the car.
    const k = dragPx > maxPx ? maxPx / dragPx : 1;
    const g = this.groundPointAt(
      this.carPx.x + (ev.clientX - this.carPx.x) * k,
      this.carPx.y + (ev.clientY - this.carPx.y) * k,
      target.y,
    );
    if (!g) return;
    const aim = this.aim;
    aim.current.copy(g);
    aim.power = Math.max(0, Math.min(1, (dragPx - FLICK.deadZonePx) / this.fullDragPx()));
    aim.valid = dragPx >= FLICK.cancelPx;
    aim.dir = this.dirTo(target, g);
    this.h.onAim(aim);
  };

  private readonly onUp = (ev: PointerEvent): void => {
    this.active.delete(ev.pointerId);
    if (ev.pointerId !== this.pointerId) return;
    if (this.aim && this.aim.valid && ev.type === 'pointerup') {
      // A flick, not a cancel: onAim(null) is not sent, so the handler keeps the aimed pose it is about to launch.
      const { dir, power } = this.aim;
      this.pointerId = null;
      this.aim = null;
      this.h.onFlick(dir, power);
      return;
    }
    this.cancel();
  };
}
