import type { Game } from './game.ts';

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export class Hud {
  private readonly players = document.getElementById('players')!;
  private readonly turn = document.getElementById('turn')!;
  private readonly finger = document.getElementById('finger')!;
  private readonly message = document.getElementById('message')!;
  private messageTimer = 0;

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
