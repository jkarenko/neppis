// Driver portraits: flat vector faces drawn from a small feature set per driver (src/roster.ts), one style for the
// whole ladder, legible at 32 px in the HUD and 96 px on a card. portrait(spec) returns inline SVG markup; the
// circle behind it is the card's, in the driver's grid colour. A hand-drawn illustration can replace any face later.
//
// Geometry on a 64 grid: the head is centred at (32, 30) and spans x 18..46; the ears sit at (18, 31) and (46, 31)
// with radius 3, so hair that must not cover them ends at y 28 on the sides and stays inside x 18..46.

export interface PortraitSpec {
  /** Skin tone index into SKIN. */
  skin: number;
  hair?: 'short' | 'side' | 'long' | 'bun' | 'ponytail' | 'tousled' | 'spiky' | 'mohawk' | 'wavy' | 'curly';
  hairColor?: string;
  hat?: 'cap' | 'helmet' | 'hood' | 'goggles' | 'headband' | 'hardhat';
  hatColor?: string;
  /** Helmet or headband stripe colour. */
  stripe?: string;
  eyes: 'open' | 'wide' | 'squint' | 'sleepy' | 'happy' | 'glasses' | 'shades' | 'side';
  mouth: 'smile' | 'grin' | 'biggrin' | 'teeth' | 'flat' | 'shout' | 'worried' | 'smirk' | 'none';
  beard?: 'moustache' | 'stubble' | 'goatee' | 'fishstick';
  prop?: 'sweat' | 'flower' | 'plaster-brow' | 'plaster-cheek' | 'shiner' | 'cup';
  /** Shirt colour, the one accent per driver. */
  accent: string;
  /** Thick neck and shoulders. */
  wide?: boolean;
  /** Square jaw. */
  square?: boolean;
  /** A bathrobe instead of a shirt: lapels in a V. */
  robe?: boolean;
  /** Drawn upside down (Callow Rollover). */
  flip?: boolean;
}

const SKIN = ['#f1c9a5', '#e0a87a', '#b97a56', '#6b3f22'];
const INK = '#1d2430';

const HEAD = 'M18 30c0-9 6-16 14-16s14 7 14 16c0 9-6 17-14 17S18 39 18 30z';
const HEAD_SQUARE = 'M18 28c0-8 6-14 14-14s14 6 14 14v11c0 5-6 8-14 8s-14-3-14-8z';

function shoulders(spec: PortraitSpec): string {
  // The neck comes through an oval hole in the shirt: shirt, the oval of skin at the collar, then the neck above it.
  const body = spec.wide
    ? `<path d="M4 64c0-12 8-18 20-19h16c12 1 20 7 20 19z" fill="${spec.accent}"/><ellipse cx="32" cy="46.5" rx="9.5" ry="3.2" fill="var(--skin)"/><path d="M24 40h16v7H24z" fill="var(--skin)"/>`
    : `<path d="M8 64c0-11 7-17 18-18h12c11 1 18 7 18 18z" fill="${spec.accent}"/><ellipse cx="32" cy="47" rx="7.5" ry="3" fill="var(--skin)"/><path d="M26 40h12v7H26z" fill="var(--skin)"/>`;
  const robe = spec.robe ? `<path d="M19 64c2-10 4-15 7-20l6 12 6-12c3 5 5 10 7 20z" fill="#fff" opacity="0.28"/><path d="M26 44l6 12 6-12" fill="none" stroke="${INK}" stroke-width="1.2" opacity="0.35"/>` : '';
  return body + robe;
}

/** The short cap of hair on top of the head; long styles add their length behind the head separately. */
const CAP = 'M17 30c0-11 6-17 15-17s15 6 15 17c-2-6-6-9-15-9s-13 3-15 9z';

const HAIR_TOP: Record<NonNullable<PortraitSpec['hair']>, string> = {
  short: CAP,
  side: 'M17 30c0-10 5-16 13-17 3 0 5 2 6 4-8 0-15 4-19 13z M42 20c2 2 4 5 4 9-1-3-2-5-4-7z',
  long: CAP,
  bun: CAP + ' M26 12a6 6 0 1 1 12 0 6 6 0 0 1-12 0z',
  ponytail: CAP,
  tousled: 'M18 29c-1-6 1-11 4-13-1-3 2-5 4-4 1-3 5-4 7-2 3-2 6-1 7 2 3-1 6 1 5 4 2 2 4 7 1 13-3-6-7-9-14-9s-13 3-14 9z',
  spiky: 'M18 30c-1-5 0-9 3-11l-3-6 6 3 2-6 4 4 4-5 4 5 4-4 2 6 2-3-3 6c3 2 4 6 3 11c-3-6-7-9-14-9s-11 3-14 9z',
  mohawk: 'M28 17c0-9 2-13 4-13s4 4 4 13c-1-1-3-2-4-2s-3 1-4 2z',
  // Parted in the middle: two domes that dip at the parting, cascading waves down either side past the jaw; the
  // forehead stays bare.
  wavy: 'M32 16C30 9 21 8 18 18Q16 24 17 27Q14 31 16 35Q13 40 15 44Q13 49 15 53Q16 56 20 55Q21 50 21 46Q20 42 21 38Q20 34 21 30Q22 25 26 20Q29 17 32 16Z M32 16C34 9 43 8 46 18Q48 24 47 27Q50 31 48 35Q51 40 49 44Q51 49 49 53Q48 56 44 55Q43 50 43 46Q44 42 43 38Q44 34 43 30Q42 25 38 20Q35 17 32 16Z',
  curly: 'M17 31c-3-4-3-9 0-12-1-5 3-9 7-8 1-4 6-5 8-2 3-3 8-1 8 3 4 0 7 4 5 8 3 3 3 8 0 11-3-6-7-9-14-9s-11 3-14 9z',
};

