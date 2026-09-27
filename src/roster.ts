// The AI drivers: who they are and how they play. The lore is in docs/drivers.md; the numbers here are what
// docs/drivers.md's stats and traits mean to the planner in src/ai.ts. Ladder order, easiest first.
import type { AiProfile } from './ai.ts';
import type { PortraitSpec } from './portraits.ts';

export interface Driver {
  id: string;
  name: string;
  epithet: string;
  /** One line, no explanation. */
  flavour: string;
  /** What you feel when you race them, from docs/drivers.md; on the back of the card. */
  strength: string;
  weakness: string;
  /** Shown on the card, 1..5. */
  power: number;
  aim: number;
  nerve: number;
  profile: AiProfile;
  /** The face on the card and in the HUD, drawn by src/portraits.ts from these features. */
  portrait: PortraitSpec;
}

/** Card stats to the planner's base numbers; the traits below then adjust from there. */
const POWER = [0, 0.35, 0.5, 0.65, 0.82, 1.0];
const AIM = [0, 0.12, 0.08, 0.05, 0.03, 0.015];
const NERVE = [0, 0.6, 0.72, 0.85, 0.92, 0.98];
const FORESIGHT = [0, 0, 0, 0.25, 0.5, 1];

function driver(
  id: string,
  name: string,
  epithet: string,
  flavour: string,
  [strength, weakness]: [string, string],
  stats: [power: number, aim: number, nerve: number],
  portrait: PortraitSpec,
  traits: Partial<AiProfile> = {},
): Driver {
  const [power, aim, nerve] = stats;
  return {
    id,
    name,
    epithet,
    flavour,
    strength,
    weakness,
    power,
    aim,
    nerve,
    portrait,
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
      foresight: FORESIGHT[aim],
      laneHold: 0.5,
      ...traits,
    },
  };
}

