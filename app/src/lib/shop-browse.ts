/**
 * Shop browse model (seller-as-shop) — ported from v2/lib/shop-browse.ts
 * (same vocabulary, state, URL encoding, narrowing, ordering, counts,
 * removers, and count-line text): the ONE home of the shop's
 * filter/search/sort meaning, shared by the server page (first paint),
 * the no-JS floor links, and the hydrated in-place layer, so the three
 * can never disagree on what a shop state means.
 *
 * State: { crop, season, method, lifeCycle, hues, sort, q } — crop is
 * shop-only (single-select, a crop slug); season/method/lifeCycle
 * single-select; Hue multi-select (OR within Hue, AND across groups);
 * sort absent = "In stock first" (the grouped default, shop-only); q
 * searches this shop only. URL params (no new names minted): crop,
 * season, method, life_cycle, color_family, sort, q, page. Parsing is
 * forgiving: unknown values are ignored (the all-values state, never a
 * 404) — including crop, where an unrecognized slug is ignored but a
 * valid slug the shop does not stock renders the zero-combination state,
 * never a 404.
 *
 * Client-safe by construction: the only runtime imports are lib/format,
 * lib/browse, lib/life-cycle, and lib/names (all pure).
 */
import {
  BROWSE_OPTIONS,
  COLOR_FAMILIES,
  COLOR_FAMILY_LABELS,
  LIFE_CYCLE_LABELS,
  METHOD_PARAMS,
  SEASON_LABELS,
  SEASON_PARAMS,
  SOWING_METHOD_LABELS,
  documentTitleFor,
  parseHueParam,
  parseLifeCycleParam,
  parseMethodParam,
  parseSearchQueryParam,
  parseSeasonParam,
  titlePageSuffix,
  type ColorFamily,
  type LifeCycleParam,
  type MethodParam,
  type SeasonParam,
} from "./browse";
import { plural, shortCommonName } from "./format";
import { lifeCycleBuckets } from "./life-cycle";
import { foldText, pickDidYouMean } from "./names";
import type { ApiAvailability, ApiPublicListing } from "../data/types";

/** One crop in the shop Crop group's global vocabulary (slug + common name). */
export interface ShopCrop {
  slug: string;
  commonName: string;
}

/** The shop's active browse state. Page rides beside it (never inside it), as on /variety. */
export interface ShopBrowseState {
  /** Active crop slug, or null for All crops. A valid slug the shop does not stock narrows to []. */
  crop: string | null;
  season: SeasonParam | null;
  method: MethodParam | null;
  lifeCycle: LifeCycleParam | null;
  /** Hue multi-select (OR within); [] = All hues. */
  hues: ColorFamily[];
  /** Absent ?sort= is "availability" — the grouped "In stock first" default (shop-only). */
  sort: ShopSortParam;
  /** The in-shop query (normalized at parse: "" or ≥ 2 characters — a shorter query is inert). */
  q: string;
}

/** The sort control's exactly three options, in display order (?sort= vocabulary + shop labels). */
export const SHOP_SORT_OPTIONS = [
  { value: "availability", label: "In stock first" },
  { value: "name", label: "Name A–Z" },
  { value: "recent", label: "Recently checked" },
] as const;
export type ShopSortParam = (typeof SHOP_SORT_OPTIONS)[number]["value"];

/** The count line's ordering phrase per sort — it never claims an order the list is not in. */
export const SHOP_SORT_PHRASE: Record<ShopSortParam, string> = {
  availability: "in stock first",
  name: "A–Z",
  recent: "most recently checked first",
};

export type ShopFilterGroup = "crop" | "season" | "method" | "lifeCycle" | "hue";

/** Query-param name per group (the site's existing names — none minted). */
export const SHOP_PARAM: Record<ShopFilterGroup, string> = {
  crop: "crop",
  season: "season",
  method: "method",
  lifeCycle: "life_cycle",
  hue: "color_family",
};

/** Group order: Crop leads; the inherited groups keep the model's relative order. */
export const SHOP_GROUP_ORDER: ShopFilterGroup[] = ["crop", "season", "method", "lifeCycle", "hue"];

/** The Crop group's legend (the inherited groups' legends ride BROWSE_OPTIONS). */
export const SHOP_CROP_LEGEND = "Crop";

/** Availability values that can be ordered today. */
const ORDERABLE: ReadonlySet<ApiAvailability> = new Set(["in_stock", "preorder"]);

