// Headless screenshot of the running dev server. Usage: pnpm screenshot [out.png] [url]
// VIEWPORT=WxH[@scale] picks the CSS viewport and device pixel ratio, e.g. VIEWPORT=393x852@3 for an iPhone 14 Pro.
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shot.png';
const url = process.argv[3] ?? 'http://localhost:5175/';
const vpMatch = /^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/.exec(process.env.VIEWPORT ?? '1280x800@1');
if (!vpMatch) throw new Error(`VIEWPORT must be WxH or WxH@scale, got ${JSON.stringify(process.env.VIEWPORT)}`);
const viewport = { width: Number(vpMatch[1]), height: Number(vpMatch[2]) };
const deviceScaleFactor = Number(vpMatch[3] ?? 1);
// The camera targets the current car, so it sits at the viewport centre; flicks start there.
const cx = viewport.width / 2;
const cy = viewport.height / 2;
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport, deviceScaleFactor });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[browser ${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => console.log(`[browser pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('#start');
await page.waitForTimeout(Number(process.env.WAIT_MS ?? 2500));
// Optional: hold a flick drag while shooting.
const dragPx = Number(process.env.DRAG_PX ?? 0);
if (dragPx > 0) {
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(cx, cy + (dragPx * i) / 10);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(300);
}
await page.screenshot({ path: out });
if (dragPx > 0) await page.mouse.up();
// With STATS=1: flick, then sample the stats overlay while the car is moving and after it stops.
if (process.env.STATS) {
  const read = async (label: string) => console.log(`--- ${label}\n` + (await page.textContent('#stats')));
  await read('idle');
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(cx, cy + 16 * i); await page.waitForTimeout(20); }
  await page.mouse.up();
  await page.waitForTimeout(700);
  await read('moving (0.7 s after flick)');
  await page.waitForTimeout(1200);
  await read('moving (1.9 s after flick)');
  await page.waitForTimeout(4000);
  await read('after');
}
console.log('saved', out);
await browser.close();