export const ROSTER: Driver[] = [
  driver('rando-nervous', 'Rando Nervous', 'The Rookie', 'He borrowed his brother\'s car and has not told his brother.',
    ['Rarely flips', 'Slow, loses ground on straights'], [1, 1, 2],
    { skin: 0, hair: 'tousled', hairColor: '#7a4a2e', eyes: 'wide', mouth: 'worried', prop: 'sweat', accent: '#7fb069' }, { powerNoise: 0.06, laneHold: 0 }),
  driver('hanami-cola', 'Hanami Cola', 'Picnic', 'She brings a picnic to every race and is usually still on it when the race ends.',
    ['Never off track, never on the roof', 'Never gets anywhere'], [2, 2, 1],
    { skin: 1, hair: 'long', hairColor: '#1a1a1a', eyes: 'happy', mouth: 'smile', prop: 'flower', accent: '#f28cb1' }, { jumpCaution: 1 }),
  driver('steady-betty', 'Steady Betty', 'Never Off', 'She was flicking on this sand before it was a beach.',
    ['Never off track', 'Never wins a straight'], [2, 5, 1],
    { skin: 0, hair: 'bun', hairColor: '#d8d8d8', eyes: 'glasses', mouth: 'smile', accent: '#9b7bb8' }, { jumpCaution: 1, powerNoise: 0.01 }),
  driver('callow-rollover', 'Callow Rollover', 'Green', 'He is seventeen and has spent more of it upside down than the rest of the grid put together.',
    ['Quick when it sticks', 'Rolls it constantly'], [3, 2, 4],
    { skin: 0, hair: 'spiky', hairColor: '#e9c46a', eyes: 'wide', mouth: 'grin', accent: '#4cc9f0', flip: true }, { maxPower: 1.0, jumpCaution: 0, powerNoise: 0.08 }),
  driver('gene-lazy', 'Gene Lazy', 'The Regular', 'Third place every summer since 1987, and he has never once brought it up.',
    ['No holes', 'No edge; beatable by anyone playing well'], [3, 3, 3],
    { skin: 0, hair: 'short', hairColor: '#7a4a2e', hat: 'cap', hatColor: '#c9b79c', eyes: 'sleepy', mouth: 'flat', accent: '#b8b8b8' }, { maxPower: 0.6, aggression: 0.8, aimNoise: 0.06, powerNoise: 0.05 }),
  driver('john-hangover', 'John Hangover', 'Sunday Driver', 'Some Sundays he cannot be beaten. Some Sundays he cannot find the car.',
    ['Can win any single lap', 'Can throw any single lap'], [4, 2, 3],
    { skin: 1, hair: 'tousled', hairColor: '#7d6b5d', eyes: 'shades', mouth: 'flat', beard: 'fishstick', accent: '#6d597a' }, { aimNoise: 0.1, powerNoise: 0.15, laneHold: 0.2 }),
  driver('checky-stalwart', 'Checky Stalwart', 'Safety First', 'He walks the track before every race and has never had a reason to regret it.',
    ['Cleanest laps on the grid', 'Slowest of the competent drivers'], [3, 4, 2],
    { skin: 0, hat: 'helmet', hatColor: '#f4f1ea', stripe: '#3a86ff', eyes: 'open', mouth: 'flat', accent: '#3a86ff' }, { jumpCaution: 1, powerNoise: 0.01 }),
  driver('nudge-manhandle', 'Nudge Manhandle', 'The Forearms', 'He does not so much flick the car as inform it where it is going.',
    ['Knocks cars aside, holds his line', 'Bends are ragged, off track under pressure'], [4, 3, 4],
    { skin: 0, eyes: 'squint', mouth: 'flat', beard: 'moustache', wide: true, accent: '#8d0801' }, { bully: 0.25, aimNoise: 0.06, laneHold: 0.9 }),
  driver('mash-overstep', 'Mash Overstep', 'Flat Out', 'He has never lifted. He has been asked to, twice.',
    ['Fastest on the straights', 'Flips on the jump, off track in bends'], [5, 2, 5],
    { skin: 0, hat: 'helmet', hatColor: '#ff6b00', stripe: '#1d2430', eyes: 'open', mouth: 'teeth', accent: '#ff6b00' }, { aggression: 1.3, jumpCaution: 0 }),
  driver('killian-clonkin', 'Killian Clonkin', 'If In Doubt', 'If in doubt, he hits it. He is rarely in doubt.',
    ['Finishes what he starts', 'Contact costs him as much as it costs you'], [4, 3, 5],
    { skin: 0, hair: 'short', hairColor: '#5a3a22', eyes: 'open', mouth: 'grin', prop: 'plaster-brow', accent: '#1f5fbf' }, { bully: 0.35, jumpCaution: 0, afterFlip: 1 }),
  driver('mike-rometer', 'Mike Rometer', 'The Tuner', 'He filed the axles himself. Do not touch the car.',
    ['Perfect corner exits', 'Conservative power, goes quiet after a flip'], [3, 5, 2],
    { skin: 0, hair: 'short', hairColor: '#5c5c5c', hat: 'goggles', eyes: 'open', mouth: 'flat', accent: '#3d5a80' }, { maxPower: 0.55, aggression: 0.8, afterFlip: 0.6, powerNoise: 0.005 }),
  driver('denny-ricochet', 'Denny Ricochet', 'The Grin', 'He is smiling when he hits you, and he is always smiling.',
    ['Best bully on the grid', 'Loses time chasing cars instead of the track'], [4, 3, 4],
    { skin: 1, hair: 'short', hairColor: '#1a1a1a', eyes: 'happy', mouth: 'biggrin', accent: '#ffd166' }, { bully: 0.5 }),
  driver('dark-web', 'Dark Web', 'Unseen', 'Nobody remembers him passing them. They only remember being behind him.',
    ['Wins by position, not pace', 'Beatable if you keep out of reach'], [3, 4, 4],
    { skin: 2, hat: 'hood', hatColor: '#22223b', eyes: 'open', mouth: 'none', accent: '#22223b' }, { bully: 0.35, aggression: 0.8 }),
  driver('nicky-louder', 'Nicky Louder', 'The Mouth', 'You will hear him before you see him, and he only gets louder when he is behind.',
    ['Strongest when losing', 'Loose and sloppy when leading'], [4, 3, 4],
    { skin: 0, hair: 'short', hairColor: '#7a4a2e', hat: 'cap', hatColor: '#d00000', eyes: 'open', mouth: 'shout', accent: '#d00000' }, { tilt: 0.1, leadEase: 0.75, aimNoise: 0.05 }),
  driver('bruise-hammerton', 'Bruise Hammerton', 'The Hammer', 'Every car he has raced against has a dent with his name on it.',
    ['Pace and force in one', 'Flips on the jump when leading a charge'], [5, 3, 4],
    { skin: 3, hair: 'short', hairColor: '#1a1a1a', hat: 'hardhat', hatColor: '#ffd60a', eyes: 'open', mouth: 'flat', accent: '#9d4edd' }, { bully: 0.2, jumpCaution: 0.2 }),
  driver('bea-line', 'Bea Line', 'Quarter Mile', 'Nobody has seen her practise, and nobody has seen her lose a straight.',
    ['Best all-round pace', 'Aims at the line, not at you: can be bumped'], [4, 4, 3],
    { skin: 0, hair: 'ponytail', hairColor: '#a0522d', eyes: 'shades', mouth: 'smirk', accent: '#06d6a0' }, { aggression: 1.0, jumpCaution: 0.8, laneHold: 0.8 }),
  driver('bastion-vette', 'Bastion Vette', 'The Wall', 'He takes the inside line and keeps it, and you can try to have it if you like.',
    ['Hard to pass, rarely bumped', 'Gives up length on the outside of every bend'], [4, 4, 4],
    { skin: 0, hair: 'short', hairColor: '#e9c46a', eyes: 'open', mouth: 'flat', square: true, accent: '#0b3d91' }, { lineBias: 0.9, laneHold: 1 }),
  driver('rufus-turner', 'Rufus Turner', 'Roof First', 'One flip is bad luck. Four in a row is a style.',
    ['Unpredictable, knocks cars over', 'Flips constantly, throws races'], [5, 3, 5],
    { skin: 1, hair: 'mohawk', hairColor: '#c1440e', eyes: 'wide', mouth: 'grin', prop: 'shiner', accent: '#e63946' }, { aggression: 1.3, bully: 0.3, jumpCaution: 0, afterFlip: 1.1 }),
  driver('airtime-sender', 'Airtime Sender', 'Full Send', 'He has never once braked for the jump, because that is what the jump is for.',
    ['Fastest laps when they land', 'Flips on the jump; no plan B'], [5, 4, 5],
    { skin: 1, hair: 'curly', hairColor: '#1a1a1a', hat: 'headband', hatColor: '#ffd60a', stripe: '#2a9d8f', eyes: 'open', mouth: 'smile', accent: '#ffd60a' }, { aggression: 1.05, jumpCaution: 0 }),
  driver('harald-frost', 'Harald Frost', 'The Professor', 'He has already worked out where you will be in three turns, and he will not be there.',
    ['Never a wasted flick', 'Lacks a killer straight; can be out-dragged'], [4, 5, 3],
    { skin: 0, hair: 'side', hairColor: '#c8c8c8', eyes: 'glasses', mouth: 'flat', accent: '#a2d2ff' }, { aggression: 0.92, tilt: 0.06, leadEase: 0.97, jumpCaution: 0.15, powerNoise: 0.01 }),
  driver('the-dune', 'The Dune', 'The Champ', 'He retired in 1991 and still holds the record. He does not abide.',
    ['Everything', 'Overconfident with a lead: eases off one notch too many'], [5, 5, 4],
    { skin: 0, hair: 'wavy', hairColor: '#b39655', eyes: 'side', mouth: 'flat', beard: 'goatee', robe: true, prop: 'cup', accent: '#8f7a58' }, { tilt: 0.05, leadEase: 0.95, jumpCaution: 0.2, powerNoise: 0.01 }),
];

