// The same flick from different spots along a straight: how much the floor texture alone changes the distance.
//   ./node_modules/.bin/tsx scripts/probes/spot-variance.ts [power]   TRACK=cal|hietsu|test  TEXTURE=multiplier
import { initPhysics } from '../../src/physics.ts';
import { Track } from '../../src/track.ts';
import { TRACK_BY_NAME } from '../../src/tracks/index.ts';
import { Car } from '../../src/car.ts';
import { PHYS_DT, TRACK_DETAIL } from '../../src/config.ts';

if (process.env.TEXTURE) TRACK_DETAIL.fineTexture = Number(process.env.TEXTURE);

const power = Number(process.argv[2] ?? 0.5);
const world = await initPhysics();
const track = new Track(TRACK_BY_NAME[process.env.TRACK ?? 'cal']);
track.createCollider(world);
const car = new Car(world, 0, 0, 0, 0, 0);
const heightAt = (x: number, z: number) => track.heightAt(x, z);
const results: number[] = [];
for (let t = 0.02; t < 0.3; t += 0.02) {
  const i = track.wrapIndex(t * track.n);
  const p = track.pointAt(i);
  const g = track.tangentAt(i);
  car.setPose(p.x, p.z, Math.atan2(-g.z, g.x), heightAt);
  for (let k = 0; k < 60; k++) world.step(); // settle
  const x0 = car.position.x, z0 = car.position.z;
  car.flick(power);
  let s = 0;
  while (!car.settled(PHYS_DT) && s < 12) { world.step(); s += PHYS_DT; }
  const d = Math.hypot(car.position.x - x0, car.position.z - z0);
  results.push(d);
  console.log(`t=${t.toFixed(2)} moved ${d.toFixed(2)}`);
}
const mean = results.reduce((a, b) => a + b, 0) / results.length;
const sd = Math.sqrt(results.reduce((a, b) => a + (b - mean) ** 2, 0) / results.length);
console.log(`power ${power}: mean ${mean.toFixed(2)} sd ${sd.toFixed(2)} min ${Math.min(...results).toFixed(2)} max ${Math.max(...results).toFixed(2)}`);
