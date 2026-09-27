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

Design reading (2026-09-27, before building):

- **Job.** Four things at once: paint before the bundle so the first frame is never blank; show
  that loading is happening and roughly how far; be the user gesture that unlocks audio; set the
  tone in one glance. It is not a menu and holds no choices.
- **Continuity.** Its background is the scene's own sky over a band of sand, so when it fades the
  track is already "behind" it and nothing jumps. Same tokens as everything else.
- **Content, centred, in reading order:** the mark, which needs no font so it paints at once: the
  author's own hand-drawn Formula-Neppis (the gallery sketch of 2026-09-27), converted from its
  vector strokes to `public/mark.svg` in the ink colour with the hatching kept, set at the
  wordmark's width as a lockup; then the wordmark NEPPIS in Inter 800 (shown when the font is ready, the existing 2 s
  fallback applies), the strap "Finnish flick-car racing" in muted, then the progress bar with a
  12 px label naming the step (physics, track, cars). Nothing else: no version, no settings.
- **Ready state.** The bar becomes the primary 56 px pill "Tap to play"; on a fine pointer it
  reads "Click or press any key". The whole screen accepts the tap, the pill is the affordance,
  not the only target. A gentle pulse says it is live; reduced motion removes the pulse.
- **The tap.** Creates and resumes the audio context, plays a silent buffer, and the screen fades
  in 250 ms (0 with reduced motion) to reveal the scene and whatever comes next (today the
  setup form, from step 5 the menu). Keydown does the same.
- **Failure.** If the game cannot start, the screen stays and says so in one line in the danger
  colour, with a Retry pill that reloads. Never a blank page with a console error.
- **Viewports.** Phone portrait: wordmark 40 px, bar 220 px wide. Phone landscape (393 tall):
  everything fits in one column without scrolling, wordmark 36 px. Safe-area insets respected.
- **Testing.** Scenario and kit URLs skip the title so headless runs are not blocked; `?boot=hold`
  freezes the loading state so it can be captured. The screenshot script taps the title when it
  is showing.

### Menu

Design reading for step 5 (2026-09-27, before building):

- **The scene is the menu's backdrop, live.** The track stays mounted with a slow orbit camera
  and no cars, so the menu already shows the place you will race. Every overlay is a glass card
  over it; nothing is a separate page.
- **No dead buttons.** The menu shows only what exists. In step 5 that is Race (primary) and
  Settings (sound on/off, a stored preference the audio will honour). Opponents arrives with
  step 6, How to play with step 7. A disabled or placeholder item teaches the player that
  buttons here may not work, which is worse than a shorter menu.
- **One column, 360 px, centred**, the mark small above a NEPPIS header so the title's lockup
  carries through at a reduced size. Items are the 56 px menu buttons from the kit. Footer:
  version only, muted.
- **Back is always top-left, 44 px, and Escape does the same**, on setup and settings. The
  race has no back; it has pause.
- **Pause freezes the world.** The pause button sits bottom-right in the thumb zone and replaces
  the old New race pill. While paused the physics does not step and the AI does not think; the
  card sits over the frozen scene. Resume (primary), Settings, Quit to menu. Quit asks once,
  inline in the same card ("Quit this race?" Keep racing / Quit), never a second modal.
- **Results** is a card: winner in the heading, the placings with colour dots, then Race again
  (same grid, primary), Change setup, Menu. The podium with portraits comes with step 6.
- **Setup is remembered** in localStorage (names, human or AI, laps) and restored when the
  form opens. Race again reuses the last grid without showing the form.
- **Transitions** are 250 ms fades, 0 with reduced motion. The camera glides from the orbit to
  the chase view when a race starts, and back when it ends.
- **Testing.** Scenario and kit URLs go straight to the race as before. The screenshot script
  taps through title and menu. Each screen can be captured by driving the real buttons.

- Four large items, stacked, 56 px tall, full width on phones, 360 px wide column on tablets and
  desktop. Race is the primary (filled), the rest are glass. (Original brief; see the reading.)

### Setup

Design reading for step 6 (2026-09-27, before building):

- **Job.** Build a grid in as few taps as possible and remember it. Two decisions, kept apart on
  the screen because they are made by different people: who is playing (the humans at the table)
  and who they race (the AI). Laps and Start are the footer of both.
- **Two columns on tablet and desktop** inside one card up to 960 px wide: Players left, Opponents
  right. Phone: one column, Players first. The head is Back and "Race"; the strap line goes, the
  screen explains itself now.
