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

## Profile shape

Implemented 2026-09-27 in `src/ai.ts` (`AiProfile`, `RaceContext`) and `src/roster.ts`. The card stats map
to base numbers, then each driver's traits override individual knobs:

| Stat | Knob | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Power | `maxPower` | 0.35 | 0.5 | 0.65 | 0.82 | 1.0 |
| Aim | `aimNoise` (rad) | 0.12 | 0.08 | 0.05 | 0.03 | 0.015 |
| Nerve | `aggression` | 0.6 | 0.72 | 0.85 | 0.95 | 1.08 |
| Nerve | `jumpCaution` | 1 | 0.5 | 0 | 0 | 0 |
| Aim | `foresight` | 0 | 0 | 0.25 | 0.5 | 1 |

`powerNoise` defaults to 0.03. Everything else defaults to neutral and is set per driver in the roster
file, which is the source of truth for the numbers; this doc holds the intent.

```ts
interface AiProfile {
  maxPower: number;        // never flick harder than this
  aggression: number;      // fraction of the safe straight actually attempted; above 1 overshoots it
  aimNoise: number;        // radians, standard deviation
  powerNoise: number;      // gaussian on power, "consistency"
  jumpCaution: number;     // 0 ignores the jump and dip, 1 stops short of them when the line would cross one
  afterFlip: number;       // aggression multiplier for the flick after a flip (Mike Rometer 0.6, Rufus Turner 1.1)
  tilt: number;            // aggression added per place behind the leader (Nicky Louder 0.1)
  bully: number;           // chance to aim at a rival within reach and inside the wedge (Denny Ricochet 0.8)
  leadEase: number;        // aggression multiplier when leading (The Dune 0.85)
  lineBias: number;        // preference for the inside of the coming bend, -1..1 (Bastion Vette 0.9)
  foresight: number;       // weight of the next flick's reach when choosing this one's landing, 0..1
  laneHold: number;        // reluctance to change lateral position for nothing, 0..1 (Bastion Vette 1, Rando 0)
}
```

## Strategy: anticipating turns, lanes, other cars

Asked for on 2026-09-27 evening: "the AI's strategy should involve anticipating turns, drive
lanes and avoiding other cars, unless they're a maniac." The reading, and how it maps onto the
planner:

- **Anticipating turns.** The line planner used to take the longest straight that stays on the
  track and stop thinking there. But the flick after it is decided by how this one lands: the
  45° wedge is centred on the resting heading and the power cap falls steeply past 15° of turn
  (`gameplay.md` section 3), so a car that arrives at a bend pointing along the straight has a
  weak next flick, and one that has already turned its nose towards the apex has a strong one.
  The planner now scores every clear landing by the track distance it gains plus `foresight`
  times what the best next flick from there can gain: the furthest clear line inside the wedge
  around the landing heading, at the power the turn allows, counted along the track direction
  so a line pointing back scores nothing. Two flicks deep, no further: the third flick depends on
  noise and on the other cars. The outside-apex-outside line through a bend, and turning in
  early, come out of that search instead of being drawn by hand; drivers with low foresight
  still take the longest straight and arrive at bends pointing the wrong way.
- **Drive lanes.** Everyone used to aim at the centreline whenever it was as long as the rest,
  so the whole field funnelled into one lane and into each other. Now the car's own lateral
  position is a candidate lane, and shifting sideways costs `laneHold` times the shift, so a
  driver holds the lane they are in until a bend or a rival gives a reason to move. Rando
  wanders (0); Bastion Vette, Nudge Manhandle and Bea Line hold theirs (0.8 to 1).
- **Other cars: driven through, on purpose.** This is a race, and avoiding a car only makes
  sense as a way past it. Three ways of not bumping were built and measured on 2026-09-27 in
  six heats of six on Hietsu (`probes/bumps.ts`): stopping short of a rival on the line (36.8
  flicks per lap), swerving past it with a small length penalty and stopping short otherwise
  (36.0), and swerving at no cost when a line as long exists, driving through otherwise (35.3,
  and more bumps than driving through, because the swerved line is a diagonal that ends near the
  edge and passes the rival at exactly the clearance, so landing error turns it into contact).
  Driving through every rival laps in 34.1. The reason is the physics: a bump from behind keeps
  the flicker's momentum, so stopping short is never shorter for the flicker, and Hietsu is two
  cars wide with the margins, so a real pass only exists when the rival sits off-centre. The
  planner therefore ignores rivals on the line; the bully branch, which aims at a rival on
  purpose, is where contact is a choice. The knob `avoid` was removed rather than left at zero.
  A tighter or wider track, or a bump that cost the flicker its speed, would reopen this.

Cost: a plan is a few hundred candidate lines, each with a seven-direction look at the next
flick, tens of thousands of track queries, a few milliseconds. Fine once per AI flick.

