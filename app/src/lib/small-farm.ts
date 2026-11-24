/**
 * "Small farm" badge + "Small farms" filter — the ONE home of every
 * user-visible string and the one URL-param parser. Ported from
 * v2/lib/small-farm.ts (same strings, same rules).
 */
import { plural } from "./format";
import type { ApiPublicListing } from "../data/types";

/** DECK "Badge label". Sentence case, exactly this — never uppercased. */
export const SMALL_FARM_BADGE_LABEL = "Small farm";

/** DECK "Filter label" — the count-line label joined by activeFilterLabels(). */
export const SMALL_FARM_FILTER_LABEL = "Small farms";

/** The on-chip label ("…only" states the narrowing). */
export const SMALL_FARM_CHIP_LABEL = "Small farms only";

/** DECK "Badge legend" — one sentence, verbatim at every legend placement. */
export const SMALL_FARM_LEGEND =
  "The Small farm badge marks a seller we judge to be a small family farm — it's our call, so you can spot them and choose to buy from them.";

/** /variety, small-farm filter on, zero results. */
export const SMALL_FARM_EMPTY_BROWSE = "No varieties sold by small farms match these filters.";

/** Small-farm filter off, other filters emptied the list. */
export const EMPTY_BROWSE = "No varieties match.";

/** Home "Browse by crop" and the /crop index, filters emptied the list. */
export const EMPTY_CROP_BROWSE = "No crops match.";

/** Variety page, ?small_farm=true, no badged seller lists it. */
export function smallFarmEmptyVariety(varietyName: string): string {
  return `No seller with the Small farm badge lists ${varietyName} yet.`;
}

/** URL param, shared by /variety and /variety/{slug}. */
export const SMALL_FARM_PARAM = "small_farm";

/**
 * Internal path segment of the narrowed variety page. The public URL is
 * always /variety/{slug}?small_farm=true; the internal path 301s to it, so
 * the narrowed view is never a second public address.
 */
export const SMALL_FARM_VARIANT_SEGMENT = "small-farms";

export function smallFarmVariantPath(varietySlug: string): string {
  return `/variety/${varietySlug}/${SMALL_FARM_VARIANT_SEGMENT}`;
}

/**
 * Public href of a variety page's seller-filter state: the all-sellers view
 * is the bare route; the narrowed view keeps the site's one filter
 * vocabulary (`?small_farm=true`).
 */
export function varietyFilterHref(varietySlug: string, smallFarmOnly: boolean): string {
  return smallFarmOnly ? `/variety/${varietySlug}?${SMALL_FARM_PARAM}=true` : `/variety/${varietySlug}`;
}

/**
 * Forgiving page-level parse: exactly "true" is on; anything else — absent,
 * "false", garbage, a repeated param — is off. Deliberate; do not tighten.
 */
export function parseSmallFarmParam(raw: string | string[] | undefined): boolean {
  return raw === "true";
}

/**
 * Client-side mirror of the forgiving parse: reads the filter state back
 * from a live `location.search` string (a leading "?" is tolerated).
 * Exactly one `small_farm=true` is on; anything else is off.
 */
export function smallFarmOnlyFromSearch(search: string): boolean {
  const values = new URLSearchParams(search).getAll(SMALL_FARM_PARAM);
  return parseSmallFarmParam(values.length === 1 ? values[0] : values);
}

/**
 * Variety-page count line: "{N} listings." when off; "{B} of {N} listings ·
 * Small farms only." when on (the "of N" is required — a bare count after
 * narrowing would read as the variety's whole market).
 */
export function varietyListingCountLine(total: number, shown: number, smallFarmOnly: boolean): string {
  if (!smallFarmOnly) return `${plural(total, "listing")}.`;
  return `${shown} of ${plural(total, "listing")} · ${SMALL_FARM_CHIP_LABEL}.`;
}

/**
 * The narrowing rules as data: N published listings, B of them from badged
 * sellers; the control renders only for mixed pages (0 < B < N); narrowing
 * filters, never re-sorts.
 */
export function sellerFilterView(listings: ApiPublicListing[], smallFarmOnly: boolean) {
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
