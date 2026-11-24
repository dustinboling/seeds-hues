/**
 * Read-side browse/search computation: predicates, ordering, paging, and
 * the per-option count matrices over walked API sets. The public API's
 * cursors are opaque (no jumping to a page) and v1 carries neither the
 * availability sort nor the /api/browse count matrices (internal Next
 * routes, not public API) — so the loaders walk once and compute
 * everything here, where unit tests pin the semantics against fixture
 * data. Pure functions: no fetch, no cache (load.ts orchestrates those).
 */
import {
  BROWSE_SORT_REPO,
  METHOD_PARAMS,
  SEASON_PARAMS,
  browseCountStates,
  type BrowseFilterGroup,
  type BrowseFilterState,
  type HueMode,
} from "../lib/browse";
import { lifeCycleMatches } from "../lib/life-cycle";
import { pickDidYouMean, type DidYouMeanCandidate } from "../lib/names";
import type {
  ApiBrowseCounts,
  ApiCrop,
  ApiSearchResponse,
  ApiSearchResult,
  ApiSellerItem,
  ApiSeriesCrop,
  ApiVarietyListItem,
} from "./types";

/* ── Variety predicates (AND across groups, OR within — the stub's mirror, over API fields) ── */

/** The variety-level fields one filter state tests (joined from the walked set or the corpus). */
export interface VarietyFilterFields {
  seasonClass: string | null;
  sowingMethods: string[];
  lifeCycle: string | null;
  colorFamily: string;
}

export function varietyFieldsOf(item: ApiVarietyListItem): VarietyFilterFields {
  return {
    seasonClass: item.plant.season_class,
    sowingMethods: [...item.plant.sowing_methods],
    lifeCycle: item.plant.lifeCycle,
    colorFamily: item.colorFamily,
  };
}

/**
 * True when the variety survives the state's season/method/life-cycle/hue
 * groups. smallFarm is NOT tested here — list items carry no badged-seller
 * flag, so the walk applies it server-side and every caller holds it fixed.
 */
export function varietyMatchesGroups(fields: VarietyFilterFields, state: BrowseFilterState): boolean {
  if (state.season && fields.seasonClass !== SEASON_PARAMS[state.season]) return false;
  if (state.method && !fields.sowingMethods.includes(METHOD_PARAMS[state.method])) return false;
  if (state.lifeCycle && !lifeCycleMatches(fields.lifeCycle, [state.lifeCycle])) return false;
  if (state.hue.length > 0 && !state.hue.includes(fields.colorFamily as (typeof state.hue)[number])) return false;
  return true;
}

/**
 * v2's availability comparator (repositories/catalog-read.ts
 * summaryComparator, verbatim logic): in-stock listings first, then any
 * listings, then none; within a tier more sellers first, then in-stock
 * listings, then listings, then name ascending with slug tiebreak. The
 * public API has no availability sort, so loaders apply this read-side
 * over the walked set.
 */
export function compareVarietyAvailability(a: ApiVarietyListItem, b: ApiVarietyListItem): number {
  const tier = (r: ApiVarietyListItem): number => (r.inStockCount > 0 ? 0 : r.listingCount > 0 ? 1 : 2);
  const nameAsc =
    a.varietyName.toLowerCase().localeCompare(b.varietyName.toLowerCase()) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  return (
    tier(a) - tier(b) ||
    b.sellerCount - a.sellerCount ||
    b.inStockCount - a.inStockCount ||
    b.listingCount - a.listingCount ||
    nameAsc
  );
}

/** Order one filtered set per the state's sort (availability sorts read-side; server sorts keep walk order). */
export function orderVarieties(items: ApiVarietyListItem[], state: BrowseFilterState): ApiVarietyListItem[] {
  if (BROWSE_SORT_REPO[state.sort] === "availability") return [...items].sort(compareVarietyAvailability);
  return items;
}

/**
 * The /variety counts matrix over one walked set (smallFarm already applied
 * server-side): every non-smallFarm cell counts the walked set under its
 * mapped state; the smallFarm cells take the opposite-smallFarm total
 * (one limit=1 query — the only cell no walk can answer) plus the
 * read-side same-smallFarm total. Zero counts are kept, never dropped.
 */
