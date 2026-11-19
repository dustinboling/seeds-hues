/**
 * State-flower plates, keyed by state slug (lib/data/states.ts) — the same pattern as
 * STATE_SCENES (lib/data/state-scenes.ts), but a different asset with its own coverage: the 16
 * finished 1600×1600 flower portraits (masters in artwork-states/, stored paths
 * /artwork/states/{slug}.webp, served through lib/images). A state absent from this table has no
 * plate — that absence is the single source of truth for whether a seller or state page shows one
 * (state-plates placement spec §1.2, 2026-11-19). Never derive plate existence from STATE_SCENES.
 *
 * Alt strings are copied VERBATIM from the spec's Ada Accessibility Ruling §A.2 (which supersedes
 * the §5 draft): informative, never generated, never the filename, never empty. Maine reads "state
 * floral emblem" (1 M.R.S. §211 names no state flower); Minnesota's "lady slipper" has no
 * apostrophe (the MANIFEST's common name, reproduced as-is).
 */

export type StatePlateArt = {
  /** Stored image path; rendered only through lib/images imageUrl(). */
  path: `/artwork/states/${string}.webp`;
  /** The plate's single text alternative (spec §A.2). */
  alt: string;
};

export const STATE_PLATES: Readonly<Record<string, StatePlateArt>> = {
  california: { path: "/artwork/states/california.webp", alt: "Golden poppy, California's state flower" },
  colorado: { path: "/artwork/states/colorado.webp", alt: "White and lavender columbine, Colorado's state flower" },
  connecticut: { path: "/artwork/states/connecticut.webp", alt: "Mountain laurel, Connecticut's state flower" },
  georgia: { path: "/artwork/states/georgia.webp", alt: "Cherokee rose, Georgia's state flower" },
  iowa: { path: "/artwork/states/iowa.webp", alt: "Wild rose, Iowa's state flower" },
  maine: { path: "/artwork/states/maine.webp", alt: "White pine cone and tassel, Maine's state floral emblem" },
  minnesota: { path: "/artwork/states/minnesota.webp", alt: "Pink and white lady slipper, Minnesota's state flower" },
  montana: { path: "/artwork/states/montana.webp", alt: "Bitterroot, Montana's state flower" },
  nevada: { path: "/artwork/states/nevada.webp", alt: "Sagebrush, Nevada's state flower" },
  "new-york": { path: "/artwork/states/new-york.webp", alt: "Rose, New York's state flower" },
  oregon: { path: "/artwork/states/oregon.webp", alt: "Oregon grape, Oregon's state flower" },
  utah: { path: "/artwork/states/utah.webp", alt: "Sego lily, Utah's state flower" },
  vermont: { path: "/artwork/states/vermont.webp", alt: "Red clover, Vermont's state flower" },
  virginia: { path: "/artwork/states/virginia.webp", alt: "American dogwood, Virginia's state flower" },
  washington: { path: "/artwork/states/washington.webp", alt: "Coast rhododendron, Washington's state flower" },
  wisconsin: { path: "/artwork/states/wisconsin.webp", alt: "Wood violet, Wisconsin's state flower" },
};

/** The plate for a state slug, or null when that state has none (own keys only). */
export function statePlateFor(slug: string | null | undefined): StatePlateArt | null {
  return slug && Object.hasOwn(STATE_PLATES, slug) ? STATE_PLATES[slug]! : null;
}
