// Headless screenshot of the running dev server. Usage: pnpm screenshot [out.png] [url]
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shot.png';
const url = process.argv[3] ?? 'http://localhost:5173/';
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[browser ${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => console.log(`[browser pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('#start');
await page.waitForTimeout(Number(process.env.WAIT_MS ?? 2500));
// Optional: hold a flick drag while shooting. The camera targets the current car, so it sits at the viewport centre.
const dragPx = Number(process.env.DRAG_PX ?? 0);
if (dragPx > 0) {
  await page.mouse.move(640, 400);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(640, 400 + (dragPx * i) / 10);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(300);
}
await page.screenshot({ path: out });
if (dragPx > 0) await page.mouse.up();
console.log('saved', out);
await browser.close();