- **Players** are human rows only: colour swatch, name field, remove. The swatch is a button that
  cycles through the colours no other human holds; opponents take the free colours after the
  humans, in ladder order, so a card's colour follows the choices above it. "Add player" sits
  under the rows and adds "Player n". The list reserves the height of six rows, so the card is
  the same size with one human or six and nothing below moves. The last human cannot be removed:
  its remove button is disabled rather than hidden, so the row keeps its shape. Names are
  remembered, so a hot-seat group types them once.
- **Opponents** is the ladder as a horizontal strip of compact driver cards in ladder order,
  easiest first (portrait, name, epithet, ladder number, three stat bars), scroll-snapped, with
  the picked ones bordered and ticked in their grid colour. Tap toggles a driver in or out. The
  strip is the whole roster, never a subset, so picking a specific villain is always one scroll
  away. The compact card is a second size of the kit's driver card; the flavour line lives on
  the Opponents screen, not here, because the setup is for choosing, not browsing.
- **Arcade tiers** sit above the strip as four chips: Rookie, Club, Pro, Legend. A tap draws the
  opponents for that tier: three of them (a four-car race is the sweet spot between waiting for
  AI turns and a crowd; with more humans it fills to six at most), all but one from the tier's
  window of the ladder and one from the tier above, so there is always someone to beat. The
  draw replaces the current picks and scrolls the strip to that window. The chip stays lit only
  while the picks are the ones it drew; touching a card puts the chip out, which is the honest
  state. Tapping a lit chip draws again.
- **The grid counter** "3 of 6 cars" sits by Start. When the grid is full the unpicked cards and
  Add player dim; the counter says why, so nothing is greyed without an explanation next to it.
- **Start race** is the primary 56 px button under the counter, right column, so it never moves.
  A grid of one human and no opponents is allowed (a time trial); Start is never disabled.
- **Portraits.** Flat vector faces, one style, generated from a small feature set per driver in
  `src/portraits.ts` (head, hair or helmet, eyes, mouth, one prop such as glasses, a plaster, a
  flower, a sweat drop) and coloured per driver, so all 21 are consistent and legible at 32 px
  in the HUD and 96 px on a card. The features are data on the roster entry, the way the AI
  profile is, and a hand-drawn illustration can replace any of them later. Two faces are jokes
  the reader gets without a caption: Callow Rollover's portrait is upside down, The Dune's is a
  dune.
- **Remembered:** humans (names and colours), picked opponents, laps and the tier that drew them.
  The first time it opens: Player 1 and the Rookie draw.
- **Opponents screen** (from the menu) shows the same ladder as full cards in a four-tier grid,
  read-only: tap flips a card to its flavour line with the strength and weakness from the
  roster; "Race this one" on the back opens setup with the remembered humans and that one
  driver. Drivers a human has beaten carry a small tick, remembered in localStorage: that is
  the ladder you are climbing.
- **Results** gets its podium now that there are faces: the first three on steps with their
  portraits, then the rest as rows, each with flicks used, flips and the best flick distance.
- **Viewports.** iPad landscape: both columns, four cards visible in the strip. Phone portrait:
  one column, the strip is full-width and shows two and a half cards so it reads as scrollable.
  Phone landscape: the card scrolls inside the overlay rather than shrinking.
- **Testing.** `STOP=setup` and `STOP=opponents` in the screenshot script; the interaction is
  walked with real clicks in Playwright: add, remove, pick, draw a tier, start.

Original brief (kept for the details the reading does not restate):

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

0. Scenario mode and the test track: `?scenario=` loads a known situation, the debug handle
   drives it, `pnpm scenario` reports state and shots. Every later step is checked through it.
1. Turn wedge and mesh-only aim preview (`gameplay.md` section 3).
2. Driver roster and AI profiles (`drivers.md`); `pnpm simrace roster` for tuning.
3. Tokens and the glass component styles, icons, the `?kit` page.
4. Boot/title screen with progress and the audio gate.
5. `src/app.ts` state machine: menu, settings, setup as a screen, pause, results.
6. Setup and Opponents screens on the roster: opponent cards, arcade tier picker, portraits;
   Opponents added to the menu.
7. HUD adjustments (name in the turn chip, toast icons, turn wedge on the ground, portrait on AI
   turns), settings, How to play added to the menu.
