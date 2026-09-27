import type { Game, PlayerSetup } from './game.ts';
import { PLAYER_COLORS } from './config.ts';
import { DEFAULT_GRID, DRIVER_BY_ID, ROSTER, driverByName } from './roster.ts';
import { icon } from './icons.ts';

// Interim: until the setup screen from docs/ui-plan.md exists, AI rows get roster drivers by name, and a typed
// name that matches a driver takes that driver's profile.
const AI_NAMES = DEFAULT_GRID.map((id) => DRIVER_BY_ID[id].name);

/** The last grid, so a hot-seat group does not retype names every race. */
interface SavedSetup {
  players: { name: string; ai: boolean }[];
  laps: number;
}
const SETUP_KEY = 'neppis.setup';
function loadSetup(): SavedSetup | null {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as SavedSetup;
    if (!Array.isArray(v.players) || v.players.length === 0 || v.players.length > 6) return null;
    return { players: v.players.map((p) => ({ name: String(p.name).slice(0, 16), ai: Boolean(p.ai) })), laps: Math.max(1, Math.min(5, Number(v.laps) || 1)) };
  } catch {
    return null;
  }
}
function saveSetup(v: SavedSetup): void {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(v));
  } catch {
    /* private mode: the form simply starts empty next time */
  }
}

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export class Hud {
  private readonly players = document.getElementById('players')!;
  private readonly turn = document.getElementById('turn')!;
  private readonly finger = document.getElementById('finger')!;
  private readonly message = document.getElementById('message')!;
  private readonly setup = document.getElementById('setup')!;
  private readonly rows = document.getElementById('playerRows')!;
  private messageTimer = 0;

  showSetup(onStart: (setups: PlayerSetup[], laps: number) => void): void {
    const form = document.getElementById('setupForm') as HTMLFormElement;
    const add = document.getElementById('addPlayer') as HTMLButtonElement;
    const lapsInput = document.getElementById('laps') as HTMLInputElement;
    if (this.rows.childElementCount === 0) {
      const saved = loadSetup();
      if (saved) {
        for (const r of saved.players) this.addRow(r.name, r.ai);
        lapsInput.value = String(saved.laps);
      } else {
        this.addRow('Player 1', false);
        this.addRow(AI_NAMES[0], true);
      }
    }
    add.onclick = () => {
      if (this.rows.childElementCount >= 6) return;
      this.addRow(this.freeDriverName(), true);
    };
    const lapsValue = document.getElementById('lapsValue')!;
    const setLaps = (n: number) => {
      lapsInput.value = String(Math.max(1, Math.min(5, n)));
      lapsValue.textContent = lapsInput.value;
    };
    (document.getElementById('lapsMinus') as HTMLButtonElement).onclick = () => setLaps(Number(lapsInput.value) - 1);
    (document.getElementById('lapsPlus') as HTMLButtonElement).onclick = () => setLaps(Number(lapsInput.value) + 1);
    setLaps(Number(lapsInput.value) || 1);
    form.onsubmit = (e) => {
      e.preventDefault();
      const setups: PlayerSetup[] = [];
      for (const row of Array.from(this.rows.children)) {
        const name = (row.querySelector('input') as HTMLInputElement).value.trim() || 'Player';
        const ai = (row.querySelector('select') as HTMLSelectElement).value === 'ai';
        setups.push({ name, ai, profile: ai ? driverByName(name)?.profile : undefined });
      }
      if (setups.length === 0) return;
      const laps = Math.max(1, Math.min(5, Number(lapsInput.value) || 1));
      saveSetup({ players: setups.map((p) => ({ name: p.name, ai: p.ai })), laps });
      onStart(setups, laps);
    };
    this.setup.hidden = false;
  }

  /** A driver not yet on the grid, drawn at random; the interim form's stand-in for the opponent picker. */
  private freeDriverName(): string {
    const taken = new Set(Array.from(this.rows.querySelectorAll('input')).map((i) => i.value.trim().toLowerCase()));
    const free = ROSTER.filter((d) => !taken.has(d.name.toLowerCase()));
    if (free.length === 0) return `Player ${this.rows.childElementCount + 1}`;
    return free[Math.floor(Math.random() * free.length)].name;
  }

  hideSetup(): void {
    this.setup.hidden = true;
  }

  private addRow(name: string, ai: boolean): void {
    const i = this.rows.childElementCount;
    const row = document.createElement('div');
    row.className = 'prow';
    row.innerHTML = `
      <span class="swatch" style="background:${hex(PLAYER_COLORS[i % PLAYER_COLORS.length])}"></span>
      <input type="text" class="field" value="${name}" maxlength="16" />
      <select class="field"><option value="human"${ai ? '' : ' selected'}>Human</option><option value="ai"${ai ? ' selected' : ''}>AI</option></select>
      <button type="button" class="btn btn-icon" aria-label="Remove">${icon('close')}</button>`;
    (row.querySelector('select') as HTMLSelectElement).onchange = (e) => {
      const input = row.querySelector('input') as HTMLInputElement;
      const human = (e.target as HTMLSelectElement).value === 'human';
      if (human && driverByName(input.value)) input.value = `Player ${this.humanCount() + 1}`;
      if (!human && /^Player \d+$/.test(input.value)) input.value = this.freeDriverName();
    };
    (row.querySelector('button') as HTMLButtonElement).onclick = () => {
      row.remove();
      this.recolorRows();
    };
    this.rows.appendChild(row);
  }

  private humanCount(): number {
    return Array.from(this.rows.querySelectorAll('select')).filter((sel) => sel.value === 'human').length;
  }

  private recolorRows(): void {
    Array.from(this.rows.children).forEach((row, i) => {
      (row.querySelector('.swatch') as HTMLElement).style.background = hex(PLAYER_COLORS[i % PLAYER_COLORS.length]);
    });
  }

  render(game: Game): void {
    const current = game.phase !== 'finished' ? game.current : null;
    this.players.innerHTML = game.players
      .map((p) => {
        const isCurrent = current === p;
        const stat = p.finished ? `P${p.place}` : `lap ${Math.max(0, p.lap) + 1}/${game.rules.laps}`;
        return `<div class="player${isCurrent ? ' current' : ''}" style="--c:${hex(p.color)}">
          <span class="dot" style="background:${hex(p.color)}"></span>
          <span class="name">${p.name}</span>
          <span class="stat">${stat}</span>
        </div>`;
      })
      .join('');

    // Flicks left, top centre, in the current car's colour. Whose turn it is comes from the colour alone.
    if (!current) {
      this.turn.hidden = true;
      return;
    }
    const chevron = (used: boolean) => `<svg viewBox="0 0 18 18"${used ? ' class="used"' : ''}><path d="M4 6 L9 12 L14 6"/></svg>`;
    this.turn.style.setProperty('--c', hex(current.color));
    this.turn.innerHTML = Array.from({ length: game.rules.flicksPerTurn }, (_, i) => chevron(i >= game.flicksLeft)).join('');
    this.turn.hidden = false;
  }

  /** Place the first-turn finger cue at a screen position, or hide it. */
  showFinger(at: { x: number; y: number } | null): void {
    if (!at) {
      this.finger.hidden = true;
      return;
    }
    this.finger.hidden = false;
    this.finger.style.left = `${at.x}px`;
    this.finger.style.top = `${at.y}px`;
  }

  say(text: string, ms = 2600): void {
    this.message.textContent = text;
    this.message.classList.add('show');
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => this.message.classList.remove('show'), ms);
  }
}
