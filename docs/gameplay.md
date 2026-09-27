# Gameplay

Status: 2026-09-27. How a race works today, as implemented in `src/game.ts`, `src/input.ts`,
`src/car.ts` and `src/ai.ts`, followed by the planned changes. Numbers come from `src/config.ts`
unless noted; world units are decimetres, so the track is 15 cm wide and a full-power flick
travels about 1.5 m.

Terminology: the UI is English. A car on its roof is a *flip*, a car on its side is a *tip*,
and leaving the track is *off track*. The code still calls the first two kelli and puolikelli.

## 1. The race

- **Grid.** Up to six cars, staggered just behind the start line, noses along the track.
  Because the grid is behind the line, the first crossing starts lap 0; a car has finished
  when its lap count reaches the chosen number of laps (1 to 5).
- **Rounds and order.** A race is a sequence of rounds. At the start of each round the
  unfinished cars are sorted by progress (laps plus position along the lap) and take their
  turns in that order, leader first. The order is fixed for the round even if positions change
  during it.
- **A turn** is three flicks by one player. Before the first flick, a car that has been knocked
  over by somebody else is set back on its wheels where it lies. The car's pose at that moment
  is remembered as the turn start.
- **Finishing.** A car is given its place the moment it crosses the line on its last lap. It
  then skips its turns. The race ends when at most one car is still running; that car gets the
  last place without having to finish.

## 2. A flick

- **Aiming.** A drag that starts on the car (within 10 cm on the ground, or 36 px on screen)
  winds up a flick. Anywhere else, the drag orbits the camera. The flick direction runs from
  the finger through the car, like pulling back a catapult. A second finger cancels the aim.
- **Power** is the drag length on screen, so it does not depend on zoom: nothing for the
  first 12 px, full power at a third of the shorter viewport side. A drag shorter than 44 px is
  not a flick, and releasing it simply cancels. The ribbon colour shows the band: blue gentle
  (under 0.3), green safe, yellow brisk (0.6 and up), red risky (0.8 and up).
- **The nose follows the aim,** as far as the turn wedge allows (section 3).
- **Launch.** Release hands the car over already rolling along its nose at
  `20 × power^0.5` units per second with the wheels spinning to match, as if it had run up on
  flat sand. Nothing pushes it after that: rolling, skidding, grip, the ridges, the jump and
  the dip, collisions and tipping all come from contact physics, plus a constant rolling
  resistance of 0.12 g.
- **How far a flick goes** on flat track, from `pnpm calibrate` (`src/flickmodel.ts`):

  | power | 0.1 | 0.3 | 0.5 | 0.7 | 0.9 | 1.0 |
  |---|---|---|---|---|---|---|
  | distance, units | 2.2 | 6.1 | 10.0 | 12.4 | 15.3 | 16.5 |

- **Resolution.** The flick is over when the car has been at rest for 0.35 s (or after 12 s of
  flight). The outcome is judged from how the car lies and where it is (section 4), the flick
  count goes down, and after a short pause (0.2 s, or 0.6 s after a penalty) the next flick or
  the next turn begins.

## 3. Turning and aiming

Implemented 2026-09-27. Before this the nose turned freely to the aim, so a car that ended a flick
facing backwards could simply be aimed forwards again.

- **Each flick may turn the car at most 45° either way** from the heading it has when that
  flick is aimed, that is, the heading it came to rest with after the previous flick, or the
  heading it was placed with after a penalty. Full power straight ahead is always available;
  the wedge is 90° wide in total.
- **Why.** Planning a driving line matters: a flick that ends the car pointing at the outside
  of the next bend costs the next flick, not just this one. Getting turned around is a real
  penalty: a car spun 180° needs several flicks of turning to face forwards again, and a car
  knocked sideways by a rival has been genuinely hurt.
- **Aiming under the limit.** The drag still sets the direction, but the nose stops at the edge
  of the wedge and the flick goes along the nose. The ribbon shows the direction the car will
  actually take, not the finger's. A 90° wedge on the ground in front of the car, drawn from
  the existing turn cue, shows what is allowed; the ribbon reddens at the edge of it.
