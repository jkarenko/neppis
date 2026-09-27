// Headless screenshot(s) of the running dev server.
//   pnpm screenshot [out.png] [url]     url may carry a scenario, e.g. 'http://localhost:5175/?scenario=ridge'
//   VIEWPORT=iphone,ipad-landscape,1920x1080  comma-separated presets or WxH[@scale]; "all" = every preset.
//   Default is the iPad at its real resolution (ipad-landscape@2). Named presets are CSS sizes at scale 1 unless
//   you append @2 or @3, so "all" is a fast 1x layout check, not device-resolution detail.
//   With several viewports the out path gets "-<viewport>" before the extension, or use {vp} in it, and a contact
//   sheet of all of them is written as "-sheet". The game is loaded once per distinct scale and the viewport
//   resized in place, so a full set takes about a minute.
//   DRAG_PX=n holds a flick drag from the car (viewport centre) while shooting. WAIT_MS, STATS=1 as before.
//   FULL=1 captures the whole scrollable page, for the kit (?kit).
import { readFile } from 'node:fs/promises';
import type { Page } from 'playwright';
import { PRESETS, launchBrowser, openPage, parseViewport, type Viewport } from './lib/browser.ts';

const specs = (process.env.VIEWPORT ?? 'ipad-landscape@2').split(',').map((s) => s.trim()).filter(Boolean);
const viewports = specs.flatMap((s) => (s === 'all' ? Object.keys(PRESETS) : [s])).map(parseViewport);
const outArg = process.argv[2] ?? 'shot.png';
const url = process.argv[3] ?? 'http://localhost:5175/';
const dragPx = Number(process.env.DRAG_PX ?? 0);

function outPath(label: string): string {
  if (viewports.length === 1 && !outArg.includes('{vp}')) return outArg;
  if (outArg.includes('{vp}')) return outArg.replaceAll('{vp}', label);
  return outArg.replace(/(\.[a-z]+)?$/i, `-${label}$1`);
}

/** One page with every capture scaled into a labelled grid, so a whole set can be judged at a glance. */
async function contactSheet(shots: { label: string; path: string }[]): Promise<string> {
  const tiles = await Promise.all(
    shots.map(async (s) => {
      const data = (await readFile(s.path)).toString('base64');
      return `<figure><figcaption>${s.label}</figcaption><img src="data:image/png;base64,${data}"></figure>`;
    }),
  );
  const cols = Math.min(4, shots.length);
  const page = await browser.newPage({ viewport: { width: cols * 472 + 12, height: 800 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>
    body { margin: 12px; background: #e9e7e2; font: 14px system-ui, sans-serif; color: #222; }
    main { display: grid; grid-template-columns: repeat(${cols}, 460px); gap: 12px; }
    figure { margin: 0; } figcaption { margin-bottom: 4px; }
    img { display: block; max-width: 460px; max-height: 276px; margin: 0 auto; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
  </style><main>${tiles.join('')}</main>`);
  const out = outPath('sheet');
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
  return out;
}

async function flick(page: Page, vp: Viewport, distance: number, stepMs: number): Promise<void> {
  const cx = vp.width / 2;
  const cy = vp.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(cx, cy + (distance * i) / 10);
    await page.waitForTimeout(stepMs);
  }
}

const browser = await launchBrowser();

const shots: { label: string; path: string }[] = [];
const byScale = new Map<number, Viewport[]>();
for (const vp of viewports) byScale.set(vp.scale, [...(byScale.get(vp.scale) ?? []), vp]);

for (const [scale, group] of byScale) {
  const first = group[0]!;
  const page = await openPage(browser, { ...first, scale });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // A scenario URL starts the race by itself; otherwise submit the setup form.
  if (await page.isVisible('#start')) await page.click('#start');
  await page.waitForTimeout(Number(process.env.WAIT_MS ?? 2500));

  for (const vp of group) {
    if (vp !== first) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500); // let the renderer pick up the resize
    }
    if (dragPx > 0) {
      await flick(page, vp, dragPx, 30);
      await page.waitForTimeout(300);
    }
    const out = outPath(vp.label);
    await page.screenshot({ path: out, fullPage: Boolean(process.env.FULL) });
    shots.push({ label: `${vp.label} · ${vp.width}×${vp.height}@${vp.scale}`, path: out });
    if (dragPx > 0) await page.mouse.up();
    console.log('saved', out, `${vp.width}x${vp.height}@${vp.scale}`);
  }

  // With STATS=1: flick, then sample the stats overlay while the car is moving and after it stops (last viewport).
  if (process.env.STATS) {
    const last = group[group.length - 1]!;
    const read = async (label: string) => console.log(`--- ${label}\n` + (await page.textContent('#stats')));
    await read('idle');
    await flick(page, last, 160, 20);
    await page.mouse.up();
    await page.waitForTimeout(700);
    await read('moving (0.7 s after flick)');
    await page.waitForTimeout(1200);
    await read('moving (1.9 s after flick)');
    await page.waitForTimeout(4000);
    await read('after');
  }
  await page.close();
}
if (shots.length > 1) console.log('saved', await contactSheet(shots));
await browser.close();