export function varietyBrowseCounts(
  walked: ApiVarietyListItem[],
  state: BrowseFilterState,
  oppositeSmallFarmTotal: number,
): ApiBrowseCounts {
  const totalUnder = (s: BrowseFilterState): number => walked.filter((v) => varietyMatchesGroups(varietyFieldsOf(v), s)).length;
  const cells = new Map<string, number>();
  for (const q of browseCountStates(state, ["season", "method", "lifeCycle", "hue", "smallFarm"], "multi")) {
    if (q.group === "smallFarm") continue;
    cells.set(`${q.group}:${q.option ?? "all"}`, totalUnder(q.state));
  }
  const cell = (group: BrowseFilterGroup, option: string | null): number => {
    const hit = cells.get(`${group}:${option ?? "all"}`);
    if (hit === undefined) throw new Error(`browse counts: ${group}:${option ?? "all"} missing from the count matrix`);
    return hit;
  };
  const sameSmallFarm = totalUnder(state);
  return {
    season: { all: cell("season", null), options: { cool: cell("season", "cool"), warm: cell("season", "warm") } },
    method: { all: cell("method", null), options: { direct: cell("method", "direct"), trays: cell("method", "trays") } },
    lifeCycle: {
      all: cell("lifeCycle", null),
      options: { annual: cell("lifeCycle", "annual"), biennial: cell("lifeCycle", "biennial"), perennial: cell("lifeCycle", "perennial") },
    },
    hue: {
      all: cell("hue", null),
      options: {
        white: cell("hue", "white"),
        blush: cell("hue", "blush"),
        pink: cell("hue", "pink"),
        peach: cell("hue", "peach"),
        orange: cell("hue", "orange"),
        yellow: cell("hue", "yellow"),
        red: cell("hue", "red"),
        burgundy: cell("hue", "burgundy"),
        purple: cell("hue", "purple"),
        blue: cell("hue", "blue"),
        green: cell("hue", "green"),
        chocolate: cell("hue", "chocolate"),
        mix: cell("hue", "mix"),
      },
    },
    smallFarm: state.smallFarm ? { all: oppositeSmallFarmTotal, on: sameSmallFarm } : { all: sameSmallFarm, on: oppositeSmallFarmTotal },
  };
}

/* ── Search: read-side filtering over one unfiltered v1 response ── */

/** The plant-level fields one search hit filters on (joined per group). */
export interface SearchFilterFields {
  seasonClass: string | null;
  sowingMethods: string[];
  lifeCycle: string | null;
  colorFamily: string | null;
}

/**
 * True when the hit survives the state's groups for its group kind:
 * sellers never filter (constant across the matrix); hue moves only the
 * variety slice (variety-level); season, method, and life cycle move
 * varieties, crops, and series (plant-level). v2's browseSearch groupsFor,
 * verbatim semantics.
 */
export function searchHitMatches(
  fields: SearchFilterFields,
  kind: "variety" | "crop" | "series" | "seller",
  state: BrowseFilterState,
): boolean {
  if (kind === "seller") return true;
  if (state.season && fields.seasonClass !== SEASON_PARAMS[state.season]) return false;
  if (state.method && !fields.sowingMethods.includes(METHOD_PARAMS[state.method])) return false;
  if (state.lifeCycle && !lifeCycleMatches(fields.lifeCycle, [state.lifeCycle])) return false;
  if (kind === "variety" && state.hue.length > 0 && (fields.colorFamily === null || !state.hue.includes(fields.colorFamily as never))) {
    return false;
  }
  return true;
}

export interface SearchJoins {
  varieties: Map<string, SearchFilterFields>;
  crops: Map<string, SearchFilterFields>;
  series: Map<string, SearchFilterFields>;
}

export function joinsFromCorpus(items: ApiVarietyListItem[], crops: ApiCrop[], series: ApiSeriesCrop[]): SearchJoins {
  return {
    varieties: new Map(
      items.map((v) => [
        v.slug,
        {
          seasonClass: v.plant.season_class,
          sowingMethods: [...v.plant.sowing_methods],
          lifeCycle: v.plant.lifeCycle,
          colorFamily: v.colorFamily,
        },
      ]),
    ),
    crops: new Map(
      crops.map((c) => [
        c.slug,
        { seasonClass: c.season_class, sowingMethods: [...c.sowing_methods], lifeCycle: c.lifeCycle, colorFamily: null },
      ]),
    ),
    series: new Map(
      series.map((s) => [
        s.slug,
        {
          seasonClass: s.plant.season_class,
          sowingMethods: [...s.plant.sowing_methods],
          lifeCycle: s.plant.lifeCycle,
          colorFamily: null,
        },
      ]),
    ),
  };
}

