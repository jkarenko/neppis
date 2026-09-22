import RAPIER from '@dimforge/rapier3d-compat';
import { GRAVITY, PHYS_DT } from './config.ts';

export async function initPhysics(): Promise<RAPIER.World> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
  world.timestep = PHYS_DT;
  const params = world.integrationParameters as unknown as { lengthUnit?: number };
  if ('lengthUnit' in params) params.lengthUnit = 0.5;
  return world;
}

export { RAPIER };
