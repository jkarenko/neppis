// Does a rolling car behave the same on a flat trimesh as on a flat heightfield?
// Usage: tsx scripts/trimesh-test.ts <ground: hf|tri> <flags: fix|fixoriented|oriented|none>
import { initPhysics, RAPIER } from '../src/physics.ts';
import { Car } from '../src/car.ts';
import { PHYS_DT } from '../src/config.ts';

const ground = process.argv[2] ?? 'tri';
const flagName = process.argv[3] ?? 'fix';
const shape = process.argv[4] ?? 'round';
const layout = process.argv[5] ?? 'ribbon';
const world = await initPhysics();
const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
if (ground === 'hf') {
  const n = 200;
  world.createCollider(RAPIER.ColliderDesc.heightfield(n, n, new Float32Array((n + 1) * (n + 1)), { x: 50, y: 1, z: 50 }, RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES).setFriction(0.8), body);
} else {
  // Ribbon-like strip: rings every 0.1 along x, rows across z at uneven spacing like the track ribbon.
  let rows = [-1.65, -1.5, -1.35, -1.2, -1.05, -0.9, -0.75, -0.375, 0, 0.375, 0.75, 0.9, 1.05, 1.2, 1.35, 1.5, 1.65];
  let step = 0.1;
  if (layout === 'square') { rows = []; for (let z = -1.6; z <= 1.61; z += 0.1) rows.push(z); }
  if (layout === 'coarse') { rows = []; for (let z = -1.75; z <= 1.76; z += 0.25) rows.push(z); step = 0.25; }
  const rings = Math.round(40 / step);
  const pos: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r < rings; r++) for (const z of rows) pos.push(-20 + r * step, 0, z);
  for (let r = 0; r < rings - 1; r++) for (let k = 0; k < rows.length - 1; k++) {
    const a = r * rows.length + k, b = a + 1, c = a + rows.length, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const F = RAPIER.TriMeshFlags;
  const flags = flagName === 'fix' ? F.FIX_INTERNAL_EDGES : flagName === 'fixoriented' ? F.FIX_INTERNAL_EDGES | F.ORIENTED : flagName === 'oriented' ? F.ORIENTED : undefined;
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(pos), new Uint32Array(idx), flags).setFriction(0.8), body);
}
const car = new Car(world, 0, -18, 0, 0, 0);
if (shape !== 'round') {
  for (const w of car.wheels) {
    const old = w.collider(0);
    world.removeCollider(old, false);
    const desc = shape === 'ball' ? RAPIER.ColliderDesc.ball(0.12) : RAPIER.ColliderDesc.cylinder(0.05, 0.12).setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 });
    world.createCollider(desc.setFriction(0.9).setRestitution(0.1).setDensity(4), w);
  }
}
for (let i = 0; i < 240; i++) world.step();
const restY = car.position.y;
const out: string[] = [];
for (const p of [0.3, 0.6, 1.0]) {
  car.setPose(-18, 0, 0, 0);
  for (let i = 0; i < 60; i++) world.step();
  car.flick(p);
  let t = 0, maxVy = 0;
  while (t < 10) {
    world.step();
    t += PHYS_DT;
    maxVy = Math.max(maxVy, Math.abs(car.body.linvel().y));
    if (t > 0.3 && car.settled(PHYS_DT)) break;
  }
  out.push(`p=${p}: ${(car.position.x + 18).toFixed(1)} units, max |vy| ${maxVy.toFixed(2)}, up ${car.upDot.toFixed(2)}`);
}
console.log(`${ground}/${flagName}/${shape}/${layout}: rest y ${restY.toFixed(4)} | ${out.join(' | ')}`);
