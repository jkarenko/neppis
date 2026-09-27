// The app above the race: which screen is up, and what each button does. The race engine (game.ts) knows nothing
// about screens; main.ts hands this the callbacks that start, pause and clear a race.
import type { Player, PlayerSetup } from './game.ts';

export type Screen = 'menu' | 'setup' | 'settings' | 'race' | 'pause' | 'results';

export interface AppHooks {
  /** Show the setup form; it calls back with the grid when the player presses Start. */
  openSetup(onStart: (setups: PlayerSetup[], laps: number) => void): void;
  hideSetup(): void;
  startRace(setups: PlayerSetup[], laps: number): void;
  /** Freeze or thaw the world. */
  setPaused(paused: boolean): void;
  /** Throw the race away and leave the scene empty for the menu. */
  clearRace(): void;
}

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const SOUND_KEY = 'neppis.sound';

export class App {
  screen: Screen = 'menu';
  private lastGrid: { setups: PlayerSetup[]; laps: number } | null = null;
  private settingsFrom: Screen = 'menu';
  private readonly el = (id: string) => document.getElementById(id)!;

  constructor(private readonly hooks: AppHooks) {
    this.el('menuVersion').textContent = `v${__APP_VERSION__}`;
    this.el('menuRace').onclick = () => this.go('setup');
    this.el('menuSettings').onclick = () => this.openSettings('menu');
    this.el('pauseBtn').onclick = () => this.pause();
    this.el('pauseResume').onclick = () => this.resume();
    this.el('pauseSettings').onclick = () => this.openSettings('pause');
    this.el('pauseQuit').onclick = () => this.confirmQuit(true);
    this.el('pauseKeep').onclick = () => this.confirmQuit(false);
    this.el('pauseQuitYes').onclick = () => this.quit();
    this.el('resultsAgain').onclick = () => this.lastGrid && this.startRace(this.lastGrid.setups, this.lastGrid.laps);
    this.el('resultsSetup').onclick = () => this.go('setup');
    this.el('resultsMenu').onclick = () => this.quit();
    for (const b of document.querySelectorAll<HTMLButtonElement>('.screen .back')) b.onclick = () => this.back();
    const sound = this.el('soundSwitch');
    sound.setAttribute('aria-checked', String(App.soundOn()));
    sound.onclick = () => {
      const on = sound.getAttribute('aria-checked') !== 'true';
      sound.setAttribute('aria-checked', String(on));
      try {
        localStorage.setItem(SOUND_KEY, on ? '1' : '0');
      } catch {
        /* private mode */
      }
    };
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.screen === 'race') this.pause();
      else if (this.screen === 'pause') this.resume();
      else if (this.screen === 'setup' || this.screen === 'settings') this.back();
    });
  }

  static soundOn(): boolean {
    try {
      return localStorage.getItem(SOUND_KEY) !== '0';
    } catch {
      return true;
    }
  }

  /** Show one screen and hide the rest. The race "screen" is the bare HUD. */
  go(screen: Screen): void {
    const prev = this.screen;
    this.screen = screen;
    if (prev === 'setup' && screen !== 'setup') this.hooks.hideSetup();
    for (const id of ['menu', 'setup', 'settings', 'pause', 'results']) this.el(id).hidden = id !== screen;
    this.el('pauseBtn').hidden = screen !== 'race';
    if (screen === 'setup') this.hooks.openSetup((setups, laps) => this.startRace(setups, laps));
  }

  private startRace(setups: PlayerSetup[], laps: number): void {
    this.lastGrid = { setups, laps };
    this.go('race');
    this.hooks.startRace(setups, laps);
  }

  showResults(placings: Player[]): void {
    this.el('resultsTitle').textContent = `${placings[0].name} wins!`;
    this.el('resultsList').innerHTML = placings.map((p) => `<li><span class="dot" style="background:${hex(p.color)}"></span>${p.name}</li>`).join('');
    this.go('results');
  }

  private pause(): void {
    if (this.screen !== 'race') return;
    this.hooks.setPaused(true);
    this.confirmQuit(false);
    this.go('pause');
  }

  private resume(): void {
    this.hooks.setPaused(false);
    this.go('race');
  }

  private confirmQuit(asking: boolean): void {
    this.el('pauseMain').hidden = asking;
    this.el('pauseConfirm').hidden = !asking;
  }

  /** Leave a race (from pause or results) for the menu. */
  private quit(): void {
    this.hooks.setPaused(false);
    this.hooks.clearRace();
    this.go('menu');
  }

  private openSettings(from: Screen): void {
    this.settingsFrom = from;
    this.go('settings');
  }

  private back(): void {
    if (this.screen === 'settings') this.go(this.settingsFrom);
    else if (this.screen === 'setup') this.go('menu');
  }
}