- **Penalty placements** keep their heading rules: back to the flick start means the heading
  the flick was aimed at, back to the last on-track point means the direction of travel at that
  point, and the tip midpoint means the direction of travel there. So a car returned after
  leaving the track in a bend is facing the way it was going, which is usually towards the
  edge: the limit turns that into the actual penalty.
- **The aim is a preview, not a physics move.** Before this, each pointer move teleported all
  five rigid bodies (chassis and four wheels) to the new heading and woke them. The wheels sit
  away from the centre, so turning on the spot swept them through a ridge or a neighbouring car
  and the solver shoved the overlapping bodies apart: the car drifted while being aimed, and
  rivals could be nudged for free. Now only the meshes turn while aiming. The bodies stay asleep
  where the last flick left them. At release the car is placed once at the aim pose and
  launched in the same physics step, so a car parked against a rival simply starts its flick
  in contact with it. The AI's visible nose turn before its flick uses the same preview. An aim
  let go without a flick puts the nose back; previews are cleared at every turn start.
- **The preview conforms to the track.** The turn is about the car's own up axis, the normal of
  the surface it rests on, not world up: a car leaning on the ridge keeps its lean while the
  nose swings, and the 45° wedge is measured about that same axis. After each swing the
  resting pose is re-fitted: track height is sampled under the four wheel positions, a plane is
  fitted through them, and the chassis takes that pitch and roll. Penalty placements use the
  same fit instead of the flat rest height they use today.
- **The launch stays horizontal for now.** The flick launches along the nose projected onto the
  ground plane, as it does today, so a nose that points down the ridge slope still launches
  level. Launching along the fitted forward instead (tangent to the surface, so a downhill
  nose drives into the floor and may flip end over end, and an uphill nose goes airborne off
  the ridge) is an experiment for later: measure it on the calibration oval first, flips and
  distances by heading and power, and only then decide. It would also invalidate the flat
  distance table the AI plans with.
- **The AI plays by the same rule.** The planner still finds the longest safe straight, then
  pulls the line into the wedge if it lies outside, and cuts the power to what stays on the
  track along the pulled line. Its aim noise is clamped again by the game so it can never spill
  over the edge. `pnpm simrace` reports how many flicks were pulled in; on the Hietsu track it is
  2 of 76 with the default driver.
- **Configuration.** `FLICK.maxTurnDeg = 45` in `src/config.ts`, so the number can be tried
  and changed.
- **Measured** with `pnpm scenario reversed 0,0.5 0,0.5 0,0.5` and `pnpm scenario ridge -80,0.7`:
  a car facing backwards turns 42° on its first flick and needs three flicks to face forwards;
  an 80° aim on the ridge is taken at 45°, and a 0.7 flick from the ridge crest at that angle
  flips the car.
- **A hole this exposes.** Off track is judged only where the car stops. The reversed car's
  second flick cut across the infield from the start straight to the back straight and was
  scored clean, with its lap count going backwards. The rule should also catch a flight that
  left the track and came back on, placing the car at the last on-track point. Not fixed yet.
- **The ridge is a kerb.** Measured 2026-09-27 with `scripts/probes/ridge-turn.ts`: a car straddling the
  ridge, nose turned 40° inward, launched at 0.5 power, goes where the nose points for the first
  few centimetres and is then deflected along the ridge, stopped, or flipped, because the ridge is
  0.12 tall, the same as the wheel radius. At 0.06 the car crosses it on its wheels; at 0.03 it
  travels within 10° of its nose. `TRACK_DETAIL.ridgeHeight` is the knob; the AI ladder was tuned
  at 0.12. Not decided yet.
- **Open until tried.** Whether the limit is per flick (as above) or per three-flick turn.
  Per flick is the assumption. Per turn would make a spin cost most of a round and is probably
  too harsh, but it is a one-line change if 45° per flick turns out to be too forgiving.

## 4. Outcomes and penalties

Judged when the car comes to rest, in this order. Rules are the sange.fi ruleset; the
alternatives in brackets exist in `Rules` but are not the default.

| Outcome | Test | Placement |
|---|---|---|
| Flip | On its roof: up-vector dot below -0.2 | Back to where the flick started (or where the turn started) |
| Tip | On its side: up-vector dot below 0.6 | Halfway along the path the flick took, measured by distance |
| Off track | At rest outside the track edge plus a 1.5 cm margin, and the flick did not start off track | Back to the last point on the path where the car was on the track and upright (or the flick start) |
| Clean | none of the above | Stays where it is |

