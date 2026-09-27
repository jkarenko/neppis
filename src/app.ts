// The app above the race: which screen is up, and what each button does. The race engine (game.ts) knows nothing
// about screens; main.ts hands this the callbacks that start, pause and clear a race.
import type { Player, PlayerSetup } from './game.ts';
import { PLAYER_COLORS } from './config.ts';
import { DRIVER_BY_ID, ROSTER, TIERS } from './roster.ts';
import { driverCard, humanFace } from './kit.ts';
import { portrait } from './portraits.ts';
import { SetupScreen } from './setup.ts';
import { maxPowerForTurn } from './ai.ts';
import { powerColor } from './indicator.ts';
import { FLICK } from './config.ts';
import { canVibrate, getSetting, setSetting, type SettingKey } from './settings.ts';

export type Screen = 'menu' | 'setup' | 'opponents' | 'settings' | 'howto' | 'race' | 'pause' | 'results';
const SCREENS: Screen[] = ['menu', 'setup', 'opponents', 'settings', 'howto', 'pause', 'results'];

export interface AppHooks {
  startRace(setups: PlayerSetup[], laps: number): void;
  /** Freeze or thaw the world. */
  setPaused(paused: boolean): void;
  /** Throw the race away and leave the scene empty for the menu. */
  clearRace(): void;
}

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const BEATEN_KEY = 'neppis.beaten';

function loadBeaten(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(BEATEN_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string' && id in DRIVER_BY_ID) : []);
  } catch {
    return new Set();
  }
}

/** The face for a results row: the driver's portrait, or an initial on the human's colour. */
function face(p: Player): string {
  const d = p.driverId ? DRIVER_BY_ID[p.driverId] : undefined;
  return d ? portrait(d.portrait) : humanFace(p.name, p.color);
}

export class App {
  screen: Screen = 'menu';
  private lastGrid: { setups: PlayerSetup[]; laps: number } | null = null;
  /** Where Settings and How to play return to: the menu or the pause card. */
  private from: Screen = 'menu';
  private readonly setup: SetupScreen;
  private readonly beaten = loadBeaten();
  private readonly el = (id: string) => document.getElementById(id)!;

