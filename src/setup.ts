// The setup screen: humans on the left, the ladder as a strip of driver cards on the right with tier tabs above
// it that scroll the strip, laps, the full-grid presets and Start in the foot. Its state is remembered in
// localStorage. Design reading: docs/ui-plan.md, section 2 "Setup".
import type { PlayerSetup } from './game.ts';
import { PLAYER_COLORS } from './config.ts';
import { DRIVER_BY_ID, PRESETS, PRESET_BY_ID, ROSTER, TIERS, drawPreset, drawTier, tierOf, type Driver } from './roster.ts';
import { icon } from './icons.ts';
import { driverCard } from './kit.ts';

export const MAX_CARS = 6;
export const MAX_LAPS = 5;
/** A tier draw makes a four-car race unless more humans want in. */
const TIER_OPPONENTS = 3;

interface Human {
  name: string;
  color: number;
}

interface SetupState {
  humans: Human[];
  /** Roster ids, kept in ladder order. */
  opponents: string[];
  laps: number;
  /** The preset whose draw the opponents still are, or null once a card was touched. */
  preset: string | null;
}

const SETUP_KEY = 'neppis.setup.v2';
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const ladderOrder = (ids: string[]) => [...ids].sort((a, b) => ROSTER.indexOf(DRIVER_BY_ID[a]) - ROSTER.indexOf(DRIVER_BY_ID[b]));

function loadState(): SetupState | null {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as SetupState;
    if (!Array.isArray(v.humans) || v.humans.length === 0 || !Array.isArray(v.opponents)) return null;
    const humans = v.humans.slice(0, MAX_CARS).map((h, i) => ({ name: String(h.name ?? '').slice(0, 16) || `Player ${i + 1}`, color: PLAYER_COLORS.includes(Number(h.color)) ? Number(h.color) : PLAYER_COLORS[i] }));
    const opponents = ladderOrder(v.opponents.filter((id) => typeof id === 'string' && id in DRIVER_BY_ID)).slice(0, MAX_CARS - humans.length);
    return { humans, opponents, laps: Math.max(1, Math.min(MAX_LAPS, Number(v.laps) || 1)), preset: typeof v.preset === 'string' && v.preset in PRESET_BY_ID ? v.preset : null };
  } catch {
    return null;
  }
}

function saveState(v: SetupState): void {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(v));
  } catch {
    /* private mode: the form simply starts fresh next time */
  }
}

function firstState(): SetupState {
  const rookie = TIERS[0];
  return { humans: [{ name: 'Player 1', color: PLAYER_COLORS[0] }], opponents: drawTier(rookie, TIER_OPPONENTS).map((d) => d.id), laps: 1, preset: null };
}

export class SetupScreen {
  private state: SetupState = firstState();
  private readonly rows: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly tiers: HTMLElement;
  private readonly presets: HTMLElement;
  private readonly count: HTMLElement;
  private readonly lapsValue: HTMLElement;
  private readonly add: HTMLButtonElement;
  private readonly cards = new Map<string, HTMLButtonElement>();