Measured on 2026-09-27 evening against the previous planner (`probes/bumps.ts`, six heats of six
on Hietsu; `probes/lap-trace.ts` solo over four seeds and two laps): with the lookahead and the
lane hold the field laps in 34.1 flicks in company, the same as before, and a flick moves a
rival 12.9 times in 100 instead of 13.7, the lane hold spreading the field across the width.
Solo pace is within noise (28.9 flicks per lap over seven drivers against 28.1). Anticipation
does not show in the pace on Hietsu: its bends are wide and the flick range spans them, so the
longest clear straight already cut them; it is kept at a low weight because it costs nothing
and a tighter track would reward it. The next flick's weight is 0.35 and a lane shift costs 0.3
of track length per unit at laneHold 1 (`NEXT_WEIGHT`, `LANE_COST` in `src/ai.ts`).
`probes/lap-map.ts` draws the lines a heat took. The ladder table below was measured with this
planner.

Planner order in `planFlick`: off-track recovery → bully target if rolled and a rival is within
reach, roughly ahead and on the track → every clear straight line to a point ahead in one of five
lanes or the car's own, scored by track distance gained, plus foresight × the next flick's reach from the landing, plus lineBias for the inside of the bend,
minus laneHold × the sideways shift; the best line's length is scaled by aggression + tilt × places
behind, × leadEase when leading, × afterFlip after a flip → shortened towards a jump or dip the
line would cross, by jumpCaution → the line pulled into the 45° turn wedge (`gameplay.md` section
3), with the power cut to what stays on the track along the pulled line → aim and power noise.
Every knob is data; no per-driver code.

`pnpm simrace roster [heats]` races the whole ladder in heats of six and prints races, wins, mean
place, flips, tips, off-tracks and flicks per lap per driver. That table is how the ladder gets
tuned. Mean place depends on who else was in the heat and needs many heats to settle; flicks per
lap is the steadier pace measure and should fall as the ladder number rises.

Baseline, 2026-09-27 late evening, `SEED=11 pnpm simrace roster 28` on Hietsu, eight races per driver, with
the twelve-iteration solver, the turn-power cap, off track judged along the whole flight and the planner
that scores lines two flicks deep and holds lanes (the strategy section above). 257 of 5695 flicks were
pulled into the 45° wedge.

| # | driver | wins | mean place | flips | tips | off | flicks/lap |
|---|---|---|---|---|---|---|---|
| 1 | Rando Nervous | 0 | 5.25 | 0 | 0 | 2 | 39.5 |
| 2 | Hanami Cola | 3 | 3.50 | 0 | 0 | 0 | 41.3 |
| 3 | Steady Betty | 1 | 3.63 | 0 | 0 | 0 | 41.6 |
| 4 | Callow Rollover | 2 | 2.63 | 0 | 0 | 0 | 32.8 |
| 5 | Gene Lazy | 2 | 3.38 | 0 | 0 | 0 | 34.9 |
| 6 | John Hangover | 0 | 5.38 | 0 | 0 | 2 | 37.0 |
| 7 | Checky Stalwart | 0 | 4.38 | 0 | 0 | 0 | 34.3 |
| 8 | Nudge Manhandle | 3 | 2.88 | 0 | 0 | 0 | 31.4 |
| 9 | Mash Overstep | 0 | 3.38 | 0 | 0 | 0 | 35.1 |
| 10 | Killian Clonkin | 0 | 4.00 | 0 | 0 | 2 | 32.1 |
| 11 | Mike Rometer | 4 | 2.63 | 0 | 0 | 0 | 28.8 |
| 12 | Denny Ricochet | 0 | 3.25 | 0 | 0 | 0 | 31.3 |
| 13 | Dark Web | 0 | 4.25 | 0 | 1 | 2 | 33.4 |
| 14 | Nicky Louder | 3 | 2.50 | 0 | 0 | 0 | 32.4 |
| 15 | Bruise Hammerton | 0 | 3.13 | 0 | 0 | 1 | 39.0 |
| 16 | Bea Line | 0 | 3.25 | 0 | 0 | 0 | 28.8 |
| 17 | Bastion Vette | 1 | 3.00 | 0 | 0 | 0 | 32.8 |
| 18 | Rufus Turner | 1 | 4.00 | 3 | 0 | 2 | 32.0 |
| 19 | Airtime Sender | 2 | 3.25 | 0 | 0 | 0 | 32.5 |
| 20 | Harald Frost | 2 | 3.50 | 0 | 0 | 0 | 32.1 |
| 21 | The Dune | 4 | 2.38 | 0 | 0 | 0 | 29.1 |

Reading it: the ends hold (the bottom three lap in 39 to 42 flicks; Mike Rometer, Bea Line and The Dune
in 29) and the middle is a jumble within the noise of eight races. The two long-standing outliers are still
there: Bruise Hammerton laps like the bottom three, and Callow Rollover is faster than his stats say. Off-tracks
are spread thinly now, 13 in 5695 flicks, where the previous run had Rufus Turner at 10 alone; with eight races
each that is noise as much as the lane hold keeping cars off the ridge. Flips stay rare on Hietsu, 3 in 5695,
so nerve costs distance rather than roofs. The whole field is still slow, about 32 flicks for a 113-unit lap,
because any wheel on the ridge stops the car; that is the track, not the drivers.