- A flick that starts off track is free to end off track; the car is expected to be working
  its way back.
- Placements set the car down on its wheels at the track surface with the heading described in
  section 3.
- Each penalty costs the flick. The messages are the only feedback today; the UI plan gives
  them icons.

## 5. Contact

- Cars are solid and collide. Knocking a rival over or off the line is legal and is the whole
  strategy of some AI drivers.
- A car knocked over by somebody else is not penalised: it is righted in place at the start of
  its own turn. A car pushed off the track by somebody else is also not penalised, since
  off-track is only judged for the car that flicked. It does have to flick its way back.

## 6. Camera and cues

- At each turn start the camera glides in 0.7 s to sit behind and above the current car,
  looking along the track. It then follows the car during the flick. Drag to orbit, wheel or
  pinch to zoom.
- A human's car sits on a pulsing ring while a flick can be aimed and no drag has started: it
  goes when the drag begins or the flick is released, and comes back once the car has settled and
  another flick is due. On each human's first turn of a race a finger animation drags down from
  the car until they start dragging themselves.
- Flicks left are shown as three chevrons in the current player's colour. There is no numeric
  power readout: the ribbon's colour is the power indicator.

## 7. AI drivers

An AI turn thinks for 0.9 s, turns the nose, and flicks 0.45 s later. The planner walks the
track ahead in 5 cm steps to find the longest straight line that stays inside the track edge,
aims a fraction of the way along it (aggression), picks the power that lands there from the
distance table, capped at a maximum, and adds Gaussian aim noise. Off track, it aims at a point
60 cm ahead on the track at low power. Today every AI uses one set of numbers (max power 0.72,
aggression 0.85, aim noise 0.03 rad). The roster of distinct drivers is in `drivers.md`.

## 8. Configuration

| Key | Value | Meaning |
|---|---|---|
| `DEFAULT_RULES.flicksPerTurn` | 3 | flicks per turn |
| `DEFAULT_RULES.laps` | 1 | default laps; setup allows 1 to 5 |
| `DEFAULT_RULES.orderByPosition` | true | leader flicks first each round |
| `DEFAULT_RULES.offTrack` | lastOnTrack | alternative: flickStart |
| `DEFAULT_RULES.kelli` | flickStart | flip placement; alternative: turnStart |
| `FLICK.maxSpeed` | 20 | launch speed at full power, units/s |
| `FLICK.speedExp` | 0.5 | speed = maxSpeed × power^exp |
| `FLICK.maxDragFraction` | 0.33 | drag for full power, fraction of the shorter viewport side |
| `FLICK.deadZonePx` | 12 | drag that counts as no power |
| `FLICK.cancelPx` | 44 | shorter drags are not flicks |
| `FLICK.grabRadius` / `grabRadiusPx` | 1.0 / 36 | where a drag may start, ground units / screen px |
| `FLICK.maxTurnDeg` | 45 | turn allowed per flick, degrees either way |
| `WHEEL.rollingCoefficient` | 0.12 | rolling resistance, fraction of g |

## 9. Scenarios: testing a situation

`?scenario=<name>` (or `?car=t,lateral,heading`) loads the game straight into a known situation: a track
by name, cars at poses given in track terms (lap fraction, offset from the centreline, heading relative
to travel), a fixed random seed, no setup screen, no camera glide, no finger cue, and turns in setup
order so the human under test always flicks first. `window.__neppis` then exposes the game state and
lets a test aim, flick and step the physics synchronously until the car settles, so a check reads
numbers instead of waiting on wall-clock time. `pnpm scenario` drives it from the terminal and
`pnpm screenshot` accepts a scenario URL. The small loop in `src/tracks/test.ts` is the default
track: a straight from the start line, a right-hand bend, then the jump and the dip on the back
straight. Presets in `src/scenario.ts`: straight, ridge, bend, reversed, rival, jump.

Outcomes measured in the browser should be confirmed in the Node tools before being relied on for
AI tuning, and the other way round for input and camera behaviour: they share the track and physics
code but not the render loop.
