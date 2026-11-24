/**
 * Browse-filter model — ported from v2/lib/browse.ts (same vocabulary,
 * same state, same URL encoding, same count semantics): the ONE home of
 * the filter vocabulary shared by the SSR routes and the hydrated in-place
 * layer, so the two can never disagree on what a filter state means.
 *
 * Client-safe by construction: the only runtime imports are site constants,
 * lib/small-farm, lib/format, and lib/color-chip (pure data + string
 * helpers). Deliberately NOT ported: the repository mappings
 * (varietyFiltersFromBrowse, cropFiltersFromBrowse, browseCountQueries —
 * v2's service layer builds SQL from those; this app's loaders map states
 * to public-API params and count read-side instead) and the crop-surface
 * count lines (those surfaces land with their slices).
 */
import { SITE_NAME } from "../site";
import { plural } from "./format";
import { COLOR_FAMILY_SWATCHES, type ColorFamily } from "./color-chip";
import {
  SMALL_FARM_CHIP_LABEL,
  SMALL_FARM_FILTER_LABEL,
  SMALL_FARM_PARAM,
  parseSmallFarmParam,
} from "./small-farm";
import type { ApiBrowseCounts, ApiSeasonClass, ApiSowingMethod } from "../data/types";

/* ── Vocabulary ── */

/** Display labels for season classes (UI + docs). */
export const SEASON_LABELS: Record<ApiSeasonClass, string> = {
  cool_season_hardy_annual: "Cool Season Hardy Annuals",
  warm_season_tender_annual: "Warm Season Tender Annuals",
};

/** Short query-param values (`?season=cool|warm`) ↔ season classes. */
export const SEASON_PARAMS = { cool: "cool_season_hardy_annual", warm: "warm_season_tender_annual" } as const;
export type SeasonParam = keyof typeof SEASON_PARAMS;

/** Display labels for sowing methods (UI + docs). */
export const SOWING_METHOD_LABELS: Record<ApiSowingMethod, string> = {
  direct_sow: "Direct Sow",
  transplant: "Start indoors",
};

/** Short query-param values (`?method=direct|trays`) ↔ sowing methods. */
export const METHOD_PARAMS = { direct: "direct_sow", trays: "transplant" } as const;
export type MethodParam = keyof typeof METHOD_PARAMS;

/**
 * Life-cycle filter buckets (`?life_cycle=annual|biennial|perennial`): how
 * the crop is grown, derived from plants.life_cycle by lifeCycleBuckets()
 * in lib/life-cycle.ts (never stored).
 */
export const LIFE_CYCLE_PARAMS = ["annual", "biennial", "perennial"] as const;
export type LifeCycleParam = (typeof LIFE_CYCLE_PARAMS)[number];
export const LIFE_CYCLE_LABELS: Record<LifeCycleParam, string> = { annual: "Annual", biennial: "Biennial", perennial: "Perennial" };

/**
 * Variety colour families ("Hue") — the ONE vocabulary for catalog input,
 * filters and UI. varieties.color_family also holds 'unknown' (the column
 * default), which is never an input value: a variety without a family is
 * simply unknown.
 */
export const COLOR_FAMILIES = [
  "white",
  "blush",
  "pink",
  "peach",
  "orange",
  "yellow",
  "red",
  "burgundy",
  "purple",
  "blue",
  "green",
  "chocolate",
  "mix",
] as const satisfies readonly ColorFamily[];

/** Display labels for colour families (chips + result lines). */
export const COLOR_FAMILY_LABELS: Record<ColorFamily, string> = {
  white: "White",
  blush: "Blush",
  pink: "Pink",
  peach: "Peach",
  orange: "Orange",
  yellow: "Yellow",
  red: "Red",
  burgundy: "Burgundy",
  purple: "Purple",
  blue: "Blue",
  green: "Green",
  chocolate: "Chocolate",
  mix: "Mixed",
};

export { COLOR_FAMILY_SWATCHES };
export type { ColorFamily };

