/**
 * "Small farm" badge + "Small farms" filter (Open Directory, 2026-11-19) — the ONE home of every
 * user-visible string and the one URL-param parser, so badge, filters, count lines and legends
 * can never drift apart (ux-spec §5/§6: one shared constant per string).
 *
 * Strings marked DECK are verbatim from open-directory/copy-deck.md. Strings marked SLOT fill a
 * Nadia ux-spec §6 slot the deck does not supply a sentence for; they are written to that slot's
 * constraints and flagged for Wren/Quinn at the build gate.
 */
import { plural } from "@/lib/format";
import type { PublicListing } from "@/lib/validators";

/** DECK "Badge label". Sentence case, exactly this — never uppercased. */
export const SMALL_FARM_BADGE_LABEL = "Small farm";

/** DECK "Filter label" — the count-line label (ux COUNT-LABEL) joined by activeFilterLabels(). */
export const SMALL_FARM_FILTER_LABEL = "Small farms";

/** ux FILTER-CHIP — the on-chip on /variety and on variety pages ("…only" states the narrowing). */
export const SMALL_FARM_CHIP_LABEL = "Small farms only";

/** DECK "Badge legend" — one sentence, verbatim at every legend placement (ux-spec §5). */
export const SMALL_FARM_LEGEND =
  "The Small farm badge marks a seller we judge to be a small family farm — it's our call, so you can spot them and choose to buy from them.";

/** SLOT EMPTY-BROWSE (ux §3.5): /variety, small-farm filter on, zero results. */
export const SMALL_FARM_EMPTY_BROWSE = "No varieties sold by small farms match these filters.";

/** ux §3.5 generic empty state (small-farm filter off, other filters emptied the list). */
export const EMPTY_BROWSE = "No varieties match.";

/**
 * SLOT EMPTY-CROP-BROWSE (ux §3.5, Tranche 3.1b B-12): home "Browse by crop" and the /crop
 * index, filters emptied the list. The crop parallel of EMPTY_BROWSE — same slot, same
 * constraints, "Clear filters" beside it when filters are active.
 */
export const EMPTY_CROP_BROWSE = "No crops match.";

/** SLOT EMPTY-VARIETY (ux §4.3): variety page, ?small_farm=true, no badged seller lists it. */
export function smallFarmEmptyVariety(varietyName: string): string {
  return `No seller with the Small farm badge lists ${varietyName} yet.`;
}

/** URL param, shared by /variety and /variety/{slug} (ux §3.2 / §4.2). */
export const SMALL_FARM_PARAM = "small_farm";

/**
 * Internal path segment of the narrowed variety page. The public URL is always
 * /variety/{slug}?small_farm=true; middleware rewrites it to /variety/{slug}/small-farms so the
 * narrowed view is its own ISR route with its own cache entry (see app/variety/[slug]/variety-view).
 */
export const SMALL_FARM_VARIANT_SEGMENT = "small-farms";

export function smallFarmVariantPath(varietySlug: string): string {
  return `/variety/${varietySlug}/${SMALL_FARM_VARIANT_SEGMENT}`;
}

/**
 * Public href of a variety page's seller-filter state (ux §4.2): the all-sellers view is the
 * bare route; the narrowed view keeps the site's one filter vocabulary (`?small_farm=true`).
 * Shared by the server-rendered chips AND the hydrated in-place toggle's History API update,
 * so the two can never disagree on the shareable URL.
 */
export function varietyFilterHref(varietySlug: string, smallFarmOnly: boolean): string {
  return smallFarmOnly ? `/variety/${varietySlug}?${SMALL_FARM_PARAM}=true` : `/variety/${varietySlug}`;
}

/**
 * Forgiving page-level parse (ux §3.2): exactly "true" is on; anything else — absent, "false",
 * garbage, a repeated param — is off. The JSON API keeps its strict boolParam() instead.
 */
export function parseSmallFarmParam(raw: string | string[] | undefined): boolean {
  return raw === "true";
}

/**
 * Client-side mirror of the middleware's forgiving parse (ux §3.2): reads the filter state back
 * from a live `location.search` string (a leading "?" is tolerated). Exactly one
 * `small_farm=true` is on; anything else — absent, "false", garbage, repeated — is off. The
 * hydrated toggle's popstate handler re-syncs through this, so Back/Forward apply the same rule
 * as first load.
 */
export function smallFarmOnlyFromSearch(search: string): boolean {
  const values = new URLSearchParams(search).getAll(SMALL_FARM_PARAM);
  return parseSmallFarmParam(values.length === 1 ? values[0] : values);
}

/**
 * Variety-page count line (ux §4.4, slot COUNT-VARIETY): "{N} listings." when off;
 * "{B} of {N} listings · Small farms only." when on (the "of N" is required — a bare count after
 * narrowing would read as the variety's whole market).
 */
export function varietyListingCountLine(total: number, shown: number, smallFarmOnly: boolean): string {
  if (!smallFarmOnly) return `${plural(total, "listing")}.`;
  return `${shown} of ${plural(total, "listing")} · ${SMALL_FARM_CHIP_LABEL}.`;
}

/**
 * The narrowing rules of ux-spec §4.3 as data: N published listings, B of them from badged
 * sellers; the control renders only for mixed pages (0 < B < N); narrowing filters, never re-sorts.
 */
export function sellerFilterView(listings: PublicListing[], smallFarmOnly: boolean) {
  const total = listings.length;
  const badged = listings.filter((l) => l.seller.isSmallFarm);
  return {
    total,
    badged: badged.length,
    showControl: badged.length > 0 && badged.length < total,
    showLegend: badged.length > 0,
    shown: smallFarmOnly ? badged : listings,
    countLine: varietyListingCountLine(total, badged.length, smallFarmOnly),
  };
}
