/**
 * Decorative seed-pod ornaments, keyed by plant slug. Ported from
 * v2/lib/data/pod-ornaments.ts: each art key has two own-work files in
 * public/ornaments/ (motif + bundle). Decorative only (alt="", aria-hidden).
 * Plants without an entry show no pod art.
 */

export type PodArt = { motif: string; bundle: string };

const ART_KEY_BY_PLANT: Record<string, string> = {
  "breadseed-poppy": "poppy",
  nigella: "nigella",
  "pincushion-flower": "scabiosa",
  echinacea: "echinacea",
  "sweet-pea": "sweet-pea",
  larkspur: "larkspur",
  strawflower: "strawflower",
  zinnia: "zinnia",
  sunflower: "sunflower",
  cosmos: "cosmos",
  marigold: "marigold",
  calendula: "calendula",
  cornflower: "bachelor-button",
  celosia: "celosia",
};

export const POD_ART_BY_PLANT: Record<string, PodArt> = Object.fromEntries(
  Object.entries(ART_KEY_BY_PLANT).map(([slug, key]) => [slug, { motif: `/ornaments/motif-${key}.webp`, bundle: `/ornaments/bundle-${key}.webp` }]),
);

/** The pod art for a plant slug, or undefined when the plant has none. */
export function podArtForPlant(slug: string | null | undefined): PodArt | undefined {
  return slug && Object.hasOwn(POD_ART_BY_PLANT, slug) ? POD_ART_BY_PLANT[slug] : undefined;
}

/**
 * The directory's generic seed-pod device: the ripe breadseed-poppy pod
 * mark's derived web file, served through lib/images like the other pod
 * motifs. The frame holds this — decorative, on paper-deep — where a
 * variety has no plate of its own, its crop has no plate, and its crop has
 * no pod device.
 */
export const GENERIC_POD_MOTIF = "/ornaments/motif-poppy.webp";
