/**
 * Decorative seed-pod ornaments, keyed by plant slug. Each art key has two own-work files in
 * public/ornaments/: a 480×480 motif (motif-<key>.webp) and a 1600×400 horizontal scene
 * (bundle-<key>.webp). Ornaments are decorative only (alt="", aria-hidden): no captions, no text.
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
