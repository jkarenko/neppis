import type { Game, MessageKind } from './game.ts';
import { DRIVER_BY_ID } from './roster.ts';
import { portrait } from './portraits.ts';
import { icon, type IconName } from './icons.ts';

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

const TOAST_ICON: Record<MessageKind, IconName> = { flip: 'flip', tip: 'tip', offtrack: 'offtrack', finish: 'flag', info: 'info' };
const TOAST_CLASS: Record<MessageKind, string> = { flip: 'is-bad', tip: 'is-warn', offtrack: 'is-warn', finish: 'is-good', info: '' };

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

    // Whose turn and flicks left, top centre: the chevrons in the car's colour, the name beside them (colour alone
    // fails red/green players), and on an AI turn the driver's face.
    if (!current) {
      this.turn.hidden = true;
      return;
    }
    const chevron = (used: boolean) => `<svg viewBox="0 0 18 18"${used ? ' class="used"' : ''}><path d="M4 6 L9 12 L14 6"/></svg>`;
    const driver = current.driverId ? DRIVER_BY_ID[current.driverId] : undefined;
    this.turn.style.setProperty('--c', hex(current.color));
    this.turn.innerHTML =
      (driver ? `<span class="portrait is-small">${portrait(driver.portrait)}</span>` : '') +
      Array.from({ length: game.rules.flicksPerTurn }, (_, i) => chevron(i >= game.flicksLeft)).join('') +
      `<span class="name">${current.name}</span>`;
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

  /** One toast under the turn chip: an icon for the kind, then the sentence. The newest replaces the previous. */
  say(text: string, kind: MessageKind = 'info', ms = 2600): void {
    this.message.className = `toast ${TOAST_CLASS[kind]}`;
    this.message.innerHTML = `${icon(TOAST_ICON[kind])}<span></span>`;
    this.message.lastElementChild!.textContent = text;
    this.message.classList.add('show');
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => this.message.classList.remove('show'), ms);
  }
}
