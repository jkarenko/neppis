# Neppis

A 3D, turn-based simulation of neppis, the Finnish flick-car racing game played with
Formula-Neppis toy cars on damp sand. Built with TypeScript, Vite, Three.js and Rapier.

## Run

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # typecheck + production build to dist/
pnpm calibrate  # headless: flick distance and flip rate per power level
pnpm simrace    # headless: three AI drivers race one lap, exercises the rules engine
```

## Controls

- Drag from the car (mouse, touch or pen) to aim and wind up a flick. The chevron ribbon runs
  from your finger to the back of the car and points the way the car will go; the car's nose
  turns to follow your aim, since neppis lets you turn the car before every flick. Drag length
  on screen is the power, shown by colour: blue (gentle), green (safe), yellow (brisk), red
  (risky).
- Drag anywhere else to orbit the camera, wheel or pinch to zoom.

## Rules implemented (sange.fi ruleset, configurable in `src/config.ts`)

- Three flicks per turn. Rounds run in track order: the leader flicks first.
- Kelli (car on its roof): back to where the flick started.
- Puolikelli (car on its side): placed halfway along the flick's path.
- Off the track: back to the last point where the car was on the track.
- A car knocked over by someone else is righted in place at the start of its turn.
- First car across the line after the set number of laps wins.

## Physics notes

- World units are decimetres: the car is 0.8 x 0.45 x 0.3, the track 1.5 wide, gravity -98.1.
- The track is a heightfield generated from a closed Catmull-Rom spline: a sunken strip with
  ridges of pushed-up sand along the edges, plus a jump and a dip. `FIX_INTERNAL_EDGES` on
  the heightfield collider matters: without it the wheel contacts snag on triangle edges.
- What you see is what you drive on. Both the loose sand and the track are drawn from the
  heightfield's own triangles, split on the same diagonal Rapier uses. Triangles near the
  centreline form the track mesh, textured by lap position and lateral distance with a single
  nearest-filtered pixel strip for the whole lap; the finish line is painted into that strip,
  so it follows the geometry like any other part of the track.
- The car is five rigid bodies: a chassis and four cylinder tyres (rounded rims) on revolute joints. Rolling,
  skidding, grip and tipping all come out of contact forces. The only non-contact force is the
  rolling resistance of damp sand, modelled as a constant torque on each axle (a capped joint
  motor with a rolling coefficient of 0.12, so deceleration is 0.12 g).
- A flick is an instant acceleration: the car is handed over already rolling along its nose at
  the launch speed with its wheels spinning in step, as it would be after a run-up on flat sand.
  Distance is then v² / 2a, linear in power. `pnpm terrain-risk` shows the jump and the edge
  ridges turning hard flicks into kellis.
- Physics runs at 240 Hz with CCD off. Rapier's CCD clamps the motion of small fast bodies and
  was silently capping wheel speed at 120 Hz.