export interface FilteredSearchGroups {
  crops: ApiSearchResult[];
  series: ApiSearchResult[];
  varieties: ApiSearchResult[];
  sellers: ApiSearchResult[];
  total: number;
}

/**
 * One unfiltered v1 response under one filter state: the grouped sets plus
 * the grouped total (the rendered groups' lengths — v2's total, exactly).
 * Hits missing from the joins drop (v2's ids-join behaves the same).
 */
export function filterSearchGroups(wide: ApiSearchResponse, joins: SearchJoins, state: BrowseFilterState): FilteredSearchGroups {
  const keep = (kind: "variety" | "crop" | "series" | "seller", slug: string): boolean => {
    if (kind === "seller") return true;
    const table = kind === "variety" ? joins.varieties : kind === "crop" ? joins.crops : joins.series;
    const fields = table.get(slug);
    return fields ? searchHitMatches(fields, kind, state) : false;
  };
  const crops = wide.crops.filter((r) => keep("crop", r.slug));
  const series = wide.series.filter((r) => keep("series", r.slug));
  const varieties = wide.varieties.filter((r) => keep("variety", r.slug));
  const sellers = wide.sellers;
  return { crops, series, varieties, sellers, total: crops.length + series.length + varieties.length + sellers.length };
}

/**
 * The /search counts matrix: each queried cell totals the match set under
 * its mapped state (single-select hue). Groups the surface does not render
 * carry their honest All — the result total, since the group is always
 * cleared — and fail-closed 0 options (v2's assemblePartialBrowseCounts).
 */
export function searchBrowseCounts(
  wide: ApiSearchResponse,
  joins: SearchJoins,
  state: BrowseFilterState,
  hueMode: HueMode,
): ApiBrowseCounts {
  const queries = browseCountStates(state, ["season", "method", "lifeCycle", "hue"], hueMode);
  const totals = queries.map((q) => filterSearchGroups(wide, joins, q.state).total);
  const main = filterSearchGroups(wide, joins, state).total;
  const cells = new Map<string, number>();
  queries.forEach((q, i) => cells.set(`${q.group}:${q.option ?? "all"}`, totals[i]!));
  const cell = (group: BrowseFilterGroup, option: string | null): number => {
    const hit = cells.get(`${group}:${option ?? "all"}`);
    if (hit !== undefined) return hit;
    // Unqueried groups (smallFarm on /search): All is the honest result
    // total; options fail closed to 0 (no chip reads them).
    if (group === "smallFarm") return option === null ? main : 0;
    throw new Error(`search counts: ${group}:${option ?? "all"} missing from the count matrix`);
  };
  return {
    season: { all: cell("season", null), options: { cool: cell("season", "cool"), warm: cell("season", "warm") } },
    method: { all: cell("method", null), options: { direct: cell("method", "direct"), trays: cell("method", "trays") } },
    lifeCycle: {
      all: cell("lifeCycle", null),
      options: { annual: cell("lifeCycle", "annual"), biennial: cell("lifeCycle", "biennial"), perennial: cell("lifeCycle", "perennial") },
    },
    hue: {
      all: cell("hue", null),
      options: {
        white: cell("hue", "white"),
        blush: cell("hue", "blush"),
        pink: cell("hue", "pink"),
        peach: cell("hue", "peach"),
        orange: cell("hue", "orange"),
        yellow: cell("hue", "yellow"),
        red: cell("hue", "red"),
        burgundy: cell("hue", "burgundy"),
        purple: cell("hue", "purple"),
        blue: cell("hue", "blue"),
        green: cell("hue", "green"),
        chocolate: cell("hue", "chocolate"),
        mix: cell("hue", "mix"),
      },
    },
    smallFarm: { all: cell("smallFarm", null), on: cell("smallFarm", "true") },
  };
}

/** Did-you-mean over walked names (varieties + crops, seller presence for ties). */
export function suggestCorrection(query: string, items: ApiVarietyListItem[], crops: ApiCrop[]): string | null {
  const candidates: DidYouMeanCandidate[] = [
    ...items.map((v) => ({ name: v.varietyName, hasSellers: v.listingCount > 0 })),
    ...crops.map((c) => ({ name: c.commonName, hasSellers: c.varietiesWithSellers > 0 })),
  ];
  return pickDidYouMean(query, candidates);
}

/* ── Sellers ── */

/** Sellers narrowed to the state's region (null = all states). Walk order is the live order. */
export function sellersInState(items: ApiSellerItem[], stateCode: string | null): ApiSellerItem[] {
  return stateCode ? items.filter((s) => s.region === stateCode) : items;
}
