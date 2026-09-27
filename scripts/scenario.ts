// Load a scenario in the headless browser, drive it through window.__neppis and report the game state as JSON.
//   pnpm scenario <preset|query> [flick ...]
//     <preset|query>  a preset name (straight, ridge, bend, reversed, rival, jump) or raw URL parameters such as
//                     "track=test&car=0.1,0.9,30" (see src/scenario.ts)
//     flick           "heading,power": heading in degrees relative to travel (positive right), power 0..1.
//                     Each flick is released, settled, and its resulting state printed. A flick of "ai" instead
//                     lets an AI turn play out. "drag:heading,power" does the same through real pointer events,
//                     a mouse drag from the car on screen, so the input path is exercised, not just the game.
//   OUT=path.png      screenshot before the first flick and after each one (path-0.png, path-1.png, ...); with
//                     AIM=1 the "before" shot shows the first flick's aim held instead of the resting car.
//   VIEWPORT=spec     one preset or WxH[@scale] (default ipad-landscape@2). URL=... for a different dev server.
import { launchBrowser, openPage, parseViewport } from './lib/browser.ts';

const [what, ...flicks] = process.argv.slice(2);
if (!what) {
  console.error('usage: pnpm scenario <preset|query> [heading,power | ai ...]');
  process.exit(2);
}
const base = process.env.URL ?? 'http://localhost:5175/';
const url = `${base}?${what.includes('=') ? what : `scenario=${what}`}`;
const out = process.env.OUT;
const vp = parseViewport(process.env.VIEWPORT ?? 'ipad-landscape@2');

const browser = await launchBrowser();
const page = await openPage(browser, vp);
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => (window as unknown as { __neppis?: unknown }).__neppis !== undefined, null, { timeout: 20000 });
await page.waitForTimeout(300);

type Dbg = import('../src/scenario.ts').NeppisDebug;
// The function is sent as source and evaluated in the page, so it must only use its parameters (no closures).
const dbg = <T, A = undefined>(fn: (d: Dbg, arg: A) => T, arg?: A) =>
  page.evaluate(([src, a]) => (0, eval)(src as string)((window as unknown as { __neppis: Dbg }).__neppis, a), [`(${fn})`, arg] as const) as Promise<T>;
const shot = async (i: number) => {
  if (!out) return;
  const path = out.replace(/(\.[a-z]+)?$/i, `-${i}$1`);
  await page.screenshot({ path });
  console.log('saved', path);
};
const print = (label: string, state: unknown) => console.log(`${label} ${JSON.stringify(state)}`);

print('loaded', await dbg((d) => d.state()));
if (process.env.AIM && flicks[0] && flicks[0] !== 'ai') {
  const [h, p] = flicks[0].split(',').map(Number);
  await dbg((d, a) => d.aim(a[0], a[1]), [h, p]);
  await page.waitForTimeout(100);
}
await shot(0);
for (const [i, f] of flicks.entries()) {
  let state: unknown;
  if (f === 'ai') {
    state = await dbg((d) => d.step(2.5));
    state = await dbg((d) => d.settle());
  } else if (f.startsWith('drag:')) {
    // Drag from the car, away from the aim: the flick direction runs from the finger through the car. Screen y is
    // down, so with the chase camera looking along the track a heading of 0 is a drag straight down the screen.
    const [h, p] = f.slice(5).split(',').map(Number);
    const at = await dbg((d) => d.carScreen());
    if (!at) throw new Error('no current car to drag from');
    const full = Math.min(vp.width, vp.height) * 0.33;
    const len = 12 + p * full;
    const a = ((h + 90) * Math.PI) / 180; // 0 → straight down the screen, positive right → anticlockwise on screen
    const to = { x: at.x + Math.cos(a) * len, y: at.y + Math.sin(a) * len };
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(at.x + ((to.x - at.x) * i) / 12, at.y + ((to.y - at.y) * i) / 12);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    state = await dbg((d) => d.settle());
  } else {
    const [h, p] = f.split(',').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(p)) throw new Error(`bad flick ${JSON.stringify(f)}: expected heading,power`);
    await dbg((d, a) => d.flick(a[0], a[1]), [h, p]);
    state = await dbg((d) => d.settle());
  }
  await page.waitForTimeout(100);
  print(`after ${f}`, state);
  await shot(i + 1);
}
await browser.close();
