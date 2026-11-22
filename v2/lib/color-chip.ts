/**
 * The variety color chip: the ONE place that decides what a variety's color mark shows.
 *
 * A sourced swatch is a single tone, but a filed family is the curated fact — so the chip
 * renders the swatch only when it agrees with the family (nearest family representative by
 * Delta E CIEDE2000), and otherwise falls back to the filed family's representative. Mixed
 * varieties always render the shared conic gradient; unfiled varieties render no chip. The
 * Hue filter, the variety page, and the OG card all draw from this module, so the three can
 * never drift apart. Suppression is a rendering rule only: stored data is never altered.
 */
import { COLOR_FAMILY_SWATCHES, type ColorFamily } from "@/lib/validators";

/** The Mixed gradient stops, in order: the pink/orange/yellow/green/blue/purple representatives, closed back to pink. */
const MIX_STOPS = ["pink", "orange", "yellow", "green", "blue", "purple", "pink"] as const;

/**
 * The Mixed conic gradient — the single definition shared by the Hue filter chip, the
 * variety page chip, and the OG card. There is no single hex for a mix.
 */
export const MIX_GRADIENT = `conic-gradient(${MIX_STOPS.map((f) => COLOR_FAMILY_SWATCHES[f]).join(", ")})`;

/** What a variety's color chip shows: the gradient, nothing, or one flat hex. */
export type ColorChip = { kind: "gradient" } | { kind: "none" } | { kind: "hex"; hex: string };

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Resolve a variety's chip from its filed family and sourced swatch, in policy order:
 * mix → gradient; unknown → no chip; a swatch that measures nearest to another family →
 * the filed family's representative; otherwise the swatch as-is, or the representative
 * when there is no swatch. A family outside the vocabulary (legacy data) cannot be
 * judged, so its swatch renders as-is and its absence renders no chip.
 */
export function resolveColorChip(v: { colorFamily: string | null | undefined; colorSwatch: string | null | undefined }): ColorChip {
  const family = v.colorFamily || "unknown";
  if (family === "mix") return { kind: "gradient" };
  const swatch = typeof v.colorSwatch === "string" && HEX.test(v.colorSwatch) ? v.colorSwatch : null;
  if (family === "unknown") return { kind: "none" };
  const representative: string | null | undefined = (COLOR_FAMILY_SWATCHES as Record<string, string | null>)[family];
  if (!representative) return swatch ? { kind: "hex", hex: swatch } : { kind: "none" };
  if (!swatch) return { kind: "hex", hex: representative };
  return nearestColorFamily(swatch) === family ? { kind: "hex", hex: swatch } : { kind: "hex", hex: representative };
}

/** The CSS background value for a resolved chip (the OG card's circle background): null draws the card's neutral ground. */
export function chipBackground(chip: ColorChip): string | null {
  return chip.kind === "gradient" ? MIX_GRADIENT : chip.kind === "hex" ? chip.hex : null;
}

/** A CIELAB color (D65 illuminant). */
export interface Lab {
  l: number;
  a: number;
  b: number;
}

/** sRGB hex → CIELAB (D65), via linear light and the CIE XYZ working space. */
export function hexToLab(hex: string): Lab {
  const lin = (i: number) => {
    const x = parseInt(hex.slice(i, i + 2), 16) / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const r = lin(1);
  const g = lin(3);
  const b = lin(5);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / 1.0;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > Math.pow(6 / 29, 3) ? Math.cbrt(t) : t / (3 * Math.pow(6 / 29, 2)) + 4 / 29);
  return { l: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}

/**
 * Delta E CIEDE2000 (Sharma et al., kL = kC = kH = 1): the perceptual distance between
 * two CIELAB colors. Symmetric; zero for identical colors.
 */
export function deltaE2000(c1: Lab, c2: Lab): number {
  const avgLp = (c1.l + c2.l) / 2;
  const avgC = (Math.hypot(c1.a, c1.b) + Math.hypot(c2.a, c2.b)) / 2;
  const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  const a1p = (1 + g) * c1.a;
  const a2p = (1 + g) * c2.a;
  const c1p = Math.hypot(a1p, c1.b);
  const c2p = Math.hypot(a2p, c2.b);
  const avgCp = (c1p + c2p) / 2;
  const atan = (y: number, x: number) => {
    const h = Math.atan2(y, x);
    return h >= 0 ? h : h + 2 * Math.PI;
  };
  const h1p = atan(c1.b, a1p);
  const h2p = atan(c2.b, a2p);
  const dHp =
    c1p * c2p === 0
      ? 0
      : Math.abs(h1p - h2p) <= Math.PI
        ? h2p - h1p
        : h2p <= h1p
          ? h2p - h1p + 2 * Math.PI
          : h2p - h1p - 2 * Math.PI;
  const dLp = c2.l - c1.l;
  const dCp = c2p - c1p;
  const dHpTerm = 2 * Math.sqrt(c1p * c2p) * Math.sin(dHp / 2);
  const avgHp =
    c1p * c2p === 0 ? h1p + h2p : Math.abs(h1p - h2p) > Math.PI ? (h1p + h2p + 2 * Math.PI) / 2 : (h1p + h2p) / 2;
  const t =
    1 -
    0.17 * Math.cos(avgHp - Math.PI / 6) +
    0.24 * Math.cos(2 * avgHp) +
    0.32 * Math.cos(3 * avgHp + Math.PI / 30) -
    0.2 * Math.cos(4 * avgHp - (63 * Math.PI) / 180);
  const dRo = 30 * Math.exp(-Math.pow(((avgHp * 180) / Math.PI - 275) / 25, 2));
  const rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const sl = 1 + (0.015 * Math.pow(avgLp - 50, 2)) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const sc = 1 + 0.045 * avgCp;
  const sh = 1 + 0.015 * avgCp * t;
  const rt = -Math.sin((2 * dRo * Math.PI) / 180) * rc;
  return Math.sqrt(Math.pow(dLp / sl, 2) + Math.pow(dCp / sc, 2) + Math.pow(dHpTerm / sh, 2) + rt * (dCp / sc) * (dHpTerm / sh));
}

/** Every family representative except mix (which has none), converted to CIELAB once. */
const FAMILY_LAB: { family: ColorFamily; lab: Lab }[] = (Object.entries(COLOR_FAMILY_SWATCHES) as [ColorFamily, string | null][])
  .filter((entry): entry is [ColorFamily, string] => entry[1] !== null)
  .map(([family, hex]) => ({ family, lab: hexToLab(hex) }));

/**
 * The family whose representative measures nearest to the hex (Delta E CIEDE2000). Ties
 * resolve to the earliest family in COLOR_FAMILY_SWATCHES order, so the answer is
 * deterministic. There is no distance cap: within-family depth varies legitimately.
 */
export function nearestColorFamily(hex: string): ColorFamily {
  const lab = hexToLab(hex);
  let best = FAMILY_LAB[0]!;
  let bestD = Infinity;
  for (const candidate of FAMILY_LAB) {
    const d = deltaE2000(lab, candidate.lab);
    if (d < bestD) {
      bestD = d;
      best = candidate;
    }
  }
  return best.family;
}
