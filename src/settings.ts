// Player settings: stored in localStorage, read by whoever acts on them (audio, input, CSS). Reduced motion defaults
// from the OS media query and can be overridden; haptics exist only where the browser can vibrate.
export type SettingKey = 'sound' | 'haptics' | 'reducedMotion';

const KEYS: Record<SettingKey, string> = { sound: 'neppis.sound', haptics: 'neppis.haptics', reducedMotion: 'neppis.reducedMotion' };

export const canVibrate = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

function defaultFor(key: SettingKey): boolean {
  if (key === 'reducedMotion') return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return true;
}

export function getSetting(key: SettingKey): boolean {
  try {
    const v = localStorage.getItem(KEYS[key]);
    return v === null ? defaultFor(key) : v === '1';
  } catch {
    return defaultFor(key);
  }
}

export function setSetting(key: SettingKey, on: boolean): void {
  try {
    localStorage.setItem(KEYS[key], on ? '1' : '0');
  } catch {
    /* private mode: the switch works for this visit */
  }
  if (key === 'reducedMotion') applyMotion();
}

/** The reduced-motion choice as a class on <html>, which the stylesheet keys its transitions and pulses on. */
export function applyMotion(): void {
  document.documentElement.classList.toggle('reduce-motion', getSetting('reducedMotion'));
}

/** A short buzz on a flick release, where supported and wanted. */
export function haptic(): void {
  if (canVibrate() && getSetting('haptics')) navigator.vibrate(15);
}
