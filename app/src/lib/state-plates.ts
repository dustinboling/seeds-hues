/**
 * State-flower plates, keyed by state slug — ported verbatim from
 * v2/lib/data/state-plates.ts (same 16 finished portraits, same alt
 * strings — the spec's Ada Accessibility Ruling §A.2, Maine's "state
 * floral emblem" and Minnesota's apostrophe-free "lady slipper" intact).
 * A state absent from this table has no plate — that absence is the
 * single source of truth for whether a seller or state page shows one.
 * Never derive plate existence from STATE_SCENES.
 */

export type StatePlateArt = {
  /** Stored image path; rendered only through lib/images imageUrl(). */
  path: `/artwork/states/${string}.webp`;
  /** The plate's single text alternative. */
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
