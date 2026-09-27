# UI plan

Status: draft, 2026-09-27. Covers app flow, the game menu, the opponent roster, design tokens and
the build order. The in-race HUD (standings, turn chevrons, power readout, finger cue) stays; this
plan wraps a proper game around it.

Terminology: the UI is English. A car on its roof is a *flip*, a car on its side is a *tip*, and
leaving the track is *off track*. The Finnish words kelli and puolikelli stay as identifiers in
the code and in the README's rules section, but the message strings in `src/game.ts` ("Kelli!",
"Puolikelli.") change to the English terms in the build.

## 1. App flow

The race engine already has its own machine (`aim`, `flying`, `settle`, `finished` in
`src/game.ts`). Above it sits an app-level machine, one module (`src/app.ts`), one active screen
at a time, each screen a DOM overlay on top of the always-running 3D scene.

```
boot ──► title ──► menu ──► setup ──► race ──► results
                     ▲        ▲         │          │
                     │        │      pause ─► quit ┤
                     │        └── change setup ◄───┤
                     └────────── back to menu ◄────┘
```

| State   | What is on screen                                                        | Leaves on |
|---------|--------------------------------------------------------------------------|-----------|
| boot    | Static HTML, paints before the module loads. Logo, progress bar.          | physics + track ready |
| title   | Same screen, bar becomes "Tap to play". Unlocks audio.                    | click / keydown |
| menu    | Race · Opponents · Settings · How to play. Scene idles behind.            | any item |
| setup   | Players, opponents, laps, track. Start button.                            | Start / Back |
| race    | HUD. Pause button bottom-right.                                          | pause / race over |
| pause   | Resume · Settings · Rules · Quit to menu (confirm).                       | |
| results | Podium, per-driver stats. Race again · Change setup · Menu.               | |

Rules for the machine:

- The scene never unmounts. Menu and setup show the track from a slow orbiting camera with the
  chosen cars parked on the grid, so the menu is already the game.
- Every screen except boot/title has a Back affordance top-left, 44 px, and Escape does the same
  (keyboard comes later but this costs nothing now).
- Setup is remembered in localStorage: human names and colours, chosen opponents, laps.
- Quitting a race in progress needs a confirm. The current "New race" button goes.
- Audio: `AudioContext` is created at boot, resumed on the title tap (`click` and `keydown`, not
  `pointerdown`, for old iOS Safari), a silent buffer is played to warm it, and it is resumed
  again on `visibilitychange` because iOS suspends it in the background.

## 2. Screens

### Boot / title
- Inline in `index.html`, no dependency on the bundle: wordmark "NEPPIS", one-line strap, a thin
  progress bar. The bundle reports progress in three steps (wasm, track, cars).
- Ready state: bar turns into a pill "Tap to play" with a slow pulse. Any click or key advances.
  Reduced motion: no pulse.

### Menu
- Four large items, stacked, 56 px tall, full width on phones, 360 px wide column on tablets and
  desktop. Race is the primary (filled), the rest are glass.
- Small footer: version, sound toggle icon.

### Setup
Two sections, then a footer with laps and Start.

- **Players.** Rows: colour swatch (tappable, cycles through free colours), name field, remove.
  "Add player" adds a human. Minimum one human.
- **Opponents.** A horizontal strip of portrait cards from the roster (section 3). Tap toggles
  a card into the race; a chosen card shows a check and takes the next free colour. Cards show
  name, epithet and three stat bars. Long-press or an info button flips the card to its flavour
  line and strengths/weaknesses.
- Max 6 cars total; the strip greys out once the grid is full.
- **Arcade race.** Rather than hand-picking, tap a tier (Rookie, Club, Pro, Legend) and the
  game draws the AI grid from a window of the ladder around that tier, always including one
  driver from the tier above so there is someone to beat. Hand-picking stays available for
  hot-seat groups who want a specific villain.
- **Side column, not a footer.** Add player and the laps stepper (− 1 +, buttons 44 px) sit
  beside the racer list so they never move when a row is added; track chip (one track today,
  ready for more) with them. Start button below, 56 px, filled. Humans default to Player 1,
  Player 2, ...; an added AI is drawn at random from the drivers not yet on the grid.
- Tablet/desktop: players left, opponents right in a 2-column grid. Phone: single column,
  opponents strip scrolls sideways.

### Opponents (from the menu)
- The same roster as full cards in a grid, read-only, with a "Race this one" shortcut that
  pre-fills setup with you + that driver. This is where the Punch-Out feel lives: you browse the
  ladder before you take it on.

### Race HUD (existing, adjusted)
- Standings top-left (names only, no AI tag), turn chevrons top-centre with the driver's name
  added (colour alone fails red/green players). No power readout: the ribbon colour carries it,
  and redundant information does not get a second element.
- Messages: one toast slot under the chevrons, icon + text. Flipped, tipped and off-track get
  their own icons so they are recognisable without reading.
- Turn wedge: with the 45° turn limit (`gameplay.md` section 3) a 90° wedge is drawn on the
  ground in front of the car while aiming, grown from the existing turn cue ring. The ribbon
  follows the clamped direction and reddens at the edge of the wedge.
- Pause button bottom-right, 44 px, in the thumb zone. Nothing else at the bottom.
- Portrait of the current driver appears in the standings row when it is an AI turn, so the
  opponent has a face while it plays.

