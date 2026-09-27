# Headless dev scripts

All run through `tsx`; `scenario` and `screenshot` drive headless Chromium against the dev server, the rest need no
browser. None ship with the game.

## Tools (have a `pnpm` entry, kept working)

| Command | What it does |
| --- | --- |
| `pnpm calibrate` | Measures flick distance and flip rate per power on the calibration oval. Feeds `src/flickmodel.ts`. |
| `pnpm simrace` | AI-vs-AI race to exercise the rules engine. `pnpm simrace roster [heats]` races the whole driver ladder in heats of six and prints a table per driver; `LAPS`, `SEED`, `TRACK`. |
| `pnpm terrain-risk` | Flicks over the jump and into the ridge to see whether terrain alone causes kellis. |
| `pnpm surfcheck` | Casts rays onto the track colliders and fails if any lands off the physics surface. |
| `pnpm scenario` | Loads a scenario in the headless browser (`pnpm scenario ridge 0,0.6 -20,0.4`), drives it through `window.__neppis`, prints the game state as JSON after each flick; `drag:heading,power` flicks through real mouse events instead of the debug handle. `OUT=path.png` for a shot before and after each flick, `AIM=1` to hold the first aim in the before shot, `VIEWPORT`, `URL`. Presets and URL parameters are in `src/scenario.ts`. |
| `pnpm screenshot` | Screenshots the running dev server with Playwright. `VIEWPORT=iphone,ipad-landscape,1920x1080@2` takes presets or `WxH[@scale]`, `all` for every preset at 1x plus a contact sheet; default is `ipad-landscape@2`, the iPad's real resolution. `DRAG_PX`, `WAIT_MS`, `STATS=1`, `FULL=1` for the whole scrollable page, `HOLD=1` to shoot the title screen instead of tapping through it (`?boot=hold` in the URL holds the loading state), `STOP=menu|setup|opponents` to stop at that screen. The URL may carry `?scenario=` or `?kit` (every UI component in every state). |

## Probes (`probes/`, run by hand when something misbehaves)

| Script | What it does |
| --- | --- |
| `probes/debug-flick.ts` | Step-by-step trace of a single flick. |
| `probes/perf.ts` | Times the physics step with one or more cars on the real track. |
| `probes/lap-trace.ts` | One AI driver alone for a lap: per flick, planned distance against distance gained. `lap-trace.ts <driver-id>`, `TRACK=`. |
| `probes/ridge-turn.ts` | A car straddling the ridge, nose turned by the aim preview, flicked: where it goes. `RIDGE=` overrides the ridge height. |
| `probes/flip-settle.ts` | Drops the car on its roof, its side and its wheels at a few spots and reports how long `Car.settled()` takes and whether it creeps meanwhile. `flip-settle.ts [roof\|side\|wheels\|all]`, `TRACK=`, `SOLVER_ITERS=`, `ANG_DAMP=`, `CHASSIS_DENSITY=` to try a cause. |
| `probes/spot-variance.ts` | The same flick from many spots along a straight, to separate track geometry from the flick model. `TEXTURE=` scales the floor texture. |

Run a probe with `./node_modules/.bin/tsx scripts/probes/<name>.ts`.

## Shared

The flat calibration oval used by calibrate, surfcheck and debug-flick lives in `src/tracks/calibration.ts`,
next to the small scenario loop in `src/tracks/test.ts`, so the browser can load either by name. Edit them
there, not in the scripts. `lib/browser.ts` is the Playwright setup and viewport presets shared by
`scenario` and `screenshot`.