/* ── State ── */

/**
 * The active browse filters. Season, method and life cycle are
 * single-select (null = "All"); Hue is multi-select (PB-2: any set of
 * families, OR within — [] = "All"); smallFarm is a boolean toggle.
 * Single-select surfaces (every surface but /variety) hold at most one hue.
 * Sort rides the same state but is NOT a filter group: it has no counts
 * column, no remover, and never shows the applied row — only the two sorted
 * surfaces parse it, every other surface holds it at its resting value.
 */
export interface BrowseFilterState {
  season: SeasonParam | null;
  method: MethodParam | null;
  lifeCycle: LifeCycleParam | null;
  hue: ColorFamily[];
  /**
   * "Sellers" group: only varieties with at least one listing from a seller
   * carrying the Small farm badge. Shown on /variety only; every other
   * surface passes false.
   */
  smallFarm: boolean;
  /** The list order (?sort=): resting "name" (PB-1) — parsed on the sorted surfaces only. */
  sort: BrowseSortParam;
}

export type BrowseFilterGroup = "season" | "method" | "lifeCycle" | "hue" | "smallFarm";

/** Query-param name per group (the same names /api/v1 uses). */
export const BROWSE_PARAM: Record<BrowseFilterGroup, string> = {
  season: "season",
  method: "method",
  lifeCycle: "life_cycle",
  hue: "color_family",
  smallFarm: SMALL_FARM_PARAM,
};

/** Hue selection mode: /variety is multi (PB-2); every other surface stays single. */
export type HueMode = "single" | "multi";

/* ── Sort (the PB-1 fallback: absent ?sort= is Name A–Z) ── */

/** The sort control's exactly three options, in display order (?sort= vocabulary + labels). */
export const BROWSE_SORT_OPTIONS = [
  { value: "availability", label: "Most sellers first" },
  { value: "name", label: "Name A–Z" },
  { value: "recent", label: "Recently checked" },
] as const;
export type BrowseSortParam = (typeof BROWSE_SORT_OPTIONS)[number]["value"];

/** The count line's ordering phrase per sort ("…, most sellers first." / "…, alphabetical." / …). */
export const BROWSE_SORT_PHRASE: Record<BrowseSortParam, string> = {
  availability: "most sellers first",
  name: "alphabetical",
  recent: "most recently checked first",
};

/**
 * ?sort= → the read sort key ("recent" is the existing -recently_checked;
 * "availability" sorts read-side — v2 keeps that vocabulary service-side
 * and /api/v1 400s it).
 */
export const BROWSE_SORT_REPO: Record<BrowseSortParam, "availability" | "name" | "-recently_checked"> = {
  availability: "availability",
  name: "name",
  recent: "-recently_checked",
};

/**
 * ?sort= for the sorted surfaces: "availability" | "name" | "recent",
 * anything else (absent, garbage, a repeat's first miss) is "name" —
 * forgiving like every filter parse, never a 404.
 */
export function parseSortParam(raw: RawParam): BrowseSortParam {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "availability" || v === "name" || v === "recent" ? v : "name";
}

/**
 * Clear all: every filter group to All — the shopper's sort survives (sort
 * is an ordering, not a filter group, so resetting groups never re-orders
 * the list).
 */
export function clearAllFilters(state: BrowseFilterState): BrowseFilterState {
  return { season: null, method: null, lifeCycle: null, hue: [], smallFarm: false, sort: state.sort };
}

/** True when the group narrows the list (non-All for singles, non-empty for hue, on for sellers). */
export function isGroupActive(state: BrowseFilterState, g: BrowseFilterGroup): boolean {
  if (g === "hue") return state.hue.length > 0;
  if (g === "smallFarm") return state.smallFarm;
  return state[g] !== null;
}

/** True when at least one group is active (the applied row shows iff this is true). */
export function hasActiveFilters(state: BrowseFilterState): boolean {
  return state.season !== null || state.method !== null || state.lifeCycle !== null || state.hue.length > 0 || state.smallFarm;
}

