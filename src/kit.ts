// The kit page (?kit): every component in every state over the live scene, for the screenshot contact sheet.
// It is the living style guide and the review tool at once, since there is no desktop to look at the game on.
import { ICON_NAMES, icon } from './icons.ts';
import { PLAYER_COLORS } from './config.ts';
import { ROSTER, type Driver } from './roster.ts';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const initials = (d: Driver) => d.name.split(' ').map((w) => w[0]).join('').slice(0, 2);

function statBar(label: string, n: number): string {
  return `<div class="stat-bar"><span>${label}</span>${Array.from({ length: 5 }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</div>`;
}

export function driverCard(d: Driver, color: number, opts: { picked?: boolean; back?: boolean } = {}): string {
  const front = `
    <div class="who"><div class="portrait">${initials(d)}</div><div><div class="name">${d.name}</div><div class="epithet">${d.epithet}</div></div></div>
    ${statBar('Power', d.power)}${statBar('Aim', d.aim)}${statBar('Nerve', d.nerve)}`;
  const back = `
    <div class="who"><div class="portrait">${initials(d)}</div><div><div class="name">${d.name}</div><div class="epithet">${d.epithet}</div></div></div>
    <p class="flavour">${d.flavour}</p>`;
  return `<div class="driver${opts.picked ? ' is-picked' : ''}" style="--c:${hex(color)}"><span class="pick">${icon('check')}</span>${opts.back ? back : front}</div>`;
}