  constructor(
    private readonly root: HTMLElement,
    private readonly onStart: (setups: PlayerSetup[], laps: number) => void,
  ) {
    const q = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
    this.rows = q('playerRows');
    this.strip = q('driverStrip');
    this.tiers = q('tiers');
    this.presets = q('presets');
    this.count = q('gridCount');
    this.lapsValue = q('lapsValue');
    this.add = q<HTMLButtonElement>('addPlayer');

    this.add.onclick = () => {
      if (this.cars() >= MAX_CARS) return;
      this.state.humans.push({ name: `Player ${this.state.humans.length + 1}`, color: this.freeColor() });
      this.rows.appendChild(this.row(this.state.humans.length - 1));
      this.sync();
    };
    q<HTMLButtonElement>('lapsMinus').onclick = () => this.setLaps(this.state.laps - 1);
    q<HTMLButtonElement>('lapsPlus').onclick = () => this.setLaps(this.state.laps + 1);
    (root.querySelector('form') as HTMLFormElement).onsubmit = (e) => {
      e.preventDefault();
      this.start();
    };

    // The tier tabs only move the strip; the lit one follows the scroll.
    this.tiers.innerHTML = TIERS.map((t) => `<button type="button" class="tab" role="tab" data-tier="${t.id}">${t.name}</button>`).join('');
    for (const b of this.tiers.querySelectorAll<HTMLButtonElement>('.tab')) b.onclick = () => this.scrollTo(TIERS.find((t) => t.id === b.dataset.tier)!.from);
    this.strip.addEventListener('scroll', () => this.lightTab(), { passive: true });
    this.strip.addEventListener('scrollend', () => this.lightTab());

    this.presets.innerHTML = PRESETS.map((p) => `<button type="button" class="btn btn-small preset" data-preset="${p.id}">${p.name}</button>`).join('');
    for (const b of this.presets.querySelectorAll<HTMLButtonElement>('.preset')) b.onclick = () => this.fill(b.dataset.preset!);

    this.strip.innerHTML = ROSTER.map((d) => driverCard(d, PLAYER_COLORS[0], { compact: true, button: true })).join('');
    for (const b of this.strip.querySelectorAll<HTMLButtonElement>('.driver')) {
      this.cards.set(b.dataset.driver!, b);
      b.onclick = () => this.toggle(b.dataset.driver!);
    }
  }

  /** Show the form from the remembered state; `opponents` overrides the AI picks (Race this one). */
  open(opponents?: string[]): void {
    this.state = loadState() ?? firstState();
    if (opponents) {
      this.state.opponents = ladderOrder(opponents).slice(0, MAX_CARS - this.state.humans.length);
      this.state.preset = null;
    }
    this.rows.replaceChildren(...this.state.humans.map((_, i) => this.row(i)));
    this.sync();
    this.root.hidden = false;
    // Open on the first pick, so what is picked is in view.
    const first = this.state.opponents[0];
    this.scrollTo(first ? ROSTER.indexOf(DRIVER_BY_ID[first]) : 0, false);
  }

  close(): void {
    this.root.hidden = true;
  }

  private cars(): number {
    return this.state.humans.length + this.state.opponents.length;
  }

  private freeColor(): number {
    const used = new Set(this.state.humans.map((h) => h.color));
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
  }

  /** The next colour no other human holds, after this one. */
  private nextColor(from: number, self: number): number {
    const used = new Set(this.state.humans.filter((_, i) => i !== self).map((h) => h.color));
    const n = PLAYER_COLORS.length;
    let i = (PLAYER_COLORS.indexOf(from) + 1) % n;
    while (used.has(PLAYER_COLORS[i])) i = (i + 1) % n;
    return PLAYER_COLORS[i];
  }

  /** Opponents take the colours the humans left, in ladder order. */
  private opponentColors(): Map<string, number> {
    const used = new Set(this.state.humans.map((h) => h.color));
    const free = PLAYER_COLORS.filter((c) => !used.has(c));
    return new Map(this.state.opponents.map((id, i) => [id, free[i % free.length]]));
  }

  private row(i: number): HTMLElement {
    const h = this.state.humans[i];
    const row = document.createElement('div');
    row.className = 'prow';
    row.innerHTML = `
      <button type="button" class="swatch" aria-label="Change colour"></button>
      <input type="text" class="field" value="${h.name.replace(/"/g, '&quot;')}" maxlength="16" aria-label="Player name" />
      <button type="button" class="btn btn-icon remove" aria-label="Remove player">${icon('close')}</button>`;
    const swatch = row.querySelector<HTMLButtonElement>('.swatch')!;
    const input = row.querySelector<HTMLInputElement>('input')!;
    swatch.onclick = () => {
      const idx = this.index(row);
      this.state.humans[idx].color = this.nextColor(this.state.humans[idx].color, idx);
      this.sync();
    };
    input.oninput = () => {
      this.state.humans[this.index(row)].name = input.value;
    };
    row.querySelector<HTMLButtonElement>('.remove')!.onclick = () => {
      if (this.state.humans.length <= 1) return;
      this.state.humans.splice(this.index(row), 1);
      row.remove();
      this.sync();
    };
    return row;
  }