/** The group cleared to its "All" state. */
export function clearGroup(state: BrowseFilterState, g: BrowseFilterGroup): BrowseFilterState {
  if (g === "hue") return { ...state, hue: [] };
  if (g === "smallFarm") return { ...state, smallFarm: false };
  return { ...state, [g]: null };
}

/**
 * Single-select assignment: value (its URL value) or null ("All"). On the
 * hue group this sets a one-element set — the single-select surfaces' only
 * hue transition; /variety toggles instead.
 */
export function withGroup(state: BrowseFilterState, g: BrowseFilterGroup, value: string | null): BrowseFilterState {
  if (g === "hue") return { ...state, hue: value === null ? [] : [value as ColorFamily] };
  if (g === "smallFarm") return { ...state, smallFarm: value === "true" };
  return { ...state, [g]: value };
}

/**
 * Multi-select hue toggle (PB-2): the family joins or leaves the set; the
 * set stays in COLOR_FAMILIES order so equal sets always serialize to
 * equal URLs.
 */
export function toggleHue(state: BrowseFilterState, family: ColorFamily): BrowseFilterState {
  const set = new Set(state.hue);
  if (set.has(family)) set.delete(family);
  else set.add(family);
  return { ...state, hue: COLOR_FAMILIES.filter((f) => set.has(f)) };
}

/** Whether the option reads active: the single-select equality, or set membership on multi hue. */
export function isOptionActive(
  state: BrowseFilterState,
  g: BrowseFilterGroup,
  value: string | null,
  hueMode: HueMode,
): boolean {
  if (g === "hue") {
    return hueMode === "multi"
      ? value === null
        ? state.hue.length === 0
        : state.hue.includes(value as ColorFamily)
      : value === (state.hue[0] ?? null);
  }
  if (g === "smallFarm") return value === (state.smallFarm ? "true" : null);
  return value === state[g];
}

/** Structural equality (hue compared as a set — order never distinguishes states). */
export function equalBrowseFilters(a: BrowseFilterState, b: BrowseFilterState): boolean {
  return (
    a.season === b.season &&
    a.method === b.method &&
    a.lifeCycle === b.lifeCycle &&
    a.smallFarm === b.smallFarm &&
    a.sort === b.sort &&
    a.hue.length === b.hue.length &&
    a.hue.every((h) => b.hue.includes(h))
  );
}

/* ── URL ── */

/**
 * The filter params to carry on links (e.g. pagination) — only the active
 * groups, plus a non-resting ?sort= (resting "name" serializes to the
 * absent param, PB-1's fallback meaning).
 */
export function filterParams(state: BrowseFilterState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.season) out[BROWSE_PARAM.season] = state.season;
  if (state.method) out[BROWSE_PARAM.method] = state.method;
  if (state.lifeCycle) out[BROWSE_PARAM.lifeCycle] = state.lifeCycle;
  if (state.hue.length) out[BROWSE_PARAM.hue] = state.hue.join(",");
  if (state.smallFarm) out[BROWSE_PARAM.smallFarm] = "true";
  if (state.sort !== "name") out.sort = state.sort;
  return out;
}

/**
 * Link for a filter state: the extra params (q on /search) are kept; ?page=
 * is never carried (a changed filter starts at page 1). The server chips
 * AND the hydrated layer's History API update share this, so the two can
 * never disagree on the shareable URL.
 */