/** True when the listing's availability can be ordered today. */
export function isOrderable(availability: ApiAvailability): boolean {
  return ORDERABLE.has(availability);
}

/* ── Thresholds: presence is a property of T, the shop's listing total ── */

export type ShopBand = "empty" | "plain" | "filters" | "full";

/** The shop's tool band from its listing total T (never the narrowed count). */
export function shopBand(total: number): ShopBand {
  if (total <= 0) return "empty";
  if (total <= 8) return "plain";
  if (total <= 24) return "filters";
  return "full";
}

/** Filters + sort render at T ≥ 9. */
export function shopHasFilters(total: number): boolean {
  return total >= 9;
}

/** Search joins at T ≥ 25. */
export function shopHasSearch(total: number): boolean {
  return total >= 25;
}

/* ── State transitions ── */

/** Resting state: all groups at All, the grouped default sort, no query. */
export function clearShopBrowseFilters(): ShopBrowseState {
  return { crop: null, season: null, method: null, lifeCycle: null, hues: [], sort: "availability", q: "" };
}

/** Clear All: every group to All and the query cleared — the sort is never cleared. */
export function clearShopAll(state: ShopBrowseState): ShopBrowseState {
  return { crop: null, season: null, method: null, lifeCycle: null, hues: [], sort: state.sort, q: "" };
}

/** True when the group narrows the list (non-All for singles, non-empty for hue). */
export function isShopGroupActive(state: ShopBrowseState, g: ShopFilterGroup): boolean {
  if (g === "hue") return state.hues.length > 0;
  if (g === "crop") return state.crop !== null;
  if (g === "season") return state.season !== null;
  if (g === "method") return state.method !== null;
  return state.lifeCycle !== null;
}

/** True when filters or the query shape the view (the applied row shows iff this is true). */
export function hasActiveShopState(state: ShopBrowseState): boolean {
  return (
    state.crop !== null ||
    state.season !== null ||
    state.method !== null ||
    state.lifeCycle !== null ||
    state.hues.length > 0 ||
    state.q !== ""
  );
}

/** True when a filter group (not the query) shapes the view. */
export function hasActiveShopFilters(state: ShopBrowseState): boolean {
  return (
    state.crop !== null || state.season !== null || state.method !== null || state.lifeCycle !== null || state.hues.length > 0
  );
}

/** The group cleared to its "All" state. */
export function clearShopGroup(state: ShopBrowseState, g: ShopFilterGroup): ShopBrowseState {
  if (g === "hue") return { ...state, hues: [] };
  if (g === "crop") return { ...state, crop: null };
  if (g === "season") return { ...state, season: null };
  if (g === "method") return { ...state, method: null };
  return { ...state, lifeCycle: null };
}

/** Single-select assignment: a value or null ("All"). */
export function withShopGroup(state: ShopBrowseState, g: Exclude<ShopFilterGroup, "hue">, value: string | null): ShopBrowseState {
  if (g === "crop") return { ...state, crop: value };
  if (g === "season") return { ...state, season: value as SeasonParam | null };
  if (g === "method") return { ...state, method: value as MethodParam | null };
  return { ...state, lifeCycle: value as LifeCycleParam | null };
}

/**
 * Multi-select hue toggle: the family joins or leaves the set; the set
 * stays in COLOR_FAMILIES order so equal sets always serialize to equal URLs.
 */
export function toggleShopHue(state: ShopBrowseState, family: ColorFamily): ShopBrowseState {
  const set = new Set(state.hues);
  if (set.has(family)) set.delete(family);
  else set.add(family);
  return { ...state, hues: COLOR_FAMILIES.filter((f) => set.has(f)) };
}

/** The hue family leaves the set (idempotent — removing an absent family is a no-op). */
export function removeShopHue(state: ShopBrowseState, family: ColorFamily): ShopBrowseState {
  return state.hues.includes(family) ? { ...state, hues: state.hues.filter((h) => h !== family) } : state;
}

/** Whether the option reads active: single-select equality, or set membership on hue. */
export function isShopOptionActive(state: ShopBrowseState, g: ShopFilterGroup, value: string | null): boolean {
  if (g === "hue") {
    return value === null ? state.hues.length === 0 : state.hues.includes(value as ColorFamily);
  }
  if (g === "crop") return value === state.crop;
  if (g === "season") return value === state.season;
  if (g === "method") return value === state.method;
  return value === state.lifeCycle;
}

