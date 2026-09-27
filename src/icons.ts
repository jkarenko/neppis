// Inline SVG icons on a 24 grid, 2.5 stroke, currentColor, so they inherit the driver colour through --c.
// icon('pause') returns markup for innerHTML; every icon is aria-hidden, the control it sits in carries the label.
const PATHS: Record<string, string> = {
  chevron: 'M6 9l6 6 6-6',
  back: 'M15 5l-7 7 7 7',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 4l13 8-13 8z',
  // A cog: eight teeth on a ring, hub in the middle.
  gear: 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM10.3 3.5h3.4l.5 2.3 1.9 1.1 2.2-.8 1.7 3-1.7 1.5v2.2l1.7 1.5-1.7 3-2.2-.8-1.9 1.1-.5 2.3h-3.4l-.5-2.3-1.9-1.1-2.2.8-1.7-3 1.7-1.5v-2.2L4 9.1l1.7-3 2.2.8 1.9-1.1z',
  'sound-on': 'M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  'sound-off': 'M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12l4.5 4.5L19 7',
  flag: 'M6 21V4h11l-2 4 2 4H6',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6',
  // A car on its roof: the wide side (with the wheels) up, the narrow roof down on the ground line.
  flip: 'M4 10h16l-3 5H7zM4 10l1.5-2.5h13L20 10M7.5 7.5v-2M16.5 7.5v-2M4 17h16',
  // A car on its side: the wide side (with the wheels) faces left, the roof faces right.
  tip: 'M7 4v16l7-3V7zM7 4l2.5-1.5 6.5 3M7 20l2.5 1.5 6.5-3M9.5 4.5v2M9.5 17.5v2M17 20h3',
  // A road, two edge lines, with a question mark between them.
  offtrack: 'M6 3v18M18 3v18M10.5 9.5a1.5 1.5 0 1 1 3 0c0 1-1.5 1.3-1.5 3M12 16h0',
  info: 'M12 8h0M12 11v6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  hand: 'M9 12V5a1.5 1.5 0 0 1 3 0v6l1-1a1.5 1.5 0 0 1 2.5 1l1-.5a1.5 1.5 0 0 1 2 1.5v4c0 3-2 5-5 5h-2c-1.5 0-3-1-4-2.5L5 15a1.5 1.5 0 0 1 2.5-2z',
};

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function icon(name: IconName, cls = ''): string {
  const d = PATHS[name];
  if (!d) throw new Error(`no icon ${name}`);
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
}