export function browseHref(basePath: string, state: BrowseFilterState, params: Record<string, string> = {}): string {
  const p = new URLSearchParams(params);
  p.delete("page");
  for (const [k, v] of Object.entries(filterParams(state))) p.set(k, v);
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Link for one chip: the state with that option applied. On a multi hue
 * group the family toggles (null clears the set); everywhere else the value
 * assigns (null clears the group).
 */
export function chipHref(
  basePath: string,
  state: BrowseFilterState,
  group: BrowseFilterGroup,
  value: string | null,
  params: Record<string, string>,
  hueMode: HueMode,
): string {
  let next: BrowseFilterState;
  if (group === "hue" && hueMode === "multi") {
    next = value === null ? clearGroup(state, "hue") : toggleHue(state, value as ColorFamily);
  } else {
    next = withGroup(state, group, value);
  }
  return browseHref(basePath, next, params);
}

/* ── Parsing (page query → state; the forgiving rules list pages always used) ── */

export type RawParam = string | string[] | undefined;

/**
 * ?season= for list pages: "cool" | "warm", anything else is ignored (null
 * = all seasons). Unlike ?page=, an unknown value is not a 404 — the page
 * just shows every season.
 */
export function parseSeasonParam(raw: RawParam): SeasonParam | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && Object.hasOwn(SEASON_PARAMS, v) ? (v as SeasonParam) : null;
}

/** ?method= for list pages: "direct" | "trays" (single-select); anything else is ignored (null = all). */
export function parseMethodParam(raw: RawParam): MethodParam | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && Object.hasOwn(METHOD_PARAMS, v) ? (v as MethodParam) : null;
}

/** ?life_cycle= for list pages: "annual" | "biennial" | "perennial" (single-select); anything else is ignored. */
export function parseLifeCycleParam(raw: RawParam): LifeCycleParam | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && (LIFE_CYCLE_PARAMS as readonly string[]).includes(v) ? (v as LifeCycleParam) : null;
}

/**
 * ?color_family= for /variety (multi): a comma list and/or repeated
 * params; unknown families are ignored, the set is deduped into
 * COLOR_FAMILIES order ([] = all hues). The API's comma-list vocabulary,
 * shared with the page URL.
 */
export function parseHueParam(raw: RawParam): ColorFamily[] {
  const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const set = new Set<ColorFamily>();
  for (const v of values) {
    for (const part of v.split(",")) {
      const f = part.trim();
      if ((COLOR_FAMILIES as readonly string[]).includes(f)) set.add(f as ColorFamily);
    }
  }
  return COLOR_FAMILIES.filter((f) => set.has(f));
}

/**
 * ?color_family= for single-select surfaces (/search): exactly one family —
 * the first raw value must be exactly one family, anything else (absent,
 * garbage, a comma list, a repeat) is All. /variety uses parseHueParam
 * instead.
 */
export function parseHueParamSingle(raw: RawParam): ColorFamily | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && (COLOR_FAMILIES as readonly string[]).includes(v) ? (v as ColorFamily) : null;
}

/**
 * Page query → filter state. The /variety page shares this (the full parse
 * — /variety is the sorted surface in this state family, so ?sort= parses).
 */
export function readBrowseFilters(sp: Record<string, string | string[] | undefined>, hueMode: HueMode): BrowseFilterState {
  const hue = hueMode === "multi" ? parseHueParam(sp.color_family) : parseHueParamSingle(sp.color_family);
  return {
    season: parseSeasonParam(sp.season),
    method: parseMethodParam(sp.method),
    lifeCycle: parseLifeCycleParam(sp.life_cycle),
    hue: hue === null ? [] : Array.isArray(hue) ? hue : [hue],
    smallFarm: parseSmallFarmParam(sp.small_farm),
    sort: parseSortParam(sp.sort),
  };
}

/**
 * Page query → filter state for a surface rendering a subset of the groups:
 * only the listed groups are parsed — every other group stays at its
 * resting value. A hand-crafted ?color_family= on a surface with no Hue
 * group is ignored (never a phantom remover), exactly as those surfaces
 * always parsed.
 */