  private index(row: HTMLElement): number {
    return Array.from(this.rows.children).indexOf(row);
  }

  private toggle(id: string): void {
    const on = this.state.opponents.includes(id);
    if (!on && this.cars() >= MAX_CARS) return;
    this.state.opponents = on ? this.state.opponents.filter((o) => o !== id) : ladderOrder([...this.state.opponents, id]);
    this.state.preset = null;
    this.sync();
  }

  /** Fill every slot the humans leave with a draw from the preset's window of the ladder. */
  private fill(presetId: string): void {
    const preset = PRESET_BY_ID[presetId];
    const n = Math.max(0, MAX_CARS - this.state.humans.length);
    this.state.opponents = drawPreset(preset, n).map((d) => d.id);
    this.state.preset = presetId;
    this.sync();
    const first = this.state.opponents[0];
    if (first) this.scrollTo(ROSTER.indexOf(DRIVER_BY_ID[first]));
  }

  /** A card's left edge in the strip's scroll coordinates. */
  private cardLeft(card: HTMLElement): number {
    return card.getBoundingClientRect().left - this.strip.getBoundingClientRect().left + this.strip.scrollLeft;
  }

  private scrollTo(ladderIndex: number, smooth = true): void {
    const card = this.cards.get(ROSTER[ladderIndex].id);
    if (card) this.strip.scrollTo({ left: this.cardLeft(card), behavior: smooth ? 'smooth' : 'instant' });
    this.lightTab(ladderIndex);
  }

  /** Light the tab of the tier in view: the first card at or past the strip's left edge, or the given one. */
  private lightTab(ladderIndex?: number): void {
    let index = ladderIndex;
    if (index === undefined) {
      const left = this.strip.scrollLeft;
      index = ROSTER.findIndex((d) => {
        const card = this.cards.get(d.id)!;
        return this.cardLeft(card) + card.offsetWidth / 2 >= left;
      });
      if (index < 0) index = ROSTER.length - 1;
    }
    const tier = tierOf(ROSTER[index]);
    for (const b of this.tiers.querySelectorAll<HTMLButtonElement>('.tab')) {
      const on = b.dataset.tier === tier.id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    }
  }

  private setLaps(n: number): void {
    this.state.laps = Math.max(1, Math.min(MAX_LAPS, n));
    this.lapsValue.textContent = String(this.state.laps);
  }

  /** Bring every control in line with the state: swatches, card picks and colours, preset button, counter, dimming. */
  private sync(): void {
    const humans = this.state.humans;
    Array.from(this.rows.children).forEach((row, i) => {
      (row.querySelector('.swatch') as HTMLElement).style.background = hex(humans[i].color);
      (row.querySelector('.remove') as HTMLButtonElement).disabled = humans.length <= 1;
    });
    const full = this.cars() >= MAX_CARS;
    const colors = this.opponentColors();
    for (const [id, card] of this.cards) {
      const picked = colors.has(id);
      card.classList.toggle('is-picked', picked);
      card.setAttribute('aria-pressed', String(picked));
      card.disabled = full && !picked;
      if (picked) card.style.setProperty('--c', hex(colors.get(id)!));
    }
    for (const b of this.presets.querySelectorAll<HTMLButtonElement>('.preset')) b.classList.toggle('is-on', b.dataset.preset === this.state.preset);
    this.add.disabled = full;
    this.count.textContent = `${this.cars()} of ${MAX_CARS} cars`;
    this.setLaps(this.state.laps);
  }

  private start(): void {
    const humans = this.state.humans.map((h, i) => ({ ...h, name: h.name.trim() || `Player ${i + 1}` }));
    this.state.humans = humans;
    saveState(this.state);
    const colors = this.opponentColors();
    const setups: PlayerSetup[] = [
      ...humans.map((h) => ({ name: h.name, ai: false, color: h.color })),
      ...this.state.opponents.map((id) => {
        const d: Driver = DRIVER_BY_ID[id];
        return { name: d.name, ai: true, profile: d.profile, driverId: d.id, color: colors.get(id) };
      }),
    ];
    this.onStart(setups, this.state.laps);
  }
}
