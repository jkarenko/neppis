import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAR, FLICK, TYRE } from './config.ts';

const WHEEL_X = 0.28;
const WHEEL_Z = 0.2;
const WHEEL_Y = -0.08;

/** Quaternion for a yaw about +Y. Forward is +X, so forward = (cos yaw, 0, -sin yaw). */
export function yawQuat(yaw: number): { x: number; y: number; z: number; w: number } {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

export class Car {
  readonly body: RAPIER.RigidBody;
  readonly mesh: THREE.Group;
  readonly color: number;
  private restTime = 0;
  private readonly world: RAPIER.World;
  private readonly ray: RAPIER.Ray;

  constructor(world: RAPIER.World, color: number, x: number, z: number, groundY: number, yaw: number) {
    this.world = world;
    this.color = color;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, groundY + CAR.restHeight + 0.02, z)
      .setRotation(yawQuat(yaw))
      .setCcdEnabled(true)
      .setLinearDamping(0.05)
      .setAngularDamping(1.0);
    this.body = world.createRigidBody(desc);

    const chassis = RAPIER.ColliderDesc.cuboid(0.36, 0.09, 0.15)
      .setTranslation(0, 0.02, 0)
      .setFriction(0.6)
      .setRestitution(0.05)
      .setDensity(1.0);
    world.createCollider(chassis, this.body);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wheel = RAPIER.ColliderDesc.ball(CAR.wheelRadius)
          .setTranslation(sx * WHEEL_X, WHEEL_Y, sz * WHEEL_Z)
          .setFriction(0.02)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
          .setRestitution(0.1)
          .setDensity(4.0);
        world.createCollider(wheel, this.body);
      }
    }
    this.ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    this.mesh = Car.buildMesh(color);
    this.sync();
  }

  static buildMesh(color: number): THREE.Group {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.3, metalness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, roughness: 0.5 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.17, 0.3), paint);
    body.position.set(-0.02, 0.02, 0);
    g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 14), paint);
    nose.rotation.z = -Math.PI / 2;
    nose.scale.set(0.6, 1, 1);
    nose.position.set(0.42, 0.0, 0);
    g.add(nose);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.22), paint);
    tail.position.set(-0.36, 0.0, 0);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.03), paint);
    fin.position.set(-0.36, 0.12, 0);
    g.add(fin);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), skin);
    head.position.set(-0.08, 0.14, 0);
    g.add(head);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.2), chrome);
    screen.position.set(0.06, 0.13, 0);
    g.add(screen);
    for (const sx of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), chrome);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(-0.25, -0.02, sx * 0.17);
      g.add(pipe);
    }
    const wheelGeo = new THREE.CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, 0.1, 18);
    wheelGeo.rotateX(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.11, 12);
    hubGeo.rotateX(Math.PI / 2);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const w = new THREE.Mesh(wheelGeo, rubber);
        w.position.set(sx * WHEEL_X, WHEEL_Y, sz * WHEEL_Z);
        g.add(w);
        const hub = new THREE.Mesh(hubGeo, chrome);
        hub.position.copy(w.position);
        g.add(hub);
      }
    }
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return g;
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get quaternion(): THREE.Quaternion {
    const r = this.body.rotation();
    return new THREE.Quaternion(r.x, r.y, r.z, r.w);
  }

  /** Heading of the nose on the ground plane. */
  get yaw(): number {
    const f = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion);
    return Math.atan2(-f.z, f.x);
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion).setY(0).normalize();
  }

  /** 1 = wheels down, -1 = on the roof, ~0 = on its side. */
  get upDot(): number {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion).y;
  }

  get speed(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  setPose(x: number, z: number, yaw: number, groundY: number): void {
    this.body.setTranslation({ x, y: groundY + CAR.restHeight + 0.02, z }, true);
    this.body.setRotation(yawQuat(yaw), true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.restTime = 0;
    this.sync();
  }

  setYaw(yaw: number): void {
    this.body.setRotation(yawQuat(yaw), true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.sync();
  }

  /**
   * Strike the car with the finger: a single horizontal impulse applied where the finger meets
   * the rear of the body. Nothing else is scripted; whether the car hops, skids or tips over is
   * decided by the physics of its contact with the sand.
   */
  flick(dirX: number, dirZ: number, power: number): void {
    const p = Math.max(0, Math.min(1, power));
    const len = Math.hypot(dirX, dirZ) || 1;
    const dx = dirX / len;
    const dz = dirZ / len;
    const speed = FLICK.maxSpeed * Math.pow(p, FLICK.speedExp);
    const j = speed * this.body.mass();
    const pos = this.body.translation();
    const point = {
      x: pos.x - dx * FLICK.contactBack,
      y: pos.y + FLICK.contactHeight,
      z: pos.z - dz * FLICK.contactBack,
    };
    this.body.wakeUp();
    this.body.applyImpulseAtPoint({ x: dx * j, y: 0, z: dz * j }, point, true);
    this.restTime = 0;
  }

  private grounded(): boolean {
    const t = this.body.translation();
    this.ray.origin.x = t.x;
    this.ray.origin.y = t.y;
    this.ray.origin.z = t.z;
    const hit = this.world.castRay(this.ray, CAR.restHeight + 0.14, true, undefined, undefined, undefined, this.body);
    return hit !== null;
  }

  /** Cheap tyre model: the car rolls easily along its nose and skids sideways. */
  updateTyres(dt: number): void {
    if (this.body.isSleeping()) return;
    if (this.upDot < 0.5) return;
    if (!this.grounded()) return;
    const f = this.forward;
    if (f.lengthSq() < 0.5) return;
    const rx = -f.z;
    const rz = f.x;
    const v = this.body.linvel();
    let vl = v.x * f.x + v.z * f.z;
    let vr = v.x * rx + v.z * rz;
    const dec = TYRE.rollDecel * dt;
    vl = Math.sign(vl) * Math.max(0, Math.abs(vl) - dec) * Math.exp(-TYRE.rollDamp * dt);
    vr *= Math.exp(-TYRE.lateralDamp * dt);
    this.body.setLinvel({ x: f.x * vl + rx * vr, y: v.y, z: f.z * vl + rz * vr }, false);
    const sp = Math.hypot(vl, vr);
    if (sp > 0.5) {
      const slip = Math.atan2(vr, vl);
      const av = this.body.angvel();
      const target = -TYRE.yawAlign * slip;
      av.y += (target - av.y) * Math.min(1, 5 * dt);
      this.body.setAngvel(av, false);
    }
  }

  /** True once the car has been at rest for a short while. */
  settled(dt: number): boolean {
    if (this.body.isSleeping()) return true;
    const v = this.body.linvel();
    const a = this.body.angvel();
    const moving = Math.hypot(v.x, v.y, v.z) > 0.15 || Math.hypot(a.x, a.y, a.z) > 0.25;
    this.restTime = moving ? 0 : this.restTime + dt;
    return this.restTime > 0.35;
  }

  sync(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.mesh.position.set(t.x, t.y, t.z);
    this.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
}
