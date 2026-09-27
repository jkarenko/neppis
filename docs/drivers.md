# Drivers

Status: draft, 2026-09-27. The AI opponent roster: names, personalities, stats and the profile
knobs that make each one play differently. How they are presented (cards, portraits, the setup
and Opponents screens, arcade race) is in `ui-plan.md`.

Terminology: the UI is English. A car on its roof is a *flip*, a car on its side is a *tip*.

## Roster

Each driver is a name, an epithet, one flavour line that hints at a life without explaining it,
three visible stats (shown on the cards, see `ui-plan.md`), and a hidden profile that drives `src/ai.ts`. Order is the ladder, easiest
first.

Naming rule, from Punch-Out and Death Rally: a name carries two layers at once, how they play and
who they are. Piston Honda hits like a piston and is Japanese. Glass Joe has a glass jaw and is a
French Joe. One layer alone is a label, not a character. Two sources of the "who" layer work for
neppis: a real racing driver's name bent into the trait, or a job, an age or a film riff. When a
driver is the source, both names change, never just the surname: Hannu Mikkola becomes Hanami
Cola, not Hannu Meekola. The first name should carry a pun of its own where it can (Airtime
Sender, Mash Overstep). The trait must be the thing you feel when you race them.

One ladder, easiest first. Every driver is in it; there is no bench. A race draws a portion of
the ladder (see "Arcade race" under Setup), so the full list is never on one grid.

| # | Name | Epithet | Based on | Play layer | Who layer | Flavour line | Power | Aim | Nerve | Plays like | Strength | Weakness |
|---|------|---------|----------|------------|-----------|--------------|:-----:|:---:|:-----:|------------|----------|----------|
| 1 | Rando Nervous | The Rookie | Lando Norris | Rando: some random kid; nervous, weak, wobbly flicks | The young one | He borrowed his brother's car and has not told his brother. | 1 | 1 | 2 | Timid, short safe flicks, wide aim noise | Rarely flips | Slow, loses ground on straights |
| 2 | Hanami Cola | Picnic | Hannu Mikkola | Fizzy and sweet, no bite: soft flicks that go nowhere | Cherry-blossom season, a picnic on the sand | She brings a picnic to every race and is usually still on it when the race ends. | 2 | 2 | 1 | Soft flicks, medium aim, never near the edge | Never off track, never on the roof | Never gets anywhere |
| 3 | Steady Betty | Never Off | (archetype) | Steady: no risk, never leaves the track | A grandmother who has always been here | She was flicking on this sand before it was a beach. | 2 | 5 | 1 | Low risk, high accuracy, never takes the jump hard | Never off track | Never wins a straight |
| 4 | Callow Rollover | Green | Kalle Rovanperä | Callow: young and green; rolls it | The teenage champion | He is seventeen and has spent more of it upside down than the rest of the grid put together. | 3 | 2 | 4 | Full power on a young aim, no jump caution | Quick when it sticks | Rolls it constantly |
| 5 | Gene Lazy | The Regular | Jean Alesi | Lazy: never pushes, never worries, never wins | Always there, never on top | Third place every summer since 1987, and he has never once brought it up. | 3 | 3 | 3 | Moderate everything | No holes | No edge; beatable by anyone playing well |
| 6 | John Hangover | Sunday Driver | Juha Kankkunen | Hangover: brilliant or hopeless, no telling which | The rally legend after a long night | Some Sundays he cannot be beaten. Some Sundays he cannot find the car. | 4 | 2 | 3 | High variance: power and aim noise both large, good on his day | Can win any single lap | Can throw any single lap |
| 7 | Checky Stalwart | Safety First | Jackie Stewart | Checks everything first; stalwart, lowest risk on the grid | The safety campaigner | He walks the track before every race and has never had a reason to regret it. | 3 | 4 | 2 | Low risk, decent aim, heavy jump caution | Cleanest laps on the grid | Slowest of the competent drivers |
| 8 | Nudge Manhandle | The Forearms | Nigel Mansell | Nudges and manhandles: rough, wrestles the car, shoves neighbours | Moustache and forearms | He does not so much flick the car as inform it where it is going. | 4 | 3 | 4 | Medium-high power, bumps neighbours when in reach | Knocks cars aside, holds his line | Bends are ragged, off track under pressure |
| 9 | Mash Overstep | Flat Out | Max Verstappen | Mashes the throttle, oversteps the track edge | The one who never lifts | He has never lifted. He has been asked to, twice. | 5 | 2 | 5 | Max power on every flick, medium aim | Fastest on the straights | Flips on the jump, off track in bends |
| 10 | Killian Clonkin | If In Doubt | Colin McRae | Clonks into whatever is in front and finishes anyway | If in doubt, flat out | If in doubt, he hits it. He is rarely in doubt. | 4 | 3 | 5 | High power, no jump caution, hits cars in the way | Finishes what he starts | Contact costs him as much as it costs you |
| 11 | Mike Rometer | The Tuner | (archetype) | Micrometer: measures to the hundredth | A man with a workshop | He filed the axles himself. Do not touch the car. | 3 | 5 | 2 | Reads the track, lands exactly at the end of the safe line | Perfect corner exits | Conservative power, goes quiet after a flip |
| 12 | Denny Ricochet | The Grin | Daniel Ricciardo | Dents things, bounces off other cars: the bully | The grin | He is smiling when he hits you, and he is always smiling. | 4 | 3 | 4 | Aims at a car whenever one is in reach, otherwise the safe line | Best bully on the grid | Loses time chasing cars instead of the track |
| 13 | Dark Web | Unseen | Mark Webber | Never seen coming; strikes from behind when in reach | The one nobody noticed | Nobody remembers him passing them. They only remember being behind him. | 3 | 4 | 4 | Patient safe line until a car is within one flick, then a bump from behind | Wins by position, not pace | Beatable if you keep out of reach |
| 14 | Nicky Louder | The Mouth | Niki Lauda | Louder: gets louder, and harder, when behind | The one who talks | You will hear him before you see him, and he only gets louder when he is behind. | 4 | 3 | 4 | Solid pace that ramps up with every place he is behind | Strongest when losing | Loose and sloppy when leading; the tilt cuts both ways |
| 15 | Bruise Hammerton | The Hammer | Lewis Hamilton | Hammers it: raw power, leaves marks on other cars | The champion with the heavy hand | Every car he has raced against has a dent with his name on it. | 5 | 3 | 4 | High power, good aim, contact welcome | Pace and force in one | Flips on the jump when leading a charge |
| 16 | Bea Line | Quarter Mile | (archetype) | Beeline: the straightest, fastest line | An ex drag racer; straights are the whole sport | Nobody has seen her practise, and nobody has seen her lose a straight. | 4 | 4 | 3 | Long precise flicks, backs off only on the jump | Best all-round pace | Aims at the line, not at you: can be bumped |
| 17 | Bastion Vette | The Wall | Sebastian Vettel | A bastion: hard to knock over, hard to pass; Corvette pace underneath | The one who owns the inside line | He takes the inside line and keeps it, and you can try to have it if you like. | 4 | 4 | 4 | Strong pace on the inside line, avoids contact zones | Hard to pass, rarely bumped | Gives up length on the outside of every bend |
| 18 | Rufus Turner | Roof First | (archetype) | Roof-us, turns over | Demolition derby stock | One flip is bad luck. Four in a row is a style. | 5 | 3 | 5 | Pedal to the metal, targets you when you are in reach | Unpredictable, knocks cars over | Flips constantly, throws races |
| 19 | Airtime Sender | Full Send | Ayrton Senna | Sends it: full commit every flick, airtime on the jump | The natural | He has never once braked for the jump, because that is what the jump is for. | 5 | 4 | 5 | Near max power with good aim, full commit on the jump | Fastest laps when they land | Flips on the jump; no plan B |
| 20 | Harald Frost | The Professor | Alain Prost | Frost: cold, calculated, never a wasted flick | The thinker | He has already worked out where you will be in three turns, and he will not be there. | 4 | 5 | 3 | Precise, patient, adapts to position, never over the safe line | Never a wasted flick | Lacks a killer straight; can be out-dragged |
| 21 | The Dune | The Record | The Dude, The Big Lebowski | Nothing moves it; unbeaten | Made of sand, older than the beach | He retired in 1991 and still holds the record. He does not abide. | 5 | 5 | 4 | Near perfect, adapts: cautious when leading, pushes when behind | Everything | Overconfident with a lead: eases off one notch too many |

