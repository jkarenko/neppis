// Driver portraits: flat vector faces drawn from a small feature set per driver (src/roster.ts), one style for the
// whole ladder, legible at 32 px in the HUD and 96 px on a card. portrait(spec) returns inline SVG markup; the
// circle behind it is the card's, in the driver's grid colour. A hand-drawn illustration can replace any face later.

export interface PortraitSpec {
  /** Skin tone index into SKIN. */
  skin: number;
  hair?: 'short' | 'side' | 'long' | 'bun' | 'ponytail' | 'tousled' | 'spiky' | 'bald';
  hairColor?: string;
  hat?: 'cap' | 'helmet' | 'hood' | 'goggles';
  hatColor?: string;
  /** Helmet stripe colour. */
  stripe?: string;
  eyes: 'open' | 'wide' | 'squint' | 'sleepy' | 'happy' | 'glasses' | 'shades';
  mouth: 'smile' | 'grin' | 'biggrin' | 'teeth' | 'flat' | 'shout' | 'worried' | 'smirk' | 'none';
  beard?: 'moustache' | 'stubble';
  prop?: 'sweat' | 'flower' | 'plaster-brow' | 'plaster-cheek' | 'dent';
  /** Shirt colour, the one accent per driver. */
  accent: string;
  /** Thick neck and shoulders. */
  wide?: boolean;
  /** Square jaw. */
  square?: boolean;
  /** Drawn upside down (Callow Rollover). */
  flip?: boolean;
  /** Not a person: a sand dune with a face (The Dune). */
  dune?: boolean;
}

const SKIN = ['#f1c9a5', '#e0a87a', '#b97a56', '#6b3f22'];
const INK = '#1d2430';

// Face geometry on a 64 grid: the head is centred at (32, 30), the eyes sit on y 29, the mouth on y 40.
const HEAD = 'M18 30c0-9 6-16 14-16s14 7 14 16c0 9-6 17-14 17S18 39 18 30z';
const HEAD_SQUARE = 'M18 28c0-8 6-14 14-14s14 6 14 14v11c0 5-6 8-14 8s-14-3-14-8z';

function shoulders(color: string, wide = false): string {
  return wide
    ? `<path d="M4 64c0-12 8-18 20-19h16c12 1 20 7 20 19z" fill="${color}"/><path d="M24 44h16v6H24z" fill="var(--skin)"/>`
    : `<path d="M8 64c0-11 7-17 18-18h12c11 1 18 7 18 18z" fill="${color}"/><path d="M26 42h12v8H26z" fill="var(--skin)"/>`;
}

const HAIR: Record<NonNullable<PortraitSpec['hair']>, string> = {
  short: 'M17 30c0-11 6-17 15-17s15 6 15 17c-2-6-6-9-15-9s-13 3-15 9z',
  side: 'M17 30c0-10 5-16 13-17 3 0 5 2 6 4-8 0-15 4-19 13z M42 20c2 2 4 5 4 9-1-3-2-5-4-7z',
  long: 'M17 30c0-11 6-17 15-17s15 6 15 17v14c0 2-2 4-4 4l-1-16c-3-4-7-5-10-5s-7 1-10 5l-1 16c-2 0-4-2-4-4z',
  bun: 'M17 30c0-11 6-17 15-17s15 6 15 17c-2-6-6-9-15-9s-13 3-15 9z M26 12a6 6 0 1 1 12 0 6 6 0 0 1-12 0z',
  ponytail: 'M17 30c0-11 6-17 15-17s15 6 15 17c-2-6-6-9-15-9s-13 3-15 9z M44 24c5 2 8 8 7 20-2 0-4-1-5-3 1-7-1-12-4-15z',
  tousled: 'M16 31c-1-6 1-11 4-13-1-3 2-5 4-4 1-3 5-4 8-2 3-2 7-1 8 2 3-1 6 1 5 4 3 2 5 7 4 13-3-6-7-9-14-9s-13 3-15 9z',
  spiky: 'M16 30c-1-5 0-9 3-11l-3-6 6 3 2-6 4 4 4-5 4 5 4-4 2 6 6-3-3 6c3 2 4 6 3 11-3-6-7-9-15-9s-14 3-17 9z',
  bald: 'M20 24c2-6 6-10 12-10s10 4 12 10c-3-3-7-4-12-4s-9 1-12 4z',
};

