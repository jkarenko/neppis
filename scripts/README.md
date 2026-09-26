# Headless dev scripts

All run through `tsx` without a browser. None ship with the game.

## Tools (have a `pnpm` entry, kept working)

| Command | What it does |
| --- | --- |
| `pnpm calibrate` | Measures flick distance and flip rate per power on the calibration oval. Feeds `src/flickmodel.ts`. |
| `pnpm simrace` | AI-vs-AI race to exercise the rules engine. |
| `pnpm terrain-risk` | Flicks over the jump and into the ridge to see whether terrain alone causes kellis. |
| `pnpm surfcheck` | Casts rays onto the track colliders and fails if any lands off the physics surface. |
| `pnpm screenshot` | Screenshots the running dev server with Playwright. `VIEWPORT=iphone,ipad-landscape,1920x1080@2` takes presets or `WxH[@scale]`, `all` for every preset at 1x plus a contact sheet; default is `ipad-landscape@2`, the iPad's real resolution. `DRAG_PX`, `WAIT_MS`, `STATS=1`. |

## Probes (`probes/`, run by hand when something misbehaves)

| Script | What it does |
| --- | --- |
| `probes/debug-flick.ts` | Step-by-step trace of a single flick. |
| `probes/perf.ts` | Times the physics step with one or more cars on the real track. |

Run a probe with `./node_modules/.bin/tsx scripts/probes/<name>.ts`.

## Shared

`lib/cal-track.ts` holds the flat calibration oval used by calibrate, surfcheck and debug-flick.
Edit it there, not in the scripts.