export function renderKit(root: HTMLElement): void {
  const c = PLAYER_COLORS.map(hex);
  const player = (name: string, color: string, stat: string, current = false, ai = false) =>
    `<div class="player${current ? ' current' : ''}" style="--c:${color}"><span class="dot" style="background:${color}"></span><span class="name">${name}${ai ? ' <span class="stat">(AI)</span>' : ''}</span><span class="stat">${stat}</span></div>`;
  const chevrons = (left: number, color: string) =>
    `<div class="chip" style="--c:${color}">${Array.from({ length: 3 }, (_, i) => `<svg viewBox="0 0 18 18" width="18" height="18"${i >= left ? ' class="used"' : ''}><path d="M4 6 L9 12 L14 6" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"${i >= left ? ' opacity="0.35"' : ''}/></svg>`).join('')}<span>Bea Line</span></div>`;

  root.innerHTML = `
    <h2>Colour</h2>
    <div class="swatches">
      ${['--surface', '--surface-strong', '--text', '--muted', '--line', '--danger', '--ok', '--power-0', '--power-1', '--power-2', '--power-3'].map((v) => `<div class="swatch" style="background:var(${v})">${v.slice(2)}</div>`).join('')}
      ${c.map((col, i) => `<div class="swatch" style="background:${col}">car ${i + 1}</div>`).join('')}
    </div>

    <h2>Type</h2>
    <div class="card" style="max-width:420px">
      <h1>Display 28</h1>
      <h2 style="margin-top:0">Title 20</h2>
      <p style="margin:0 0 6px;font-size:var(--fs-control)">Control 16: Start race, Resume, Tap to play.</p>
      <p style="margin:0 0 6px">Body 14: Three flicks per turn. Stay on the track, keep the rubber side down.</p>
      <p class="muted" style="margin:0;font-size:var(--fs-label)">Label 12 · <span class="num">lap 2/3 · 1234</span></p>
    </div>

    <h2>Buttons</h2>
    <div class="strip">
      <button class="btn">Default</button>
      <button class="btn is-pressed">Pressed</button>
      <button class="btn is-disabled">Disabled</button>
      <button class="btn">${icon('gear')} With icon</button>
      <button class="btn btn-icon" aria-label="Pause">${icon('pause')}</button>
      <button class="btn btn-icon" aria-label="Back">${icon('back')}</button>
      <button class="btn btn-danger">Quit race</button>
      <button class="btn btn-primary">Primary 56</button>
      <button class="btn btn-primary is-pressed">Primary pressed</button>
    </div>
    <div class="col" style="margin-top:12px">
      <button class="btn btn-menu">${icon('flag')} Race</button>
      <button class="btn btn-menu is-pressed">${icon('trophy')} Opponents</button>
      <button class="btn btn-menu">${icon('gear')} Settings</button>
    </div>

    <h2>Chips and toasts</h2>
    <div class="strip">
      ${chevrons(3, c[1])}${chevrons(1, c[0])}${chevrons(0, c[2])}
      <span class="chip muted num">Power 70% · brisk</span>
      <span class="chip num" style="color:var(--power-3)">Power 92% · risky</span>
    </div>
    <div class="strip" style="margin-top:12px">
      <span class="toast is-bad">${icon('flip')} Flip! Bea Line goes back to where the flick started.</span>
      <span class="toast is-warn">${icon('tip')} Tipped over. Halfway along the flick.</span>
      <span class="toast is-warn">${icon('offtrack')} Off track. Back to the last point on it.</span>
      <span class="toast is-good">${icon('flag')} Bea Line crosses the line in place 1!</span>
      <span class="toast">${icon('info')} Drag from the car to flick.</span>
    </div>

    <h2>Standings</h2>
    <div class="strip" style="align-items:flex-start">
      <div id="kit-players" class="glass" style="border-radius:var(--r-chip);padding:8px;min-width:190px">
        ${player('You', c[0], 'lap 1/3', false)}${player('Bea Line', c[1], 'lap 2/3', true, true)}${player('The Dune', c[2], 'P1', false, true)}${player('Rufus Turner', c[3], 'lap 1/3', false, true)}${player('Steady Betty', c[4], 'lap 1/3', false, true)}${player('Mash Overstep', c[5], 'lap 1/3', false, true)}
      </div>
      <div class="list card" style="padding:10px;width:300px">
        <div class="row" style="--c:${c[0]}"><span class="dot"></span><span class="name">You</span><span class="stat">human</span></div>
        <div class="row is-current" style="--c:${c[1]}"><span class="dot"></span><span class="name">Bea Line</span><span class="stat">Quarter Mile</span></div>
        <div class="row" style="--c:${c[2]}"><span class="dot"></span><span class="name">A very long player name here</span><span class="stat">human</span></div>
      </div>
    </div>

    <h2>Form controls</h2>
    <div class="card col">
      <input class="field" value="Player name" />
      <select class="field"><option>Human</option><option>AI</option></select>
      <div class="strip"><span>Laps</span><span class="stepper"><button class="btn btn-icon" aria-label="Fewer laps">${icon('minus')}</button><span class="value num">3</span><button class="btn btn-icon" aria-label="More laps">${icon('plus')}</button></span></div>
      <div class="row"><span>${icon('sound-on')}</span><span class="name">Sound</span><button class="switch" role="switch" aria-checked="true" aria-label="Sound"></button></div>
      <div class="row"><span>${icon('hand')}</span><span class="name">Haptics</span><button class="switch" role="switch" aria-checked="false" aria-label="Haptics"></button></div>
    </div>

    <h2>Opponent cards</h2>
    <div class="cards">
      ${driverCard(ROSTER[15], PLAYER_COLORS[1], { picked: true })}
      ${driverCard(ROSTER[20], PLAYER_COLORS[2])}
      ${driverCard(ROSTER[17], PLAYER_COLORS[3], { back: true })}
      ${driverCard(ROSTER[0], PLAYER_COLORS[5], { back: true, picked: true })}
    </div>

    <h2>Icons</h2>
    <div class="icons">${ICON_NAMES.map((n) => `<span class="chip">${icon(n)}${n}</span>`).join('')}</div>

    <h2>Card</h2>
    <div class="card" style="max-width:360px">
      <h2 style="margin-top:0">Paused</h2>
      <div class="col">
        <button class="btn btn-primary btn-block">Resume</button>
        <button class="btn btn-block">${icon('gear')} Settings</button>
        <button class="btn btn-block">${icon('info')} Rules</button>
        <button class="btn btn-block btn-danger">Quit to menu</button>
      </div>
    </div>
    <div style="height:40px"></div>`;
  root.hidden = false;
}
