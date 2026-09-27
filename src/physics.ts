import RAPIER from '@dimforge/rapier3d-compat';
import { GRAVITY, PHYS_DT, SOLVER_ITERATIONS } from './config.ts';

export async function initPhysics(): Promise<RAPIER.World> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
  world.timestep = PHYS_DT;
  // Four heavy wheels hang off a light chassis by revolute joints. With Rapier's default four solver iterations a car
  // on its roof (chassis carrying the contact, wheels dangling) keeps rocking at a few mm/s for the whole 12 s flight
  // cap and never sleeps; twelve iterations settle it in half a second (scripts/probes/flip-settle.ts, 2026-09-27),
  // for about a tenth of real time with six cars (scripts/probes/perf.ts).
  world.integrationParameters.numSolverIterations = SOLVER_ITERATIONS;
  const params = world.integrationParameters as unknown as { lengthUnit?: number };
  if ('lengthUnit' in params) params.lengthUnit = 0.5;
  return world;
}

export { RAPIER };