export function readBrowseFiltersForGroups(
  sp: Record<string, string | string[] | undefined>,
  groups: BrowseFilterGroup[],
  hueMode: HueMode,
  withSort = false,
): BrowseFilterState {
  const hue = hueMode === "multi" ? parseHueParam(sp.color_family) : parseHueParamSingle(sp.color_family);
  return {
    season: groups.includes("season") ? parseSeasonParam(sp.season) : null,
    method: groups.includes("method") ? parseMethodParam(sp.method) : null,
    lifeCycle: groups.includes("lifeCycle") ? parseLifeCycleParam(sp.life_cycle) : null,
    hue: groups.includes("hue") ? (hue === null ? [] : Array.isArray(hue) ? hue : [hue]) : [],
    smallFarm: groups.includes("smallFarm") ? parseSmallFarmParam(sp.small_farm) : false,
    // withSort is the /variety popstate re-sync only: every other scoped
    // surface holds sort at rest, so a hand-crafted ?sort= there is ignored
    // like an unlisted group's param.
    sort: withSort ? parseSortParam(sp.sort) : "name",
  };
}

/** ?q= for /search: trimmed, capped at 100 characters. */
export function parseSearchQueryParam(raw: RawParam): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? "").trim().slice(0, 100);
}

/** A live `location.search` string as a page-query-shaped record (repeats stay arrays). */
function searchToRecord(search: string): Record<string, string | string[] | undefined> {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = (key: string): RawParam => {
    const all = q.getAll(key);
    return all.length > 1 ? all : (all[0] as string | undefined);
  };
  return {
    season: raw("season"),
    method: raw("method"),
    life_cycle: raw("life_cycle"),
    color_family: raw("color_family"),
    small_farm: raw("small_farm"),
    sort: raw("sort"),
  };
}

/**
 * Client-side mirror of readBrowseFilters: reads the filter state back from
 * a live `location.search` string (a leading "?" is tolerated). The
 * hydrated layer's popstate handler re-syncs through this, so Back/Forward
 * apply the same rule as first load.
 */
export function browseFiltersFromSearch(search: string, hueMode: HueMode): BrowseFilterState {
  return readBrowseFilters(searchToRecord(search), hueMode);
}

/**
 * Client-side mirror of readBrowseFiltersForGroups: the popstate re-sync
 * for surfaces rendering a subset of the groups — Back/Forward parse
 * exactly what first load parses. withSort is the /variety surface's (its
 * first load is the full, sort-parsing read).
 */
export function scopedBrowseFiltersFromSearch(
  search: string,
  groups: BrowseFilterGroup[],
  hueMode: HueMode,
  withSort = false,
): BrowseFilterState {
  return readBrowseFiltersForGroups(searchToRecord(search), groups, hueMode, withSort);
}

/* ── Labels, count line, options ── */

/** Labels of the active filters, in group order, for result-count lines ("48 crops · …"). */
export function activeFilterLabels(state: BrowseFilterState): string[] {
  return [
    state.season ? SEASON_LABELS[SEASON_PARAMS[state.season]] : null,
    state.method ? SOWING_METHOD_LABELS[METHOD_PARAMS[state.method]] : null,
    state.lifeCycle ? LIFE_CYCLE_LABELS[state.lifeCycle] : null,
    ...state.hue.map((h) => COLOR_FAMILY_LABELS[h]),
    state.smallFarm ? SMALL_FARM_FILTER_LABEL : null,
  ].filter((x): x is string => x !== null);
}

/**
 * The /variety result-count line. The server page and the hydrated swap
 * share this builder, so first paint and every in-place update word the
 * line identically (the live region's text is the announcement — it changes
 * exactly once per committed change, in step with the rows). The ordering
 * phrase follows the active sort — and never claims "alphabetical" under
 * another order.
 */
export function browseCountLine(state: BrowseFilterState, total: number, page: number, pages: number): string {
  return `${[plural(total, "variety", "varieties"), ...activeFilterLabels(state)].join(" · ")}, ${BROWSE_SORT_PHRASE[state.sort]}.${pages > 1 ? ` Page ${page} of ${pages}.` : ""}`;
}

/* ── Document titles ── */

/**
 * The browse titles' page suffix — the client-safe mirror of
 * pageTitleSuffix() (the two must agree: " — page N" for N > 1, else "").
 */
