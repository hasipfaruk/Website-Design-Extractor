import { parse, formatHex, formatHex8, formatRgb, converter, wcagContrast, type Color } from 'culori';

const toHsl = converter('hsl');
const toOklch = converter('oklch');

export interface ParsedColor {
  color: Color;
  hex: string;
  rgb: string;
  hsl: string;
  oklch: string;
  alpha: number;
  h: number;
  s: number;
  l: number;
}

const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

/**
 * Parse any CSS color string (hex, rgb(), hsl(), oklch(), named, ...).
 * Returns null for values that are not colors, which is how CSS custom
 * properties get filtered - `--spacing: 8px` parses to nothing.
 */
export function parseColor(input: string): ParsedColor | null {
  if (!input) return null;
  const raw = input.trim();
  // `var(--x)` and `currentColor` cannot be resolved out of context.
  if (!raw || raw.startsWith('var(') || /^(currentcolor|inherit|initial|unset|none|transparent)$/i.test(raw)) return null;

  let c: Color | undefined;
  try {
    c = parse(raw);
  } catch {
    return null;
  }
  if (!c) return null;

  const alpha = c.alpha === undefined ? 1 : c.alpha;
  const hsl = toHsl(c);
  const ok = toOklch(c);
  if (!hsl || !ok) return null;

  const h = round(hsl.h ?? 0, 1);
  const s = round(hsl.s ?? 0, 4);
  const l = round(hsl.l ?? 0, 4);

  return {
    color: c,
    hex: (alpha < 1 ? formatHex8(c) : formatHex(c)) ?? '#000000',
    rgb: formatRgb(c) ?? 'rgb(0, 0, 0)',
    hsl: `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%${alpha < 1 ? ` / ${round(alpha, 2)}` : ''})`,
    oklch: `oklch(${round((ok.l ?? 0) * 100, 1)}% ${round(ok.c ?? 0, 3)} ${Math.round(ok.h ?? 0)}${alpha < 1 ? ` / ${round(alpha, 2)}` : ''})`,
    alpha: round(alpha, 3),
    h,
    s,
    l,
  };
}

const HUE_NAMES: [number, string][] = [
  [15, 'Red'],
  [40, 'Orange'],
  [55, 'Amber'],
  [70, 'Yellow'],
  [100, 'Lime'],
  [140, 'Green'],
  [165, 'Emerald'],
  [185, 'Teal'],
  [200, 'Cyan'],
  [215, 'Sky'],
  [240, 'Blue'],
  [260, 'Indigo'],
  [280, 'Violet'],
  [300, 'Purple'],
  [320, 'Fuchsia'],
  [340, 'Pink'],
  [361, 'Rose'],
];

const GREY_STEPS: [number, string][] = [
  [0.97, 'White'],
  [0.9, 'Off White'],
  [0.75, 'Light Grey'],
  [0.55, 'Silver'],
  [0.4, 'Grey'],
  [0.25, 'Dark Grey'],
  [0.12, 'Charcoal'],
  [0.04, 'Near Black'],
  [-1, 'Black'],
];

/** A short human label for a color, e.g. "Deep Blue" or "Charcoal". */
export function colorName(p: ParsedColor): string {
  const { h, s, l } = p;

  if (s < 0.08) {
    for (const [min, name] of GREY_STEPS) if (l > min) return name;
    return 'Black';
  }
  if (l >= 0.97) return 'Near White';
  if (l <= 0.05) return 'Near Black';

  const hue = HUE_NAMES.find(([max]) => h < max)?.[1] ?? 'Red';

  let prefix = '';
  if (l > 0.88) prefix = 'Pale ';
  else if (l > 0.72) prefix = 'Light ';
  else if (l < 0.18) prefix = 'Very Dark ';
  else if (l < 0.3) prefix = 'Dark ';
  else if (l < 0.45) prefix = 'Deep ';
  else if (s > 0.8) prefix = 'Vivid ';

  if (s < 0.22) prefix = prefix ? `${prefix.trim()} Muted ` : 'Muted ';

  return `${prefix}${hue}`.trim();
}

/** WCAG 2.1 contrast ratio, rounded to 2dp. Returns 1 when either color is unparseable. */
export function contrast(a: string | Color, b: string | Color): number {
  try {
    const r = wcagContrast(a as Color, b as Color);
    return r ? round(r, 2) : 1;
  } catch {
    return 1;
  }
}

/** WCAG pass level for normal-size body text. */
export function wcagRating(ratio: number): string {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

/**
 * Flatten a translucent color onto a backdrop so contrast maths reflects what a
 * reader actually sees. Colors from getComputedStyle are frequently rgba().
 */
export function flatten(fg: ParsedColor, backdrop: ParsedColor): Color {
  if (fg.alpha >= 1) return fg.color;
  const a = fg.alpha;
  const f = converter('rgb')(fg.color);
  const b = converter('rgb')(backdrop.color);
  if (!f || !b) return fg.color;
  return {
    mode: 'rgb',
    r: f.r * a + b.r * (1 - a),
    g: f.g * a + b.g * (1 - a),
    b: f.b * a + b.b * (1 - a),
  };
}

/** True when the color is light enough that dark text sits better on it. */
export function isLight(p: ParsedColor): boolean {
  return contrast(p.color, '#000000') > contrast(p.color, '#ffffff');
}