export const DRIVER_BY_ID: Record<string, Driver> = Object.fromEntries(ROSTER.map((d) => [d.id, d]));

/** The arcade tiers: windows of the ladder, easiest first. A draw takes one driver from the tier above. */
export interface Tier {
  id: string;
  name: string;
  /** Ladder indexes [from, to). */
  from: number;
  to: number;
}
export const TIERS: Tier[] = [
  { id: 'rookie', name: 'Rookie', from: 0, to: 5 },
  { id: 'club', name: 'Club', from: 5, to: 10 },
  { id: 'pro', name: 'Pro', from: 10, to: 15 },
  { id: 'legend', name: 'Legend', from: 15, to: 21 },
];
export const TIER_BY_ID: Record<string, Tier> = Object.fromEntries(TIERS.map((t) => [t.id, t]));

export function tierOf(d: Driver): Tier {
  const i = ROSTER.indexOf(d);
  return TIERS.find((t) => i >= t.from && i < t.to) ?? TIERS[TIERS.length - 1];
}

function sample<T>(arr: T[], n: number, random: () => number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return out;
}

/** The AI grid for a tier: `count` drivers, all but one from the tier's window and one from the tier above. */
export function drawTier(tier: Tier, count: number, random: () => number = Math.random): Driver[] {
  const above = TIERS[TIERS.indexOf(tier) + 1];
  const own = ROSTER.slice(tier.from, tier.to);
  const picks = above && count > 1 ? [...sample(own, count - 1, random), ...sample(ROSTER.slice(above.from, above.to), 1, random)] : sample(own, count, random);
  return [...picks].sort((a, b) => ROSTER.indexOf(a) - ROSTER.indexOf(b));
}