export function titlePageSuffix(page: number): string {
  return page > 1 ? ` — page ${page}` : "";
}

/** The full document.title for a server title rendered under the root template (`%s | seeds.hues.flowers`). */
export function documentTitleFor(title: string): string {
  return `${title} | ${SITE_NAME}`;
}

/**
 * The /variety title the server renders for a filter state + page: the
 * active filter labels, or the unfiltered title at rest, plus the page
 * suffix. The head builder shares this, so SSR and the in-place title sync
 * can never disagree. Sort never appears — only the filter labels and the
 * page.
 */
export function varietyBrowseTitle(state: BrowseFilterState, page: number): string {
  const active = activeFilterLabels(state);
  return `${active.length > 0 ? `${active.join(" · ")} — flower seed varieties` : "All flower seed varieties"}${titlePageSuffix(page)}`;
}

/** The /variety document.title for a committed (state, page). */
export function varietyDocumentTitle(state: BrowseFilterState, page: number): string {
  return documentTitleFor(varietyBrowseTitle(state, page));
}

export interface BrowseOption {
  value: string | null;
  label: string;
  hue?: ColorFamily;
}

/**
 * One applied-row remover: its stable key, its visible label ("{Group}:
 * {Value}" — the group word is the group's legend), its accessible name
 * ("Remove the {Group} filter, {Value}"), and the clearing transition — a
 * function of the state it applies to, so rapid taps always clear from the
 * latest intent, never from a stale render. One remover per selected hue
 * family.
 */
export interface BrowseRemover {
  key: string;
  label: string;
  removeLabel: string;
  clear: (state: BrowseFilterState) => BrowseFilterState;
}

/** The hue family leaves the set (idempotent — removing an absent family is a no-op). */
export function removeHue(state: BrowseFilterState, family: ColorFamily): BrowseFilterState {
  return state.hue.includes(family) ? { ...state, hue: state.hue.filter((h) => h !== family) } : state;
}

/** The applied row's removers for a state, in group order (hue families in set order). */
export function removersFor(state: BrowseFilterState): BrowseRemover[] {
  const remover = (
    key: string,
    group: BrowseFilterGroup,
    value: string,
    clear: (s: BrowseFilterState) => BrowseFilterState,
  ): BrowseRemover => {
    const g = BROWSE_OPTIONS[group].legend;
    return { key, label: `${g}: ${value}`, removeLabel: `Remove the ${g} filter, ${value}`, clear };
  };
  const out: BrowseRemover[] = [];
  if (state.season) {
    out.push(remover("season", "season", SEASON_LABELS[SEASON_PARAMS[state.season]], (s) => clearGroup(s, "season")));
  }
  if (state.method) {
    out.push(remover("method", "method", SOWING_METHOD_LABELS[METHOD_PARAMS[state.method]], (s) => clearGroup(s, "method")));
  }
  if (state.lifeCycle) {
    out.push(remover("lifeCycle", "lifeCycle", LIFE_CYCLE_LABELS[state.lifeCycle], (s) => clearGroup(s, "lifeCycle")));
  }
  for (const h of state.hue) {
    out.push(remover(`hue:${h}`, "hue", COLOR_FAMILY_LABELS[h], (s) => removeHue(s, h)));
  }
  if (state.smallFarm) {
    out.push(remover("smallFarm", "smallFarm", SMALL_FARM_FILTER_LABEL, (s) => clearGroup(s, "smallFarm")));
  }
  return out;
}