/** Structural equality (hues compared as a set — order never distinguishes states). */
export function equalShopBrowseFilters(a: ShopBrowseState, b: ShopBrowseState): boolean {
  return (
    a.crop === b.crop &&
    a.season === b.season &&
    a.method === b.method &&
    a.lifeCycle === b.lifeCycle &&
    a.sort === b.sort &&
    a.q === b.q &&
    a.hues.length === b.hues.length &&
    a.hues.every((h) => b.hues.includes(h))
  );
}

/* ── URL ── */

/**
 * The filter/search/sort params to carry on links (e.g. pagination) — only
 * the active groups, the query, and a non-resting ?sort= (resting
 * "availability" serializes to the absent param, the shop's fallback meaning).
 */
export function shopFilterParams(state: ShopBrowseState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.crop) out[SHOP_PARAM.crop] = state.crop;
  if (state.season) out[SHOP_PARAM.season] = state.season;
  if (state.method) out[SHOP_PARAM.method] = state.method;
  if (state.lifeCycle) out[SHOP_PARAM.lifeCycle] = state.lifeCycle;
  if (state.hues.length) out[SHOP_PARAM.hue] = state.hues.join(",");
  if (state.q) out.q = state.q;
  if (state.sort !== "availability") out.sort = state.sort;
  return out;
}

/**
 * Link for a shop state: ?page= is never carried (a changed
 * filter/search/sort starts at page 1). The server chips AND the hydrated
 * layer's History API update share this, so the two can never disagree on
 * the shareable URL.
 */