/** Hair that hangs behind the head, drawn before the head. */
const HAIR_BEHIND: Partial<Record<NonNullable<PortraitSpec['hair']>, string>> = {
  long: 'M17 28h30v16c0 2-2 4-4 4H21c-2 0-4-2-4-4z',
  ponytail: 'M44 24c5 2 8 8 7 20-2 0-4-1-5-3 1-7-1-12-4-15z',
};

function hat(spec: PortraitSpec): string {
  const c = spec.hatColor ?? INK;
  switch (spec.hat) {
    case 'cap':
      // Crown over the hair, band and peak just above the brows; nothing reaches the eyes (y 29) or the ears.
      return `<path d="M17 25c0-10 6-16 15-16s15 6 15 16H17z" fill="${c}"/><path d="M14 25h36c0 1.5-1 2.5-2.5 2.5h-31C15 27.5 14 26.5 14 25z" fill="${c}"/><path d="M14 25h36c0 1.5-1 2.5-2.5 2.5h-31C15 27.5 14 26.5 14 25z" fill="${INK}" opacity="0.25"/>`;
    case 'helmet': {
      const stripe = spec.stripe ? `<path d="M29 12h6v14h-6z" fill="${spec.stripe}"/>` : '';
      return `<path d="M15 32c0-13 7-21 17-21s17 8 17 21v10c0 2-1 3-3 3h-3V32c0-5-4-7-11-7s-11 2-11 7v13h-3c-2 0-3-1-3-3z" fill="${c}"/>${stripe}<path d="M21 45V32c0-5 4-7 11-7s11 2 11 7v13" fill="none" stroke="${INK}" stroke-width="2" opacity="0.45"/><path d="M14 24c5-3 12-4 18-4s13 1 18 4c-5-1-12-2-18-2s-13 1-18 2z" fill="${INK}" opacity="0.35"/>`;
    }
    case 'hood':
      return `<path d="M14 64c0-8 1-14 4-18-2-4-3-9-3-14 0-12 8-20 17-20s17 8 17 20c0 5-1 10-3 14 3 4 4 10 4 18z" fill="${c}"/><path d="M22 30c0-7 4-12 10-12s10 5 10 12c0 8-4 15-10 15s-10-7-10-15z" fill="${INK}" opacity="0.7"/><circle cx="26" cy="30" r="2" fill="#fff"/><circle cx="38" cy="30" r="2" fill="#fff"/>`;
    case 'goggles':
      // Over the eyes: big pupils behind translucent lenses, so the glass seems to magnify.
      return `<circle cx="26" cy="29" r="3.4" fill="${INK}"/><circle cx="38" cy="29" r="3.4" fill="${INK}"/><path d="M15 27h3v4h-3zM30 27h4v4h-4zM46 27h3v4h-3z" fill="${INK}"/><rect x="18" y="22" width="12" height="14" rx="4" fill="#8ecae6" opacity="0.45" stroke="${INK}" stroke-width="2"/><rect x="34" y="22" width="12" height="14" rx="4" fill="#8ecae6" opacity="0.45" stroke="${INK}" stroke-width="2"/>`;
    case 'hardhat':
      // A construction hard hat: domed shell with a ridge, a brim all round, sitting above the brows.
      return `<path d="M17 24c0-11 6-16 15-16s15 5 15 16z" fill="${c}"/><path d="M29 9h6v14h-6z" fill="${INK}" opacity="0.15"/><path d="M13 24h38c0 2-1.5 3-3.5 3h-31C14.5 27 13 26 13 24z" fill="${c}"/><path d="M13 24h38c0 2-1.5 3-3.5 3h-31C14.5 27 13 26 13 24z" fill="${INK}" opacity="0.2"/>`;
    case 'headband': {
      const stripe = spec.stripe ? `<path d="M17 22c3-2 9-3 15-3s12 1 15 3v2c-3-2-9-3-15-3s-12 1-15 3z" fill="${spec.stripe}"/>` : '';
      return `<path d="M17 24c0-3 7-6 15-6s15 3 15 6v3c-3-3-9-4-15-4s-12 1-15 4z" fill="${c}"/>${stripe}`;
    }
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
    case 'side':
      // Half-lidded, pupils to one side: listening to somebody else talk.
      return `<circle cx="28" cy="30" r="1.9" fill="${INK}"/><circle cx="40" cy="30" r="1.9" fill="${INK}"/><path d="M22 27.5h9M34 27.5h9" stroke="var(--skin)" stroke-width="3"/><path d="M22 27.5c2 0 6 0 8 0M34 27.5c2 0 6 0 8 0" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
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
      // A filled mouth, upper teeth against its top edge, lower teeth at the bottom, then the outline.
      return `<circle cx="32" cy="41" r="5.5" fill="${INK}"/><path d="M27.5 37.2c1-1.2 2.5-1.7 4.5-1.7s3.5.5 4.5 1.7v2.3h-9z" fill="#fff"/><path d="M28.5 45.5c1 .8 2.2 1.2 3.5 1.2s2.5-.4 3.5-1.2v-1.8h-7z" fill="#fff"/><circle cx="32" cy="41" r="5.5" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
    case 'worried':
      return `<path d="M26 41c2-2 4-2 6 0s4 2 6 0" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    case 'smirk':
      return `<path d="M27 40c3 1 6 1 10-1" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    case 'none':
      return '';
  }
}

