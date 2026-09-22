import { initPhysics, RAPIER } from '../src/physics.ts';
import { Track, type TrackDef } from '../src/track.ts';
const CAL_TRACK: TrackDef = { name: 'c', width: 1.5, area: [70, 30], points: [[0, -8.5], [28, -8], [31, 0], [28, 8], [0, 8.5], [-28, 8], [-31, 0], [-28, -8]], features: [] };
const world = await initPhysics();
const track = new Track(CAL_TRACK);
track.createCollider(world);
for (let i = 0; i < 3; i++) {
  const hit = world.castRay(new RAPIER.Ray({ x: 0, y: 5, z: -8.5 }, { x: 0, y: -1, z: 0 }), 20, true);
  console.log('before step', i, hit ? hit.timeOfImpact : null);
  world.step();
}
