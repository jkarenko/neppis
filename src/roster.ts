// The AI drivers: who they are and how they play. The lore is in docs/drivers.md; the numbers here are what
// docs/drivers.md's stats and traits mean to the planner in src/ai.ts. Ladder order, easiest first.
import type { AiProfile } from './ai.ts';

export interface Driver {
  id: string;
  name: string;
  epithet: string;
  /** One line, no explanation. */
  flavour: string;
  /** Shown on the card, 1..5. */
  power: number;
  aim: number;
  nerve: number;
  profile: AiProfile;
}

/** Card stats to the planner's base numbers; the traits below then adjust from there. */
const POWER = [0, 0.35, 0.5, 0.65, 0.82, 1.0];
const AIM = [0, 0.12, 0.08, 0.05, 0.03, 0.015];
const NERVE = [0, 0.6, 0.72, 0.85, 0.92, 0.98];

function driver(
  id: string,
  name: string,
  epithet: string,
  flavour: string,
  stats: [power: number, aim: number, nerve: number],
  traits: Partial<AiProfile> = {},
): Driver {
  const [power, aim, nerve] = stats;
  return {
    id,
    name,
    epithet,
    flavour,
    power,
    aim,
    nerve,
    profile: {
      maxPower: POWER[power],
      aggression: NERVE[nerve],
      aimNoise: AIM[aim],
      powerNoise: 0.03,
      jumpCaution: Math.max(0, (3 - nerve) / 2),
      afterFlip: 1,
      tilt: 0,
      bully: 0,
      leadEase: 1,
      lineBias: 0,
      ...traits,
    },
  };
}

export const ROSTER: Driver[] = [
  driver('rando-nervous', 'Rando Nervous', 'The Rookie', 'He borrowed his brother\'s car and has not told his brother.', [1, 1, 2], { powerNoise: 0.06 }),
  driver('hanami-cola', 'Hanami Cola', 'Picnic', 'She brings a picnic to every race and is usually still on it when the race ends.', [2, 2, 1], { jumpCaution: 1 }),
  driver('steady-betty', 'Steady Betty', 'Never Off', 'She was flicking on this sand before it was a beach.', [2, 5, 1], { jumpCaution: 1, powerNoise: 0.01 }),
  driver('callow-rollover', 'Callow Rollover', 'Green', 'He is seventeen and has spent more of it upside down than the rest of the grid put together.', [3, 2, 4], { maxPower: 1.0, jumpCaution: 0, powerNoise: 0.08 }),
  driver('gene-lazy', 'Gene Lazy', 'The Regular', 'Third place every summer since 1987, and he has never once brought it up.', [3, 3, 3], { maxPower: 0.6, aggression: 0.8, aimNoise: 0.06, powerNoise: 0.05 }),
  driver('john-hangover', 'John Hangover', 'Sunday Driver', 'Some Sundays he cannot be beaten. Some Sundays he cannot find the car.', [4, 2, 3], { aimNoise: 0.1, powerNoise: 0.15 }),
  driver('checky-stalwart', 'Checky Stalwart', 'Safety First', 'He walks the track before every race and has never had a reason to regret it.', [3, 4, 2], { jumpCaution: 1, powerNoise: 0.01 }),
  driver('nudge-manhandle', 'Nudge Manhandle', 'The Forearms', 'He does not so much flick the car as inform it where it is going.', [4, 3, 4], { bully: 0.25, aimNoise: 0.06 }),
  driver('mash-overstep', 'Mash Overstep', 'Flat Out', 'He has never lifted. He has been asked to, twice.', [5, 2, 5], { aggression: 1.3, jumpCaution: 0 }),
  driver('killian-clonkin', 'Killian Clonkin', 'If In Doubt', 'If in doubt, he hits it. He is rarely in doubt.', [4, 3, 5], { bully: 0.35, jumpCaution: 0, afterFlip: 1 }),
  driver('mike-rometer', 'Mike Rometer', 'The Tuner', 'He filed the axles himself. Do not touch the car.', [3, 5, 2], { maxPower: 0.55, aggression: 0.8, afterFlip: 0.6, powerNoise: 0.005 }),
  driver('denny-ricochet', 'Denny Ricochet', 'The Grin', 'He is smiling when he hits you, and he is always smiling.', [4, 3, 4], { bully: 0.5 }),
  driver('dark-web', 'Dark Web', 'Unseen', 'Nobody remembers him passing them. They only remember being behind him.', [3, 4, 4], { bully: 0.35, aggression: 0.8 }),
  driver('nicky-louder', 'Nicky Louder', 'The Mouth', 'You will hear him before you see him, and he only gets louder when he is behind.', [4, 3, 4], { tilt: 0.1, leadEase: 0.75, aimNoise: 0.05 }),
  driver('bruise-hammerton', 'Bruise Hammerton', 'The Hammer', 'Every car he has raced against has a dent with his name on it.', [5, 3, 4], { bully: 0.2, jumpCaution: 0.2 }),
  driver('bea-line', 'Bea Line', 'Quarter Mile', 'Nobody has seen her practise, and nobody has seen her lose a straight.', [4, 4, 3], { aggression: 1.0, jumpCaution: 0.8 }),
  driver('bastion-vette', 'Bastion Vette', 'The Wall', 'He takes the inside line and keeps it, and you can try to have it if you like.', [4, 4, 4], { lineBias: 0.9 }),
  driver('rufus-turner', 'Rufus Turner', 'Roof First', 'One flip is bad luck. Four in a row is a style.', [5, 3, 5], { aggression: 1.3, bully: 0.3, jumpCaution: 0, afterFlip: 1.1 }),
  driver('airtime-sender', 'Airtime Sender', 'Full Send', 'He has never once braked for the jump, because that is what the jump is for.', [5, 4, 5], { aggression: 1.05, jumpCaution: 0 }),
  driver('harald-frost', 'Harald Frost', 'The Professor', 'He has already worked out where you will be in three turns, and he will not be there.', [4, 5, 3], { aggression: 0.92, tilt: 0.06, leadEase: 0.97, jumpCaution: 0.15, powerNoise: 0.01 }),
  driver('the-dune', 'The Dune', 'The Record', 'He retired in 1991 and still holds the record. He does not abide.', [5, 5, 4], { tilt: 0.05, leadEase: 0.95, jumpCaution: 0.2, powerNoise: 0.01 }),
];

export const DRIVER_BY_ID: Record<string, Driver> = Object.fromEntries(ROSTER.map((d) => [d.id, d]));

export function driverByName(name: string): Driver | undefined {
  const n = name.trim().toLowerCase();
  return ROSTER.find((d) => d.name.toLowerCase() === n || d.id === n);
}

/** Opponents the interim setup form hands out, a spread of the ladder rather than its bottom. */
export const DEFAULT_GRID = ['gene-lazy', 'nicky-louder', 'steady-betty', 'mash-overstep', 'bea-line'];