function beard(spec: PortraitSpec): string {
  const c = spec.hairColor ?? INK;
  switch (spec.beard) {
    case 'moustache':
      return `<path d="M22 36c3-3 7-3 10-1 3-2 7-2 10 1-2 3-6 4-10 2-4 2-8 1-10-2z" fill="${INK}"/>`;
    case 'fishstick':
      // A short thick bar under the nose, in the hair colour.
      return `<rect x="26" y="35" width="12" height="3.6" rx="1.8" fill="${c}"/>`;
    case 'stubble':
      return `<path d="M20 34c2 8 6 12 12 12s10-4 12-12c-2 6-6 9-12 9s-10-3-12-9z" fill="${INK}" opacity="0.3"/>`;
    case 'goatee':
      // A straight, narrow moustache just above the mouth and a long scraggly chin beard, both in the hair colour.
      return `<rect x="27.5" y="37.2" width="9" height="2" rx="0.8" fill="${c}"/><path d="M27 43c1 2 3 3 5 3s4-1 5-3l0 4-1.5 3 .5 3-3-2-1 3-1-3-3 2 .5-3-1.5-3z" fill="${c}"/>`;
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
    case 'shiner':
      // A bruise around the eye, the eye squeezed shut under it.
      return `<ellipse cx="38" cy="29.5" rx="5.6" ry="4.6" fill="#5b3a8a" opacity="0.55"/><path d="M34.5 29.5c1.2 1.4 2.3 2 3.5 2s2.3-.6 3.5-2" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
    case 'cup':
      // A cup held up at chest height, spoon in it, mid-stir.
      return `<path d="M44 56c0-1.5 1-2.5 2.5-2.5h9c1.5 0 2.5 1 2.5 2.5v8H44z" fill="#f4f1ea"/><path d="M58 57a3 3 0 0 1 0 6" fill="none" stroke="#f4f1ea" stroke-width="2"/><path d="M52 54l2.5-5" stroke="#cfd3d6" stroke-width="2" stroke-linecap="round"/>`;
    default:
      return '';
  }
}

/** Inline SVG for a driver's face, sized by CSS. */
export function portrait(spec: PortraitSpec, cls = 'face'): string {
  const skin = SKIN[spec.skin] ?? SKIN[0];
  const hairColor = spec.hairColor ?? INK;
  const head = `<path d="${spec.square ? HEAD_SQUARE : HEAD}" fill="var(--skin)"/><circle cx="18" cy="31" r="3" fill="var(--skin)"/><circle cx="46" cy="31" r="3" fill="var(--skin)"/>`;
  const covered = spec.hat === 'helmet' || spec.hat === 'hood';
  const behind = spec.hair && !covered && HAIR_BEHIND[spec.hair] ? `<path d="${HAIR_BEHIND[spec.hair]}" fill="${hairColor}"/>` : '';
  const top = spec.hair && !covered ? `<path d="${HAIR_TOP[spec.hair]}" fill="${hairColor}"/>` : '';
  const nose = `<path d="M32 30v5" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/>`;
  // Order: hair behind the body, shoulders and neck, head, features, hair on top, hat, props.
  const body = `${behind}${shoulders(spec)}${head}${eyes(spec.eyes)}${nose}${mouth(spec.mouth)}${beard(spec)}${top}${hat(spec)}${prop(spec.prop)}`;
  const transform = spec.flip ? ' transform="rotate(180 32 32)"' : '';
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true" style="--skin:${skin}"><g${transform}>${body}</g></svg>`;
}