/** The chip rows per group: "All" plus every option, in display order. */
export const BROWSE_OPTIONS: Record<BrowseFilterGroup, { legend: string; options: BrowseOption[] }> = {
  season: {
    legend: "Season",
    options: [
      { value: null, label: "All" },
      ...(Object.keys(SEASON_PARAMS) as SeasonParam[]).map((k) => ({ value: k, label: SEASON_LABELS[SEASON_PARAMS[k]] })),
    ],
  },
  method: {
    legend: "Sowing method",
    options: [
      { value: null, label: "All" },
      ...(Object.keys(METHOD_PARAMS) as MethodParam[]).map((k) => ({ value: k, label: SOWING_METHOD_LABELS[METHOD_PARAMS[k]] })),
    ],
  },
  lifeCycle: {
    legend: "Life cycle",
    options: [{ value: null, label: "All" }, ...LIFE_CYCLE_PARAMS.map((k) => ({ value: k, label: LIFE_CYCLE_LABELS[k] }))],
  },
  hue: {
    legend: "Hue",
    options: [{ value: null, label: "All" }, ...COLOR_FAMILIES.map((f) => ({ value: f, label: COLOR_FAMILY_LABELS[f], hue: f }))],
  },
  // An attribute of the variety's sellers, not of the variety — its own
  // group, last. Plain text chips: the mark is NOT inside the filter chip;
  // the legend line under this strip is where the badge appears beside the
  // filter.
  smallFarm: {
    legend: "Sellers",
    options: [
      { value: null, label: "All" },
      { value: "true", label: SMALL_FARM_CHIP_LABEL },
    ],
  },
};

/* ── The per-option count matrix ── */

/**
 * One chip's count from a computed ApiBrowseCounts: value null is the
 * group's "All" chip, otherwise the option's URL value ("true" for the
 * sellers on-chip).
 */
export function countFor(counts: ApiBrowseCounts, group: BrowseFilterGroup, value: string | null): number {
  switch (group) {
    case "season":
      return value === null ? counts.season.all : counts.season.options[value as SeasonParam];
    case "method":
      return value === null ? counts.method.all : counts.method.options[value as MethodParam];
    case "lifeCycle":
      return value === null ? counts.lifeCycle.all : counts.lifeCycle.options[value as LifeCycleParam];
    case "hue":
      return value === null ? counts.hue.all : counts.hue.options[value as ColorFamily];
    case "smallFarm":
      return value === null ? counts.smallFarm.all : counts.smallFarm.on;
  }
}

/**
 * One chip's count as the filter state to total: the §2.4 matrix over
 * states instead of repository filters, so every surface maps each state
 * through its own total query (varieties, search). Option null is the
 * group's "All" chip; otherwise the option's URL value ("true" for the
 * sellers on-chip).
 */
export interface BrowseCountState {
  group: BrowseFilterGroup;
  option: string | null;
  state: BrowseFilterState;
}

/**
 * The state a chip's count totals: "All" clears its group, others held; a
 * single-select option assigns (overwriting — clearing first is the same
 * transition); a multi-select hue family toggles from its current state
 * (PB-2). Shared by the matrix and the hydrated tap path, so counts and
 * taps can never disagree on what an option means.
 */
export function countStateFor(
  state: BrowseFilterState,
  group: BrowseFilterGroup,
  option: string | null,
  hueMode: HueMode,
): BrowseFilterState {
  if (option === null) return clearGroup(state, group);
  if (group === "hue" && hueMode === "multi") return toggleHue(state, option as ColorFamily);
  return withGroup(state, group, option);
}

/**
 * The per-option count matrix for a filter state, as states: every rendered
 * chip's count is the surface's total under the mapped state. Groups emit
 * in the given order, "All" first per group. Zero-count options keep their
 * 0 and stay operable — the matrix never drops an option.
 */
export function browseCountStates(
  state: BrowseFilterState,
  groups: BrowseFilterGroup[],
  hueMode: HueMode,
): BrowseCountState[] {
  const out: BrowseCountState[] = [];
  for (const g of groups) {
    out.push({ group: g, option: null, state: countStateFor(state, g, null, hueMode) });
    for (const o of BROWSE_OPTIONS[g].options) {
      if (o.value === null) continue;
      out.push({ group: g, option: o.value, state: countStateFor(state, g, o.value, hueMode) });
    }
  }
  return out;
}