function hat(spec: PortraitSpec): string {
  const c = spec.hatColor ?? '#1d2430';
  switch (spec.hat) {
    case 'cap':
      return `<path d="M17 28c0-10 6-16 15-16s15 6 15 16H17z" fill="${c}"/><path d="M14 28h36c0 1.5-1 2.5-2.5 2.5h-31C15 30.5 14 29.5 14 28z" fill="${c}"/><path d="M14 28h36c0 1.5-1 2.5-2.5 2.5h-31C15 30.5 14 29.5 14 28z" fill="${INK}" opacity="0.25"/>`;
    case 'helmet': {
      const stripe = spec.stripe ? `<path d="M29 12h6v14h-6z" fill="${spec.stripe}"/>` : '';
      const dent = spec.prop === 'dent' ? `<path d="M40 14c-2 3-1 6 2 7 1-3 0-6-2-7z" fill="${INK}" opacity="0.35"/>` : '';
      // Open-face helmet: shell over the head, the face shows through the opening.
      return `<path d="M15 32c0-13 7-21 17-21s17 8 17 21v10c0 2-1 3-3 3h-3V32c0-5-4-7-11-7s-11 2-11 7v13h-3c-2 0-3-1-3-3z" fill="${c}"/>${stripe}${dent}<path d="M21 45V32c0-5 4-7 11-7s11 2 11 7v13" fill="none" stroke="${INK}" stroke-width="2" opacity="0.45"/><path d="M14 24c5-3 12-4 18-4s13 1 18 4c-5-1-12-2-18-2s-13 1-18 2z" fill="${INK}" opacity="0.35"/>`;
    }
    case 'hood':
      return `<path d="M14 64c0-8 1-14 4-18-2-4-3-9-3-14 0-12 8-20 17-20s17 8 17 20c0 5-1 10-3 14 3 4 4 10 4 18z" fill="${c}"/><path d="M22 30c0-7 4-12 10-12s10 5 10 12c0 8-4 15-10 15s-10-7-10-15z" fill="${INK}" opacity="0.7"/><circle cx="26" cy="30" r="2" fill="#fff"/><circle cx="38" cy="30" r="2" fill="#fff"/>`;
    case 'goggles':
      return `<path d="M17 21h30v6H17z" fill="${INK}"/><rect x="19" y="19" width="11" height="9" rx="3" fill="#8ecae6" stroke="${INK}" stroke-width="2"/><rect x="34" y="19" width="11" height="9" rx="3" fill="#8ecae6" stroke="${INK}" stroke-width="2"/>`;
    default:
      return '';
  }
}

function eyes(kind: PortraitSpec['eyes']): string {
  const open = (r: number) => `<circle cx="26" cy="29" r="${r}" fill="${INK}"/><circle cx="38" cy="29" r="${r}" fill="${INK}"/>`;
  switch (kind) {
    case 'open':
      return open(1.8);
    case 'wide':
      return `<circle cx="26" cy="29" r="3.6" fill="#fff"/><circle cx="38" cy="29" r="3.6" fill="#fff"/>${open(1.8)}`;
    case 'squint':
      return `<path d="M22 29h8M34 29h8" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'sleepy':
      return `<path d="M22 28c1 2 3 3 4 3s3-1 4-3M34 28c1 2 3 3 4 3s3-1 4-3" stroke="${INK}" stroke-width="2" stroke-linecap="round" fill="none"/>`;
    case 'happy':
      return `<path d="M22 30c1-2 3-3 4-3s3 1 4 3M34 30c1-2 3-3 4-3s3 1 4 3" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    case 'glasses':
      return `${open(1.6)}<circle cx="26" cy="29" r="5" fill="none" stroke="${INK}" stroke-width="1.8"/><circle cx="38" cy="29" r="5" fill="none" stroke="${INK}" stroke-width="1.8"/><path d="M31 29h2M17 27l4 1M47 27l-4 1" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
    case 'shades':
      return `<path d="M19 25h26v2c0 4-2 6-6 6s-6-2-7-5c-1 3-3 5-7 5s-6-2-6-6z" fill="${INK}"/>`;
  }
}

function mouth(kind: PortraitSpec['mouth']): string {
  switch (kind) {
    case 'smile':
      return `<path d="M26 39c2 3 4 4 6 4s4-1 6-4" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    case 'grin':
      return `<path d="M25 38c2 4 4 6 7 6s5-2 7-6z" fill="#fff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
    case 'biggrin':
      return `<path d="M22 37c3 6 6 8 10 8s7-2 10-8z" fill="#fff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M26 37h12" stroke="${INK}" stroke-width="1.2"/>`;
    case 'teeth':
      return `<rect x="25" y="37" width="14" height="5" rx="1.5" fill="#fff" stroke="${INK}" stroke-width="1.8"/><path d="M29 37v5M32 37v5M35 37v5" stroke="${INK}" stroke-width="1.2"/>`;
    case 'flat':
      return `<path d="M27 40h10" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'shout':
      return `<ellipse cx="32" cy="41" rx="5" ry="4.5" fill="${INK}"/><path d="M28 39h8" stroke="#fff" stroke-width="1.6"/>`;
    case 'worried':
      return `<path d="M26 41c2-2 4-2 6 0s4 2 6 0" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    case 'smirk':
      return `<path d="M27 40c3 1 6 1 10-1" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    case 'none':
      return '';
  }
}

