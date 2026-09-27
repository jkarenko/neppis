// Shared Playwright setup for the browser-driven scripts: headless Chromium on SwiftShader, viewport presets.
import { chromium, type Browser, type Page } from 'playwright';

export const PRESETS: Record<string, string> = {
  iphone: '393x852',
  'iphone-landscape': '852x393',
  ipad: '1032x1376',
  'ipad-landscape': '1376x1032',
  'macbook-air': '1470x956',
  'desktop-1080p': '1920x1080',
  'laptop-1366': '1366x768',
  'laptop-1536': '1536x864',
  'android-phone': '412x915',
  'android-phone-landscape': '915x412',
  'android-tablet': '800x1280',
  'android-tablet-landscape': '1280x800',
};

export interface Viewport { label: string; width: number; height: number; scale: number }

/** A preset name or WxH, optionally followed by @scale. */
export function parseViewport(spec: string): Viewport {
  const m = /^([a-z0-9-]+?)(?:@(\d+(?:\.\d+)?))?$/.exec(spec);
  if (!m) throw new Error(`bad viewport ${JSON.stringify(spec)}`);
  const [, name, scale] = m as unknown as [string, string, string | undefined];
  const size = PRESETS[name] ?? name;
  const s = /^(\d+)x(\d+)$/.exec(size);
  if (!s) throw new Error(`viewport must be a preset (${Object.keys(PRESETS).join(', ')}) or WxH[@scale], got ${JSON.stringify(spec)}`);
  return { label: spec, width: Number(s[1]), height: Number(s[2]), scale: Number(scale ?? 1) };
}

export function launchBrowser(): Promise<Browser> {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

/** A page at the viewport with browser errors and warnings forwarded to the terminal. */
export async function openPage(browser: Browser, vp: Viewport): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[browser ${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`[browser pageerror] ${e.message}`));
  return page;
}