export function shopBrowseHref(basePath: string, state: ShopBrowseState): string {
  const p = new URLSearchParams(shopFilterParams(state));
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/* ── Parsing (page query → state; forgiving — unknown values are All, never a 404) ── */

type RawParam = string | string[] | undefined;

/**
 * ?crop= for shops: a crop slug in the global vocabulary (trimmed,
 * lowercased). An unrecognized value is ignored (null = all crops) —
 * never a 404. A valid slug the shop does not stock stays in the state
 * and narrows to the zero-combination state.
 */
export function parseShopCropParam(raw: RawParam, crops: Pick<ShopCrop, "slug">[]): string | null {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  if (!v) return null;
  return crops.some((c) => c.slug === v) ? v : null;
}

/**
 * ?sort= for shops: "availability" | "name" | "recent" — anything else
 * (absent, garbage, a repeat's first miss) is "availability", the grouped
 * default. Forgiving like every filter parse, never a 404.
 */
export function parseShopSortParam(raw: RawParam): ShopSortParam {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "availability" || v === "name" || v === "recent" ? v : "availability";
}

/**
 * ?q= for shops: trimmed, capped at 100 characters — then the 2-character
 * minimum: a shorter query is inert ("", the un-searched view). Deleting
 * back below 2 characters restores the un-searched view; the field and the
 * state never disagree about scope.
 */
export function parseShopQueryParam(raw: RawParam): string {
  const q = parseSearchQueryParam(raw);
  return [...q].length >= 2 ? q : "";
}

/** SearchParams → shop state. The page (first paint) and the floor links share this. */
export function readShopBrowseFilters(
  sp: Record<string, string | string[] | undefined>,
  crops: Pick<ShopCrop, "slug">[],
): ShopBrowseState {
  return {
    crop: parseShopCropParam(sp.crop, crops),
    season: parseSeasonParam(sp.season),
    method: parseMethodParam(sp.method),
    lifeCycle: parseLifeCycleParam(sp.life_cycle),
    hues: parseHueParam(sp.color_family),
    sort: parseShopSortParam(sp.sort),
    q: parseShopQueryParam(sp.q),
  };
}

/**
 * Client-side mirror of readShopBrowseFilters: reads the shop state back
 * from a live `location.search` string (a leading "?" is tolerated). The
 * hydrated layer's popstate handler re-syncs through this, so Back/Forward
 * apply the same rule as first load.
 */
export function shopBrowseFiltersFromSearch(search: string, crops: Pick<ShopCrop, "slug">[]): ShopBrowseState {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = (key: string): RawParam => {
    const all = q.getAll(key);
    return all.length > 1 ? all : (all[0] as string | undefined);
  };
  return readShopBrowseFilters(
    {
      crop: raw("crop"),
      season: raw("season"),
      method: raw("method"),
      life_cycle: raw("life_cycle"),
      color_family: raw("color_family"),
      sort: raw("sort"),
      q: raw("q"),
    },
    crops,
  );
}

/* ── Narrowing (AND across groups and the query; OR within Hue) ── */

/**
 * One listing's match class for a query (the site search's classes,
 * scoped): 0 = exact name match, 1 = prefix (the name or a word of it
 * starts with the query), 2 = substring — against the variety name and
 * the crop common name only (never Latin names, never aliases). Null when
 * the listing does not match.
 */
export function shopMatchClass(listing: ApiPublicListing, q: string): 0 | 1 | 2 | null {
  const needle = foldText(q);
  if (!needle) return null;
  let best: 0 | 1 | 2 | null = null;
  for (const name of [listing.variety.varietyName, listing.variety.plant.commonName]) {
    const folded = foldText(name);
    if (!folded) continue;
    let cls: 0 | 1 | 2 | null = null;
    if (folded === needle) cls = 0;
    else if (folded.startsWith(needle) || folded.split(" ").some((w) => w.startsWith(needle))) cls = 1;
    else if (folded.includes(needle)) cls = 2;
    if (cls !== null && (best === null || cls < best)) best = cls;
  }
  return best;
}

/** True when the listing satisfies every active group and the query (AND, always). */
export function listingMatchesShop(listing: ApiPublicListing, state: ShopBrowseState): boolean {
  if (state.crop !== null && listing.variety.plant.slug !== state.crop) return false;
  if (state.season !== null && listing.variety.plant.season_class !== SEASON_PARAMS[state.season]) return false;
  if (state.method !== null && !listing.variety.plant.sowing_methods.includes(METHOD_PARAMS[state.method])) return false;
  if (state.lifeCycle !== null && !lifeCycleBuckets(listing.variety.plant.lifeCycle).includes(state.lifeCycle)) return false;
  if (state.hues.length > 0 && !state.hues.includes(listing.variety.colorFamily as ColorFamily)) return false;
  if (state.q !== "" && shopMatchClass(listing, state.q) === null) return false;
  return true;
}

/** The shop's full set narrowed by a state (a new array; the input is never mutated). */
export function narrowShopListings(listings: ApiPublicListing[], state: ShopBrowseState): ApiPublicListing[] {
  return listings.filter((l) => listingMatchesShop(l, state));
}

/* ── Ordering ── */

/**
 * Variety name A–Z: lowercase code-unit order (the repository's lower()
 * order, mirrored without ICU variance), ties by variety slug, then
 * listing id — deterministic, so SSR and in-place updates order
 * identically down to the last card.
 */
export function compareShopNames(a: ApiPublicListing, b: ApiPublicListing): number {
  const an = a.variety.varietyName.toLowerCase();
  const bn = b.variety.varietyName.toLowerCase();
  if (an < bn) return -1;
  if (an > bn) return 1;
  if (a.variety.slug < b.variety.slug) return -1;
  if (a.variety.slug > b.variety.slug) return 1;
  return a.id - b.id;
}

/**
 * The shop's order for a state (a new array; the input is never mutated).
 * While a query is active, relevance owns the order (match class, then
 * name A–Z). Otherwise the active sort: the grouped order (orderable
 * above not-orderable, name A–Z the sole key within each section — no
 * availability sub-tiering), pure Name A–Z, or ungrouped recency
 * (freshest lastCheckedAt first, unchecked last, then name A–Z).
 */
export function sortShopListings(listings: ApiPublicListing[], state: ShopBrowseState): ApiPublicListing[] {
  const out = [...listings];
  if (state.q !== "") {
    const cls = new Map<number, number>();
    for (const l of out) cls.set(l.id, shopMatchClass(l, state.q) ?? 3);
    out.sort((a, b) => cls.get(a.id)! - cls.get(b.id)! || compareShopNames(a, b));
    return out;
  }
  if (state.sort === "name") {
    out.sort(compareShopNames);
    return out;
  }
  if (state.sort === "recent") {
    out.sort((a, b) => {
      const ac = a.lastCheckedAt;
      const bc = b.lastCheckedAt;
      if (ac === bc) return compareShopNames(a, b);
      if (ac === null) return 1;
      if (bc === null) return -1;
      return ac < bc ? 1 : -1;
    });
    return out;
  }
  // The grouped default: orderable first, name A–Z the sole key within each section.
  out.sort((a, b) => Number(isOrderable(b.availability)) - Number(isOrderable(a.availability)) || compareShopNames(a, b));
  return out;
}

/** Narrowed and ordered in one pass: the shop view for a state over the full set. */
export function shopViewListings(listings: ApiPublicListing[], state: ShopBrowseState): ApiPublicListing[] {
  return sortShopListings(narrowShopListings(listings, state), state);
}

/* ── Discrimination (evaluated on the shop's FULL set, never the narrowed set) ── */

/** Distinct facet values a group carries across the full set (unclassified listings belong to no value). */
function shopGroupValues(listings: ApiPublicListing[], g: ShopFilterGroup): string[] {
  const values = new Set<string>();
  for (const l of listings) {
    if (g === "crop") values.add(l.variety.plant.slug);
    else if (g === "season") {
      if (l.variety.plant.season_class) values.add(l.variety.plant.season_class);
    } else if (g === "method") {
      for (const m of l.variety.plant.sowing_methods) values.add(m);
    } else if (g === "lifeCycle") {
      for (const b of lifeCycleBuckets(l.variety.plant.lifeCycle)) values.add(b);
    } else if ((COLOR_FAMILIES as readonly string[]).includes(l.variety.colorFamily)) {
      values.add(l.variety.colorFamily);
    }
  }
  return [...values];
}

/**
 * The groups that render on a shop: a group renders only if the shop's
 * FULL set carries ≥ 2 distinct values — a group never vanishes because
 * the visitor narrowed another group. In group order.
 */
export function shopGroupsFor(listings: ApiPublicListing[]): ShopFilterGroup[] {
  return SHOP_GROUP_ORDER.filter((g) => shopGroupValues(listings, g).length >= 2);
}

/** The shop's crops (slug + common name) from its full set — A–Z by common name, no cap. */
export function shopCropsFor(listings: ApiPublicListing[]): ShopCrop[] {
  const bySlug = new Map<string, string>();
  for (const l of listings) {
    if (!bySlug.has(l.variety.plant.slug)) bySlug.set(l.variety.plant.slug, l.variety.plant.commonName);
  }
  return [...bySlug]
    .map(([slug, commonName]) => ({ slug, commonName }))
    .sort((a, b) => {
      const an = a.commonName.toLowerCase();
      const bn = b.commonName.toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return a.slug < b.slug ? -1 : 1;
    });
}

/* ── Counts (computed LOCALLY from the whole shipped set) ── */

/** One chip's count state: "All" clears its group; a single option assigns; a hue toggles. */
export function shopCountStateFor(state: ShopBrowseState, group: ShopFilterGroup, option: string | null): ShopBrowseState {
  if (option === null) return clearShopGroup(state, group);
  if (group === "hue") return toggleShopHue(state, option as ColorFamily);
  return withShopGroup(state, group, option);
}

/**
 * Per-option counts for a state, computed locally from the whole shipped
 * set: an option's count holds every OTHER group's selection AND the
 * current query. Zero-count options keep their 0 and stay operable. Crop
 * keys are the shop's crop slugs.
 */
export interface ShopCounts {
  crop: { all: number; options: Record<string, number> };
  season: { all: number; options: Record<SeasonParam, number> };
  method: { all: number; options: Record<MethodParam, number> };
  lifeCycle: { all: number; options: Record<LifeCycleParam, number> };
  hue: { all: number; options: Record<ColorFamily, number> };
}

export function shopCountsFor(listings: ApiPublicListing[], state: ShopBrowseState, shopCrops: ShopCrop[]): ShopCounts {
  const total = (s: ShopBrowseState): number => narrowShopListings(listings, s).length;
  const one = (group: ShopFilterGroup, option: string | null): number => total(shopCountStateFor(state, group, option));
  const seasonOptions = {} as Record<SeasonParam, number>;
  for (const k of Object.keys(SEASON_PARAMS) as SeasonParam[]) seasonOptions[k] = one("season", k);
  const methodOptions = {} as Record<MethodParam, number>;
  for (const k of Object.keys(METHOD_PARAMS) as MethodParam[]) methodOptions[k] = one("method", k);
  const lifeCycleOptions = {} as Record<LifeCycleParam, number>;
  for (const k of ["annual", "biennial", "perennial"] as LifeCycleParam[]) lifeCycleOptions[k] = one("lifeCycle", k);
  const hueOptions = {} as Record<ColorFamily, number>;
  for (const f of COLOR_FAMILIES) hueOptions[f] = one("hue", f);
  const cropOptions: Record<string, number> = {};
  for (const c of shopCrops) cropOptions[c.slug] = one("crop", c.slug);
  return {
    crop: { all: one("crop", null), options: cropOptions },
    season: { all: one("season", null), options: seasonOptions },
    method: { all: one("method", null), options: methodOptions },
    lifeCycle: { all: one("lifeCycle", null), options: lifeCycleOptions },
    hue: { all: one("hue", null), options: hueOptions },
  };
}

/** One chip's count from computed ShopCounts: null is the group's "All" chip. */
export function shopCountFor(counts: ShopCounts, group: ShopFilterGroup, value: string | null): number {
  switch (group) {
    case "crop":
      return value === null ? counts.crop.all : (counts.crop.options[value] ?? 0);
    case "season":
      return value === null ? counts.season.all : counts.season.options[value as SeasonParam];
    case "method":
      return value === null ? counts.method.all : counts.method.options[value as MethodParam];
    case "lifeCycle":
      return value === null ? counts.lifeCycle.all : counts.lifeCycle.options[value as LifeCycleParam];
    case "hue":
      return value === null ? counts.hue.all : counts.hue.options[value as ColorFamily];
  }
}

/* ── Removers, Clear All scope ── */

/**
 * One applied-row remover: its stable key, its visible label ("{Group}:
 * {Value}" — the group word is the group's legend), its accessible name,
 * and the clearing transition — a function of the state it applies to.
 * One remover per selected hue family, plus the search remover when a
 * query is active. Sort is never in the row.
 */
export interface ShopRemover {
  key: string;
  label: string;
  removeLabel: string;
  clear: (state: ShopBrowseState) => ShopBrowseState;
}

/** The applied row's removers for a state, in group order (hue families in set order). */
export function shopRemoversFor(state: ShopBrowseState, crops: Pick<ShopCrop, "slug" | "commonName">[]): ShopRemover[] {
  const remover = (key: string, label: string, removeLabel: string, clear: (s: ShopBrowseState) => ShopBrowseState): ShopRemover => ({
    key,
    label,
    removeLabel,
    clear,
  });
  const out: ShopRemover[] = [];
  if (state.crop) {
    const name = crops.find((c) => c.slug === state.crop)?.commonName ?? state.crop;
    out.push(remover("crop", `${SHOP_CROP_LEGEND}: ${name}`, `Remove the ${SHOP_CROP_LEGEND} filter, ${name}`, (s) => clearShopGroup(s, "crop")));
  }
  if (state.season) {
    out.push(
      remover("season", `Season: ${SEASON_LABELS[SEASON_PARAMS[state.season]]}`, `Remove the Season filter, ${SEASON_LABELS[SEASON_PARAMS[state.season]]}`, (s) => clearShopGroup(s, "season")),
    );
  }
  if (state.method) {
    out.push(
      remover("method", `Sowing method: ${SOWING_METHOD_LABELS[METHOD_PARAMS[state.method]]}`, `Remove the Sowing method filter, ${SOWING_METHOD_LABELS[METHOD_PARAMS[state.method]]}`, (s) => clearShopGroup(s, "method")),
    );
  }
  if (state.lifeCycle) {
    out.push(
      remover("lifeCycle", `Life cycle: ${LIFE_CYCLE_LABELS[state.lifeCycle]}`, `Remove the Life cycle filter, ${LIFE_CYCLE_LABELS[state.lifeCycle]}`, (s) => clearShopGroup(s, "lifeCycle")),
    );
  }
  for (const h of state.hues) {
    out.push(remover(`hue:${h}`, `Hue: ${COLOR_FAMILY_LABELS[h]}`, `Remove the Hue filter, ${COLOR_FAMILY_LABELS[h]}`, (s) => removeShopHue(s, h)));
  }
  if (state.q !== "") {
    out.push(remover("q", `Search: “${state.q}”`, `Clear the search for ${state.q}`, (s) => ({ ...s, q: "" })));
  }
  return out;
}

/* ── Count line ── */

/**
 * The shop's result-count line (the persistent live region's text). The
 * server page and the hydrated swap share this builder, so first paint
 * and every in-place update word the line identically. Rest: "{N}
 * listings, {ordering phrase}." — the phrase always names the order
 * actually applied, including when a grouped section is empty. Searched:
 * "{N} matches for “{q}”, best match first." Pagination appends the
 * shipped suffix.
 */
export function shopCountLine(state: ShopBrowseState, total: number, page: number, pages: number): string {
  const suffix = pages > 1 ? ` · page ${page} of ${pages}` : "";
  if (state.q !== "") {
    return `${plural(total, "match", "matches")} for “${state.q}”, best match first.${suffix}`;
  }
  return `${plural(total, "listing")}, ${SHOP_SORT_PHRASE[state.sort]}.${suffix}`;
}

/* ── Did-you-mean (the bounded rule, scoped to the shop's names) ── */

/**
 * The no-matches state's single near-match, or null: in-shop variety and
 * crop names only, same first letter, edit distance ≤ 2, at most one —
 * ties to the name with stock (an orderable listing behind it in this
 * shop), then alphabetical. Computed from the shop's full set, so it
 * never suggests a name the shop does not carry.
 */
export function shopDidYouMean(q: string, listings: ApiPublicListing[]): string | null {
  const stock = new Map<string, boolean>();
  const names = new Set<string>();
  for (const l of listings) {
    for (const name of [l.variety.varietyName, l.variety.plant.commonName]) {
      names.add(name);
      if (isOrderable(l.availability)) stock.set(name, true);
    }
  }
  return pickDidYouMean(
    q,
    [...names].map((name) => ({ name, hasSellers: stock.get(name) ?? false })),
  );
}

/* ── All-sold-out (a property of the shop, computed on T) ── */

/** True when the shop has listings and none is orderable — the notice shows, once. */
export function shopIsAllSoldOut(listings: ApiPublicListing[]): boolean {
  return listings.length > 0 && !listings.some((l) => isOrderable(l.availability));
}

/* ── Shop naming (one possessive rule for the heading, labels, and lines) ── */

/**
 * The seller name in possessive form: append ’s (U+2019) unless the name's
 * final character is "s" (either case), then ’ only. The test is the final
 * character alone — "Hudson Valley Seed Co." → "Hudson Valley Seed Co.’s",
 * "Three Brothers Blooms" → "Three Brothers Blooms’". The name is never
 * truncated or reworded.
 */
export function shopPossessive(name: string): string {
  const last = name.slice(-1);
  return last === "s" || last === "S" ? `${name}’` : `${name}’s`;
}

/** "{name}’s shop" — the catalog H2, the search label's scope, the empty-state lines. */
export function shopName(name: string): string {
  return `${shopPossessive(name)} shop`;
}

/** "{name}’s locations" — the Locations area heading. */
export function shopLocationsName(name: string): string {
  return `${shopPossessive(name)} locations`;
}

/* ── Document titles (the in-place title sync shares the server's builder) ── */

/**
 * The shop title for a page: the base title (the seller title the server
 * renders) plus the page suffix. The title does not change with
 * filter/search/sort state — this one builder feeds generateMetadata and
 * the in-place title sync, so SSR and in-place titles can never disagree.
 */
export function shopBrowseTitle(baseTitle: string, page: number): string {
  return `${baseTitle}${titlePageSuffix(page)}`;
}

/** The shop document.title for a committed (state, page). */
export function shopDocumentTitle(baseTitle: string, page: number): string {
  return documentTitleFor(shopBrowseTitle(baseTitle, page));
}

/* ── Chip options ── */

/** The Crop group's chips: "All" first, then the shop's crops A–Z by common name. */
export function shopCropOptions(shopCrops: ShopCrop[]): { value: string | null; label: string }[] {
  return [{ value: null, label: "All" }, ...shopCrops.map((c) => ({ value: c.slug, label: c.commonName }))];
}

/** Re-exported for the shop's filter strips: the inherited groups' legends and options. */
export const SHOP_BROWSE_OPTIONS = {
  season: BROWSE_OPTIONS.season,
  method: BROWSE_OPTIONS.method,
  lifeCycle: BROWSE_OPTIONS.lifeCycle,
  hue: BROWSE_OPTIONS.hue,
};

/** The visible crop line on cards and in the browse label: the short common name. */
export function shopCropLine(commonName: string): string {
  return shortCommonName(commonName);
}