The knobs behind "Plays like":

## Profile shape (extends `AiOptions`)

```ts
interface AiProfile {
  maxPower: number;        // existing
  aggression: number;      // existing: fraction of the safe straight actually attempted
  aimNoise: number;        // existing: radians
  powerNoise: number;      // new: gaussian on power, "consistency"
  jumpCaution: number;     // new: 0..1 power cap multiplier when the safe line crosses the jump or ridges
  afterFlip: number;       // new: aggression multiplier for the turn after a flip (Mike Rometer 0.6, Rufus Turner 1.0)
  tilt: number;            // new: aggression shift per place behind the leader (Nicky Louder +, Mash Overstep 0)
  bully: number;           // new: 0..1 chance to aim at a car within reach instead of the line
  leadEase: number;        // new: aggression multiplier when leading (The Dune 0.85)
  lineBias: number;        // new: -1..1 lateral preference across the track width (Bastion Vette hugs the inside)
}
```

Strategy branches in `planFlick`, in order: restrict every candidate direction to the 45°
turn wedge (`gameplay.md` section 3) → off-track recovery (existing) → bully target if
rolled → safe straight (existing, searched within the wedge) scaled by aggression × tilt × leadEase × afterFlip → power
capped by maxPower and by jumpCaution when the line crosses the jump → noise. Every knob is
data; no per-driver code. `pnpm simrace` gets a roster mode that races the whole ladder for N laps and
prints win rate and flip rate per driver, which is how the ladder gets tuned.