function beard(kind: PortraitSpec['beard']): string {
  switch (kind) {
    case 'moustache':
      return `<path d="M22 36c3-3 7-3 10-1 3-2 7-2 10 1-2 3-6 4-10 2-4 2-8 1-10-2z" fill="${INK}"/>`;
    case 'stubble':
      return `<path d="M20 34c2 8 6 12 12 12s10-4 12-12c-2 6-6 9-12 9s-10-3-12-9z" fill="${INK}" opacity="0.3"/>`;
    default:
      return '';
  }
}

function prop(kind: PortraitSpec['prop']): string {
  switch (kind) {
    case 'sweat':
      return `<path d="M46 20c2 3 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4 3-7z" fill="#8ecae6"/>`;
    case 'flower':
      return `<g transform="translate(45 20)">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="2.6" ry="4" cy="-3.5" transform="rotate(${a})" fill="#ffb3c6"/>`).join('')}<circle r="2" fill="#ffd60a"/></g>`;
    case 'plaster-brow':
      return `<g transform="translate(40 20) rotate(-25)"><rect x="-6" y="-2.5" width="12" height="5" rx="1.5" fill="#f4dfc8"/><rect x="-2" y="-1.5" width="4" height="3" fill="#dcbfa5"/></g>`;
    case 'plaster-cheek':
      return `<g transform="translate(41 36) rotate(30)"><rect x="-6" y="-2.5" width="12" height="5" rx="1.5" fill="#f4dfc8"/><rect x="-2" y="-1.5" width="4" height="3" fill="#dcbfa5"/></g>`;
    default:
      return '';
  }
}

/** A dune with a face: two squinting eyes and a flat mouth in the sand, no body. */
function dune(spec: PortraitSpec): string {
  return `<path d="M2 62c8-30 20-46 34-46 10 0 18 8 26 22-6-3-11-4-16-2 6 6 10 14 12 26z" fill="${spec.accent}"/><path d="M2 62c8-30 20-46 34-46-6 10-10 24-10 46z" fill="${INK}" opacity="0.12"/><g transform="translate(6 12)">${eyes(spec.eyes)}${mouth(spec.mouth)}</g>`;
}

/** Inline SVG for a driver's face, sized by CSS. */
export function portrait(spec: PortraitSpec, cls = 'face'): string {
  const skin = SKIN[spec.skin] ?? SKIN[0];
  let body: string;
  if (spec.dune) {
    body = dune(spec);
  } else {
    const head = `<path d="${spec.square ? HEAD_SQUARE : HEAD}" fill="var(--skin)"/><circle cx="18" cy="31" r="3" fill="var(--skin)"/><circle cx="46" cy="31" r="3" fill="var(--skin)"/>`;
    const hairPath = spec.hair && spec.hat !== 'helmet' && spec.hat !== 'hood' ? `<path d="${HAIR[spec.hair]}" fill="${spec.hairColor ?? INK}"/>` : '';
    const nose = `<path d="M32 30v5" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/>`;
    // Order: shoulders, hair behind the head (long/ponytail), head, features, hair on top, hat, props.
    const behind = spec.hair === 'long' || spec.hair === 'ponytail' ? hairPath : '';
    const onTop = behind ? '' : hairPath;
    body = `${shoulders(spec.accent, spec.wide)}${behind}${head}${eyes(spec.eyes)}${nose}${mouth(spec.mouth)}${beard(spec.beard)}${onTop}${hat(spec)}${prop(spec.prop)}`;
  }
  const transform = spec.flip ? ' transform="rotate(180 32 32)"' : '';
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true" style="--skin:${skin}"><g${transform}>${body}</g></svg>`;
}
