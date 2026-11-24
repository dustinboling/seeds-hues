/**
 * WCAG 2.x relative-luminance contrast math. Dependency-free so the contrast
 * table generator, the tests, and any future gate check share one implementation.
 * Only #rrggbb inputs are accepted — every color in a contrast pair is a hex in
 * the token files, and anything else fails loudly instead of guessing.
 */
export class ColorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ColorError";
  }
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHexColor(hex: string): Rgb {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match?.[1]) throw new ColorError(`Not a #rrggbb color: "${hex}".`);
  const digits = match[1];
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
}

export function toHexColor({ r, g, b }: Rgb): string {
  const byte = (n: number): string => Math.round(n).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(color: Rgb): number {
  return 0.2126 * linearize(color.r) + 0.7152 * linearize(color.g) + 0.0722 * linearize(color.b);
}

/** WCAG contrast ratio of two #rrggbb colors, 1 to 21. Order-independent. */
export function contrastRatio(aHex: string, bHex: string): number {
  const la = relativeLuminance(parseHexColor(aHex));
  const lb = relativeLuminance(parseHexColor(bHex));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Alpha-composite an opaque foreground hex over an opaque background hex.
 * `alpha` 0 keeps the background, 1 keeps the foreground. Used for the
 * translucent tab-bar wash and the paper-grain worst case.
 */
export function mixOver(fgHex: string, bgHex: string, alpha: number): string {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1)
    throw new ColorError(`Alpha must be in [0, 1], got ${String(alpha)}.`);
  const fg = parseHexColor(fgHex);
  const bg = parseHexColor(bgHex);
  return toHexColor({
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  });
}
