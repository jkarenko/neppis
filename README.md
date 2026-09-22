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
- The car is one rigid body: a chassis box plus four ball colliders as wheels. A small tyre
  model in `Car.updateTyres` gives rolling resistance along the nose and heavy skid damping
  sideways. The flick is a single horizontal impulse where the finger meets the rear of the
  body, nothing else is scripted: whether the car hops, skids or tips is decided by power,
  direction and the sand it meets. `pnpm terrain-risk` shows the jump and the edge ridges
  turning hard flicks into kellis.