  constructor(private readonly hooks: AppHooks) {
    this.setup = new SetupScreen(this.el('setup'), (setups, laps) => this.startRace(setups, laps));
    this.el('menuVersion').textContent = `v${__APP_VERSION__}`;
    this.el('menuRace').onclick = () => this.go('setup');
    this.el('menuOpponents').onclick = () => this.go('opponents');
    this.el('menuSettings').onclick = () => this.openFrom('settings', 'menu');
    this.el('menuHowto').onclick = () => this.openFrom('howto', 'menu');
    this.el('pauseBtn').onclick = () => this.pause();
    this.el('pauseResume').onclick = () => this.resume();
    this.el('pauseSettings').onclick = () => this.openFrom('settings', 'pause');
    this.el('pauseHowto').onclick = () => this.openFrom('howto', 'pause');
    this.el('pauseQuit').onclick = () => this.confirmQuit(true);
    this.el('pauseKeep').onclick = () => this.confirmQuit(false);
    this.el('pauseQuitYes').onclick = () => this.quit();
    this.el('resultsAgain').onclick = () => this.lastGrid && this.startRace(this.lastGrid.setups, this.lastGrid.laps);
    this.el('resultsSetup').onclick = () => this.go('setup');
    this.el('resultsMenu').onclick = () => this.quit();
    for (const b of document.querySelectorAll<HTMLButtonElement>('.screen .back')) b.onclick = () => this.back();
    this.renderRoster();
    this.renderHowtoWedge();
    for (const sw of document.querySelectorAll<HTMLButtonElement>('#settings .switch')) {
      const key = sw.dataset.setting as SettingKey;
      sw.setAttribute('aria-checked', String(getSetting(key)));
      sw.onclick = () => {
        const on = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', String(on));
        setSetting(key, on);
      };
    }
    // A switch that cannot do anything is not shown: haptics only where the browser vibrates.
    this.el('hapticsRow').hidden = !canVibrate();
    const dots = this.el('howtoDots');
    const strip = this.el('howtoStrip');
    strip.onscroll = () => {
      const page = Math.round(strip.scrollLeft / (strip.firstElementChild as HTMLElement).offsetWidth);
      dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('is-on', i === page));
    };
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.screen === 'race') this.pause();
      else if (this.screen === 'pause') this.resume();
      else if (this.screen !== 'menu' && this.screen !== 'results') this.back();
    });
  }

  /** Show one screen and hide the rest. The race "screen" is the bare HUD. */
  go(screen: Screen, opponents?: string[]): void {
    this.screen = screen;
    for (const id of SCREENS) this.el(id).hidden = id !== screen;
    this.el('pauseBtn').hidden = screen !== 'race';
    if (screen === 'setup') this.setup.open(opponents);
  }

  private startRace(setups: PlayerSetup[], laps: number): void {
    this.lastGrid = { setups, laps };
    this.go('race');
    this.hooks.startRace(setups, laps);
  }

  /** The tutorial's wedge: a fan of slices coloured by the game's own power-by-angle curve, apex at (40, 60). */
  private renderHowtoWedge(): void {
    const half = (FLICK.maxTurnDeg * Math.PI) / 180;
    const n = 36;
    const r = 80;
    const ax = 40;
    const slices: string[] = [];
    for (let i = 0; i < n; i++) {
      const a0 = -half + (2 * half * i) / n;
      const a1 = -half + (2 * half * (i + 1)) / n;
      const mid = (a0 + a1) / 2;
      const col = '#' + powerColor(maxPowerForTurn(mid)).getHexString();
      // A hair of overlap so the slices do not show seams.
      const b0 = a0 - 0.004;
      const b1 = a1 + 0.004;
      slices.push(`<path d="M${ax} 60L${(ax + r * Math.cos(b0)).toFixed(1)} ${(60 + r * Math.sin(b0)).toFixed(1)}A${r} ${r} 0 0 1 ${(ax + r * Math.cos(b1)).toFixed(1)} ${(60 + r * Math.sin(b1)).toFixed(1)}Z" fill="${col}"/>`);
    }
    this.el('howtoWedge').innerHTML = slices.join('');
  }

  /** The Opponents screen: the whole ladder by tier, cards flip to their back, "Race this one" pre-fills setup. */
  private renderRoster(): void {
    const root = this.el('roster');
    root.innerHTML = TIERS.map(
      (t) =>
        `<h3>${t.name}</h3><div class="cards">${ROSTER.slice(t.from, t.to)
          .map((d, i) => driverCard(d, PLAYER_COLORS[(t.from + i) % PLAYER_COLORS.length], { button: true, flip: true, beaten: this.beaten.has(d.id) }))
          .join('')}</div>`,
    ).join('');
    for (const card of root.querySelectorAll<HTMLElement>('.driver')) {
      const flip = () => {
        const back = !card.classList.contains('is-back');
        card.classList.toggle('is-back', back);
        card.setAttribute('aria-expanded', String(back));
      };
      card.onclick = flip;
      card.onkeydown = (e) => {
        if (e.target !== card || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        flip();
      };
    }
    for (const b of root.querySelectorAll<HTMLButtonElement>('.race-one')) {
      b.onclick = (e) => {
        e.stopPropagation();
        this.go('setup', [b.dataset.driver!]);
      };
    }
  }

  showResults(placings: Player[]): void {
    const cm = (units: number) => Math.round(units * 10);
    const winner = placings[0].name;
    this.el('resultsTitle').textContent = winner.trim().toLowerCase() === 'you' ? 'You win!' : `${winner} wins!`;
    // The first three on steps (second, first, third, so the winner is in the middle and tallest), the rest as rows.
    const top = placings.slice(0, 3);
    const steps = [top[1], top[0], top[2]].filter((p): p is Player => Boolean(p));
    this.el('podium').innerHTML = steps
      .map((p) => `<div class="step p${p.place}" style="--c:${hex(p.color)}"><div class="portrait">${face(p)}</div><span class="name">${p.name}</span><span class="place num">${p.place}</span></div>`)
      .join('');
    // Stats as aligned columns under one header row, so nothing needs a unit word and the eye compares down a column.
    const row = (p: Player) =>
      `<li style="--c:${hex(p.color)}"><span class="place num">${p.place}</span><span class="portrait is-small">${face(p)}</span><span class="name">${p.name}</span><span class="num">${p.flicks}</span><span class="num">${p.flips}</span><span class="num">${p.bestFlick ? cm(p.bestFlick) + ' cm' : '–'}</span></li>`;
    this.el('resultsList').innerHTML = `<li class="head"><span></span><span></span><span></span><span>Flicks</span><span>Flips</span><span>Best</span></li>` + placings.map(row).join('');
    this.recordBeaten(placings);
    this.go('results');
  }

  /** Every AI driver that finished behind a human is remembered as beaten; the Opponents screen shows the tick. */
  private recordBeaten(placings: Player[]): void {
    const bestHuman = placings.find((p) => !p.ai);
    if (!bestHuman) return;
    let changed = false;
    for (const p of placings) {
      if (p.ai && p.driverId && p.place > bestHuman.place && !this.beaten.has(p.driverId)) {
        this.beaten.add(p.driverId);
        changed = true;
      }
    }
    if (!changed) return;
    try {
      localStorage.setItem(BEATEN_KEY, JSON.stringify([...this.beaten]));
    } catch {
      /* private mode */
    }
    this.renderRoster();
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

  private openFrom(screen: 'settings' | 'howto', from: Screen): void {
    this.from = from;
    this.go(screen);
  }

  private back(): void {
    if (this.screen === 'settings' || this.screen === 'howto') this.go(this.from);
    else if (this.screen === 'setup' || this.screen === 'opponents') this.go('menu');
  }
}