### Pause
- Glass card centred: Resume (primary), Settings, Rules, Quit to menu. Quit asks once.

### Results
- Podium: three portraits on steps, then the rest as a list. Per driver: flicks used, flips,
  best flick distance. Buttons: Race again, Change setup, Menu.
- A human beating a driver for the first time is marked; the roster remembers it (localStorage).

### Settings
- Sound, music, haptics (vibrate on flick where supported), camera auto-follow, reduced motion
  (defaults from the OS media query). Language fi/en is a later row.

### How to play
- Three cards, swipeable: drag to flick, the three flicks, what a flip and going off track cost you.
  Uses the finger cue animation and the chevron ribbon so it is the same language as the HUD.

## 3. Opponents

The roster itself (21 drivers, names, flavour lines, stats and AI profile knobs) lives in
`drivers.md`. What the UI needs from it: name, epithet, flavour line, three stats (Power, Aim,
Nerve, 1 to 5), a portrait id and a ladder position. Data lives in `src/roster.ts`.

### Portraits
- Start with vector portraits: SVG, flat shapes, one accent colour per driver, 96 px card and
  32 px HUD size from the same file. They stay legible on a dark glass card and cost nothing.
- Kept in `src/roster.ts` as data (names, lines, stats, profile, portrait id) and
  `public/portraits/*.svg`. Real illustrations can replace the SVGs later without a code change.

## 4. Design tokens

One family: dark glass over the pale scene. The cream cards go.

```
--surface:        rgba(20, 24, 32, 0.78)   panels, chips
--surface-strong: rgba(20, 24, 32, 0.92)   modal cards, menu items
--text:           #f4f1ea
--muted:          #cfc9bd                  raised from #b9b4a8 for 4.5:1 over bright sand
--line:           rgba(255,255,255,0.14)
--accent:         var(--c)                 the current driver's colour, set per element
--power-0..3:     #3b82f6 #22c55e #eab308 #ef4444   from config, exposed to CSS
--danger:         #ef4444

type (Inter, tabular-nums):  12 label · 14 body · 16 control · 20 title · 28 display
radius:                      pill 999 · chip 12 · card 16
control heights:             44 min touch · 56 primary
motion:                      fast 150ms · base 250ms · glide 700ms (matches the camera)
safe areas:                  every edge uses max(12px, env(safe-area-inset-*))
```

Rules:
- No hover-only affordances. Pressed state is a 4% lighter surface plus scale 0.98.
- Focus-visible ring in `--text` at 2 px for the keyboard later.
- `prefers-reduced-motion`: finger cue static, pulses off, fades kept.
- Player colours: white stays but always paired with a name; red/green never carry meaning alone.

## 5. Icons and assets

- Inline SVG symbol set in `src/icons.ts`, 24 grid, 2.5 stroke, currentColor: chevron, hand,
  back, pause, play, gear, sound-on, sound-off, close, plus, minus, check, flag, trophy, flip
  (car on roof), tip (car on side), off-track (car past a line), info.
- No icon font, no sprite sheet. Portraits as above. Sounds are the only binary assets and come
  with the audio work.

## 6. Kit page

`?kit` renders every component in every state over a frozen scene: menu items normal/pressed,
setup rows, every opponent card front and back, HUD with each message type, pause, results
with a 6-car podium, settings. `pnpm screenshot` with the viewport presets then captures the
whole system at iPad, iPhone and Mac sizes as one contact sheet. This is the review loop, since
there is no desktop.

## 7. Build order

0. Scenario mode and the test track (done 2026-09-27): `?scenario=` loads a known situation, the
   debug handle drives it, `pnpm scenario` reports state and shots. Every later step is checked
   through it.
0b. Turn wedge and mesh-only aim preview (done 2026-09-27), see `gameplay.md` section 3. The
   wedge drawn on the ground is still to do, in step 7.
Timing log, wall clock including review and breaks, 2026-09-27: step 2 started 13:26; its code took 7m 43s, the rest was ladder tuning runs at about 7 minutes per 14-heat run; committed 13:58; the 28-heat baseline for the drivers doc landed 14:12. Step 3 (tokens, components, icons, kit page) 14:14 to 14:31. First gallery review round (three issues: ridge turning, icons and HUD redundancy, setup form) 14:38 to 15:05; second pass on the same three (settled release, tip icon, Start in the side column) 15:08 to 15:25; third pass (release was clearing the aim on a real drag; setup card height) 15:30 to 15:52.

1. Tokens and the glass component styles; kit page skeleton. Screenshot contact sheet as the
   baseline. Done 2026-09-27: tokens in `src/style.css`, components (.btn, .chip, .toast, .row,
   .field, .stepper, .switch, .card, .driver), icons in `src/icons.ts`, the kit in `src/kit.ts`
   at `?kit`, captured with `FULL=1 pnpm screenshot out.png 'http://localhost:5175/?kit'`. The
   interim setup and results overlays already wear the family.
2. Boot/title screen with progress and the audio gate.
3. `src/app.ts` state machine, menu, pause, results. Old setup form removed.
4. Roster data, portraits, opponent cards; setup screen on top of them.
5. `AiProfile` knobs in `ai.ts`, `simrace` roster mode, tune the ladder.
6. HUD adjustments: name in the turn chip, toast icons, pause button, portrait on AI turns.
7. Settings and How to play.
