import type { Game, Player, PlayerSetup } from './game.ts';
import { PLAYER_COLORS } from './config.ts';

const AI_NAMES = ['Kalle', 'Pena', 'Simo', 'Raimo', 'Tapsa'];

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export class Hud {
  private readonly players = document.getElementById('players')!;
  private readonly turn = document.getElementById('turn')!;
  private readonly finger = document.getElementById('finger')!;
  private readonly message = document.getElementById('message')!;
  private readonly power = document.getElementById('power')!;
  private readonly setup = document.getElementById('setup')!;
  private readonly rows = document.getElementById('playerRows')!;
  private readonly results = document.getElementById('results')!;
  private messageTimer = 0;

  showSetup(onStart: (setups: PlayerSetup[], laps: number) => void): void {
    const form = document.getElementById('setupForm') as HTMLFormElement;
    const add = document.getElementById('addPlayer') as HTMLButtonElement;
    const lapsInput = document.getElementById('laps') as HTMLInputElement;
    if (this.rows.childElementCount === 0) {
      this.addRow('You', false);
      this.addRow(AI_NAMES[0], true);
    }
    add.onclick = () => {
      if (this.rows.childElementCount >= 6) return;
      this.addRow(AI_NAMES[this.rows.childElementCount - 1] ?? 'Player', true);
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      const setups: PlayerSetup[] = [];
      for (const row of Array.from(this.rows.children)) {
        const name = (row.querySelector('input') as HTMLInputElement).value.trim() || 'Player';
        const ai = (row.querySelector('select') as HTMLSelectElement).value === 'ai';
        setups.push({ name, ai });
      }
      if (setups.length === 0) return;
      this.setup.hidden = true;
      onStart(setups, Math.max(1, Math.min(5, Number(lapsInput.value) || 1)));
    };
    this.results.hidden = true;
    this.setup.hidden = false;
  }

  /** Scenario mode starts the race without the form. */
  hideSetup(): void {
    this.setup.hidden = true;
    this.results.hidden = true;
  }

  private addRow(name: string, ai: boolean): void {
    const i = this.rows.childElementCount;
    const row = document.createElement('div');
    row.className = 'prow';
    row.innerHTML = `
      <span class="swatch" style="background:${hex(PLAYER_COLORS[i % PLAYER_COLORS.length])}"></span>
      <input type="text" value="${name}" maxlength="14" />
      <select><option value="human"${ai ? '' : ' selected'}>Human</option><option value="ai"${ai ? ' selected' : ''}>AI</option></select>
      <button type="button" title="Remove">×</button>`;
    (row.querySelector('button') as HTMLButtonElement).onclick = () => {
      row.remove();
      this.recolorRows();
    };
    this.rows.appendChild(row);
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
          <span class="name">${p.name}${p.ai ? ' <span class="stat">(AI)</span>' : ''}</span>
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

  showPower(p: number | null): void {
    if (p === null) {
      this.power.textContent = '';
      this.power.style.display = 'none';
      return;
    }
    const label = p < 0.3 ? 'gentle' : p < 0.6 ? 'safe' : p < 0.8 ? 'brisk' : 'risky';
    this.power.style.display = '';
    this.power.textContent = `Power ${Math.round(p * 100)}% · ${label}`;
  }

  showResults(placings: Player[], onAgain: () => void): void {
    this.results.innerHTML = `<div>
      <h2>${placings[0].name} wins!</h2>
      <ol>${placings.map((p) => `<li><span style="color:${hex(p.color)}">●</span> ${p.name}</li>`).join('')}</ol>
      <button type="button">Race again</button>
    </div>`;
    (this.results.querySelector('button') as HTMLButtonElement).onclick = () => {
      this.results.hidden = true;
      onAgain();
    };
    this.results.hidden = false;
  }
}
