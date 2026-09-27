import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CAR, FLICK, GRAVITY, WHEEL } from './config.ts';

const WHEEL_X = 0.28;
const WHEEL_Z = 0.2;
const WHEEL_Y = -0.08;
const WHEEL_OFFSETS: [number, number, number][] = [
  [WHEEL_X, WHEEL_Y, -WHEEL_Z],
  [WHEEL_X, WHEEL_Y, WHEEL_Z],
  [-WHEEL_X, WHEEL_Y, -WHEEL_Z],
  [-WHEEL_X, WHEEL_Y, WHEEL_Z],
];

/** Quaternion for a yaw about +Y. Forward is +X, so forward = (cos yaw, 0, -sin yaw). */
export function yawQuat(yaw: number): { x: number; y: number; z: number; w: number } {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

function rotateY(v: [number, number, number], yaw: number): { x: number; y: number; z: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: v[0] * c + v[2] * s, y: v[1], z: -v[0] * s + v[2] * c };
}

/**
 * A neppis car as five rigid bodies: a chassis and four wheels on revolute joints.
 * Rolling, skidding, grip and tipping all come out of the wheels' contact with the sand.
 * The only non-contact force is a rolling-resistance brake on each axle.
 */
export type HeightAt = (x: number, z: number) => number;

/** A resting pose: chassis centre and orientation. */
export interface RestPose {
  x: number;
  y: number;
  z: number;
  q: THREE.Quaternion;
}

/**
 * Where a car with this yaw would rest at (x, z): pitched and rolled onto the plane through the ground under its
 * four wheels, so a car on the ridge leans with it. Wheel positions are sampled at the yaw only; the lean itself
 * moves them by millimetres, which is below the terrain's own texture.
 */
export function restPose(x: number, z: number, yaw: number, heightAt: HeightAt): RestPose {
  const h = WHEEL_OFFSETS.map((off) => {
    const p = rotateY(off, yaw);
    return heightAt(x + p.x, z + p.z);
  });
  // Offsets: 0 front-left, 1 front-right, 2 rear-left, 3 rear-right (+X forward, +Z right).
  const pitch = Math.atan2((h[0] + h[1] - h[2] - h[3]) / 2, 2 * WHEEL_X); // nose up is positive about +Z
  const roll = Math.atan2((h[0] + h[2] - h[1] - h[3]) / 2, 2 * WHEEL_Z); // left side up tilts the car right, about +X
  const q = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), roll));
  const y = (h[0] + h[1] + h[2] + h[3]) / 4 + CAR.restHeight + 0.02;
  return { x, y, z, q };
}

export class Car {
  readonly body: RAPIER.RigidBody;
  readonly wheels: RAPIER.RigidBody[] = [];
  readonly mesh: THREE.Group;
  readonly color: number;
  private readonly chassisMesh: THREE.Group;
  private readonly wheelMeshes: THREE.Mesh[] = [];
  private readonly world: RAPIER.World;
  private restTime = 0;
  /** While aiming, the nose turn is shown on the meshes only; the bodies stay asleep where they are. */
  private preview: RestPose | null = null;

  constructor(world: RAPIER.World, color: number, x: number, z: number, groundY: number, yaw: number) {
    this.world = world;
    this.color = color;
    const y = groundY + CAR.restHeight + 0.02;
    const q = yawQuat(yaw);

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(q).setAngularDamping(0.2),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.36, 0.09, 0.15).setTranslation(0, 0.02, 0).setFriction(0.6).setRestitution(0.05).setDensity(1.0),
      this.body,
    );

    for (const off of WHEEL_OFFSETS) {
      const p = rotateY(off, yaw);
      const wheel = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(x + p.x, y + p.y, z + p.z).setRotation(q),
      );
      // A tyre: a cylinder with slightly rounded rims. Rapier's cylinder axis is Y, so it is
      // rotated a quarter turn about X to spin on the axle's Z.
      world.createCollider(
        RAPIER.ColliderDesc.roundCylinder(WHEEL.halfWidth, CAR.wheelRadius - WHEEL.rimRadius, WHEEL.rimRadius)
          .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
          .setFriction(WHEEL.friction)
          .setRestitution(0.1)
          .setDensity(WHEEL.density),
        wheel,
      );
      this.wheels.push(wheel);
    }
    // Rolling resistance of damp sand: a constant torque on each axle opposing the wheel's spin,
    // equal to the rolling coefficient times the wheel's share of the car's weight times its radius.
    const wheelLoad = (this.mass * -GRAVITY) / 4;
    const brakeTorque = WHEEL.rollingCoefficient * wheelLoad * CAR.wheelRadius;
    WHEEL_OFFSETS.forEach((off, i) => {
      const params = RAPIER.JointData.revolute({ x: off[0], y: off[1], z: off[2] }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
      const joint = world.createImpulseJoint(params, this.body, this.wheels[i], true) as RAPIER.RevoluteImpulseJoint;
      joint.setContactsEnabled(false);
      joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
      joint.configureMotorVelocity(0, WHEEL.brakeStiffness);
      joint.setMotorMaxForce(brakeTorque);
    });

    this.mesh = new THREE.Group();
    this.chassisMesh = Car.buildChassisMesh(color);
    this.mesh.add(this.chassisMesh);
    const wheelGeo = new THREE.CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, 0.1, 18);
    wheelGeo.rotateX(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.11, 6);
    hubGeo.rotateX(Math.PI / 2);
    const rubber = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.3, metalness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Mesh(wheelGeo, rubber);
      const hub = new THREE.Mesh(hubGeo, chrome);
      w.add(hub);
      w.castShadow = true;
      w.receiveShadow = true;
      this.wheelMeshes.push(w);
      this.mesh.add(w);
    }
    this.sync();
  }

  static buildChassisMesh(color: number): THREE.Group {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 });
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
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return g;
  }

  /** Chassis plus wheels. */
  get mass(): number {
    return this.body.mass() + this.wheels.reduce((m, w) => m + w.mass(), 0);
  }

  /** Height of the whole car's centre of mass, chassis and wheels together. */
  get centreOfMassY(): number {
    let m = this.body.mass();
    let my = m * this.body.worldCom().y;
    for (const w of this.wheels) {
      const wm = w.mass();
      m += wm;
      my += wm * w.worldCom().y;
    }
    return my / m;
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

  private placeAt(pose: RestPose): void {
    const { x, y, z, q } = pose;
    const zero = { x: 0, y: 0, z: 0 };
    this.body.setTranslation({ x, y, z }, true);
    this.body.setRotation(q, true);
    this.body.setLinvel(zero, true);
    this.body.setAngvel(zero, true);
    this.wheels.forEach((w, i) => {
      const p = new THREE.Vector3(...WHEEL_OFFSETS[i]).applyQuaternion(q);
      w.setTranslation({ x: x + p.x, y: y + p.y, z: z + p.z }, true);
      w.setRotation(q, true);
      w.setLinvel(zero, true);
      w.setAngvel(zero, true);
    });
    this.restTime = 0;
    this.preview = null;
    this.sync();
  }

  /** Set the car down at rest, leaning with the ground under its wheels. */
  setPose(x: number, z: number, yaw: number, heightAt: HeightAt): void {
    this.placeAt(restPose(x, z, yaw, heightAt));
  }

  /** Show the nose turned to this yaw, conforming to the ground, without touching the physics bodies. */
  setPreview(yaw: number, heightAt: HeightAt): void {
    const t = this.body.translation();
    this.preview = restPose(t.x, t.z, yaw, heightAt);
    this.sync();
  }

  clearPreview(): void {
    this.preview = null;
    this.sync();
  }

  /** Move the bodies to the previewed pose, ready to launch. */
  commitPreview(): void {
    if (this.preview) this.placeAt(this.preview);
  }

  /**
   * Strike the car with the finger. A flick is, to the car, an instant acceleration: the car is
   * handed over already rolling along its nose at the launch speed, wheels spinning in step with
   * it, exactly as it would be after a run-up on flat sand. From here on everything is physics:
   * rolling resistance, grip, ridges, jumps, collisions and tipping.
   */
  flick(power: number): void {
    const p = Math.max(0, Math.min(1, power));
    const speed = FLICK.maxSpeed * Math.pow(p, FLICK.speedExp);
    const f = this.forward;
    const v = { x: f.x * speed, y: 0, z: f.z * speed };
    // Axle axis is the wheel's local +Z; rolling forward without slip means spin = -v / r about it.
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion);
    const spin = axis.multiplyScalar(-speed / CAR.wheelRadius);
    this.body.wakeUp();
    this.body.setLinvel(v, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (const w of this.wheels) {
      w.wakeUp();
      w.setLinvel(v, true);
      w.setAngvel({ x: spin.x, y: spin.y, z: spin.z }, true);
    }
    this.restTime = 0;
  }

  /** True once the car has been at rest for a short while. */
  settled(dt: number): boolean {
    if (this.body.isSleeping() && this.wheels.every((w) => w.isSleeping())) return true;
    const v = this.body.linvel();
    const a = this.body.angvel();
    let moving = Math.hypot(v.x, v.y, v.z) > 0.15 || Math.hypot(a.x, a.y, a.z) > 0.25;
    for (const w of this.wheels) {
      const wa = w.angvel();
      if (Math.hypot(wa.x, wa.y, wa.z) > 1.0) moving = true;
    }
    this.restTime = moving ? 0 : this.restTime + dt;
    return this.restTime > 0.35;
  }

  sync(): void {
    if (this.preview) {
      const { x, y, z, q } = this.preview;
      this.chassisMesh.position.set(x, y, z);
      this.chassisMesh.quaternion.copy(q);
      this.wheelMeshes.forEach((m, i) => {
        m.position.set(x, y, z).add(new THREE.Vector3(...WHEEL_OFFSETS[i]).applyQuaternion(q));
        m.quaternion.copy(q);
      });
      return;
    }
    const t = this.body.translation();
    const r = this.body.rotation();
    this.chassisMesh.position.set(t.x, t.y, t.z);
    this.chassisMesh.quaternion.set(r.x, r.y, r.z, r.w);
    this.wheels.forEach((w, i) => {
      const wt = w.translation();
      const wr = w.rotation();
      this.wheelMeshes[i].position.set(wt.x, wt.y, wt.z);
      this.wheelMeshes[i].quaternion.set(wr.x, wr.y, wr.z, wr.w);
    });
  }

  dispose(): void {
    for (const w of this.wheels) this.world.removeRigidBody(w);
    this.world.removeRigidBody(this.body);
  }
}
