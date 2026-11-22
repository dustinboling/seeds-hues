/**
 * Browse-filter model (Tranche 3.1a): the ONE home of the filter vocabulary, the filter state,
 * its URL encoding, and the per-option count semantics — shared by the server pages, the
 * /api/browse/varieties payload builder, and the hydrated in-place layer, so the three can
 * never disagree on what a filter state means.
 *
 * Client-safe by construction: the only runtime imports are lib/small-farm and lib/format
 * (pure data and string helpers). The Zod-inferred key types come back as `import type`
 * (erased at build), and lib/validators re-exports this module's vocabulary so every
 * existing `@/lib/validators` import keeps working.
 */
import { plural } from "@/lib/format";
import {
  SMALL_FARM_CHIP_LABEL,
  SMALL_FARM_FILTER_LABEL,
  SMALL_FARM_PARAM,
  parseSmallFarmParam,
} from "@/lib/small-farm";
import type { VarietyFilters } from "@/lib/repositories/catalog-read";
import type { BrowseCounts, SeasonClass, SowingMethod } from "@/lib/validators";

/* ── Vocabulary (moved verbatim from lib/validators, which re-exports it) ── */

/** Display labels for season classes (UI + docs). */
export const SEASON_LABELS: Record<SeasonClass, string> = {
  cool_season_hardy_annual: "Cool Season Hardy Annuals",
  warm_season_tender_annual: "Warm Season Tender Annuals",
};

/** Short query-param values (`?season=cool|warm`) ↔ season classes. */
export const SEASON_PARAMS = { cool: "cool_season_hardy_annual", warm: "warm_season_tender_annual" } as const;
export type SeasonParam = keyof typeof SEASON_PARAMS;

/** Display labels for sowing methods (UI + docs). */
export const SOWING_METHOD_LABELS: Record<SowingMethod, string> = {
  direct_sow: "Direct Sow",
  transplant: "Start indoors",
};

/** Short query-param values (`?method=direct|trays`) ↔ sowing methods. */
export const METHOD_PARAMS = { direct: "direct_sow", trays: "transplant" } as const;
export type MethodParam = keyof typeof METHOD_PARAMS;

/**
 * Life-cycle filter buckets (`?life_cycle=annual|biennial|perennial`): how the crop is grown,
 * derived from plants.life_cycle by lifeCycleBuckets() in lib/life-cycle.ts (never stored).
 */
export const LIFE_CYCLE_PARAMS = ["annual", "biennial", "perennial"] as const;
export type LifeCycleParam = (typeof LIFE_CYCLE_PARAMS)[number];
export const LIFE_CYCLE_LABELS: Record<LifeCycleParam, string> = { annual: "Annual", biennial: "Biennial", perennial: "Perennial" };

/**
 * Variety colour families ("Hue") — the ONE vocabulary for catalog input, filters and UI.
 * varieties.color_family also holds 'unknown' (the column default), which is never an input
 * value: a variety without a family is simply unknown.
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
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

/** Representative swatch per colour family (UI chips). mix = null: drawn as a conic gradient. */
export const COLOR_FAMILY_SWATCHES: Record<ColorFamily, string | null> = {
  white: "#F7F3E8",
  blush: "#F2C4CE",
  pink: "#E87A9E",
  peach: "#F5A97F",
  orange: "#E8813A",
  yellow: "#EFC93F",
  red: "#C03434",
  burgundy: "#7A2440",
  purple: "#8B6BAE",
  blue: "#5B7FBF",
  green: "#7A9A4D",
  chocolate: "#6B4A35",
  mix: null,
};

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

/* ── State ── */

/**
 * The active browse filters. Season, method and life cycle are single-select (null = "All");
 * Hue is multi-select (PB-2: any set of families, OR within — [] = "All"); smallFarm is a
 * boolean toggle. Single-select surfaces (every surface but /variety) hold at most one hue.
 */
export interface BrowseFilterState {
  season: SeasonParam | null;
  method: MethodParam | null;
  lifeCycle: LifeCycleParam | null;
  hue: ColorFamily[];
  /**
   * "Sellers" group (Open Directory, ux-spec §3): only varieties with at least one listing from a
   * seller carrying the Small farm badge. Shown on /variety only; every other surface passes false.
   */
  smallFarm: boolean;
}

export type BrowseFilterGroup = keyof BrowseFilterState;

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

/** No filters active. */
export function clearAllFilters(): BrowseFilterState {
  return { season: null, method: null, lifeCycle: null, hue: [], smallFarm: false };
}

/** True when the group narrows the list (non-All for singles, non-empty for hue, on for sellers). */
export function isGroupActive(state: BrowseFilterState, g: BrowseFilterGroup): boolean {
  if (g === "hue") return state.hue.length > 0;
  if (g === "smallFarm") return state.smallFarm;
  return state[g] !== null;
}

/** True when at least one group is active (the applied row shows iff this is true). */
export function hasActiveFilters(state: BrowseFilterState): boolean {
  return (
    state.season !== null || state.method !== null || state.lifeCycle !== null || state.hue.length > 0 || state.smallFarm
  );
}

/** The group cleared to its "All" state. */
export function clearGroup(state: BrowseFilterState, g: BrowseFilterGroup): BrowseFilterState {
  if (g === "hue") return { ...state, hue: [] };
  if (g === "smallFarm") return { ...state, smallFarm: false };
  return { ...state, [g]: null };
}

/**
 * Single-select assignment: value (its URL value) or null ("All"). On the hue group this sets a
 * one-element set — the single-select surfaces' only hue transition; /variety toggles instead.
 */
export function withGroup(state: BrowseFilterState, g: BrowseFilterGroup, value: string | null): BrowseFilterState {
  if (g === "hue") return { ...state, hue: value === null ? [] : [value as ColorFamily] };
  if (g === "smallFarm") return { ...state, smallFarm: value === "true" };
  return { ...state, [g]: value };
}

/**
 * Multi-select hue toggle (PB-2): the family joins or leaves the set; the set stays in
 * COLOR_FAMILIES order so equal sets always serialize to equal URLs.
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
    a.hue.length === b.hue.length &&
    a.hue.every((h) => b.hue.includes(h))
  );
}

/* ── URL ── */

/** The filter params to carry on links (e.g. pagination) — only the active groups. */
export function filterParams(state: BrowseFilterState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.season) out[BROWSE_PARAM.season] = state.season;
  if (state.method) out[BROWSE_PARAM.method] = state.method;
  if (state.lifeCycle) out[BROWSE_PARAM.lifeCycle] = state.lifeCycle;
  if (state.hue.length) out[BROWSE_PARAM.hue] = state.hue.join(",");
  if (state.smallFarm) out[BROWSE_PARAM.smallFarm] = "true";
  return out;
}

/**
 * Link for a filter state: the extra params (q on /search) are kept; ?page= is never carried
 * (a changed filter starts at page 1). The server chips AND the hydrated layer's History API
 * update share this, so the two can never disagree on the shareable URL.
 */
export function browseHref(basePath: string, state: BrowseFilterState, params: Record<string, string> = {}): string {
  const p = new URLSearchParams(params);
  p.delete("page");
  for (const [k, v] of Object.entries(filterParams(state))) p.set(k, v);
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Link for one chip: the state with that option applied. On a multi hue group the family
 * toggles (null clears the set); everywhere else the value assigns (null clears the group).
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

type RawParam = string | string[] | undefined;

/**
 * ?season= for list pages: "cool" | "warm", anything else is ignored (null = all seasons).
 * Unlike ?page=, an unknown value is not a 404 — the page just shows every season.
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

/** ?life_cycle= for list pages: "annual" | "biennial" | "perennial" (single-select); anything else is ignored (null = all). */
export function parseLifeCycleParam(raw: RawParam): LifeCycleParam | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && (LIFE_CYCLE_PARAMS as readonly string[]).includes(v) ? (v as LifeCycleParam) : null;
}

/**
 * ?color_family= for /variety (multi): a comma list and/or repeated params; unknown families
 * are ignored, the set is deduped into COLOR_FAMILIES order ([] = all hues). The API's
 * comma-list vocabulary, shared with the page URL.
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
 * ?color_family= for single-select surfaces (/search): exactly one family, today's rule
 * unchanged — the first raw value must be exactly one family, anything else (absent,
 * garbage, a comma list, a repeat) is All. /variety uses parseHueParam instead.
 */
export function parseHueParamSingle(raw: RawParam): ColorFamily | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v !== undefined && (COLOR_FAMILIES as readonly string[]).includes(v) ? (v as ColorFamily) : null;
}

/** Next searchParams → filter state. The /variety page and /api/browse/varieties share this. */
export function readBrowseFilters(
  sp: Record<string, string | string[] | undefined>,
  hueMode: HueMode,
): BrowseFilterState {
  const hue = hueMode === "multi" ? parseHueParam(sp.color_family) : parseHueParamSingle(sp.color_family);
  return {
    season: parseSeasonParam(sp.season),
    method: parseMethodParam(sp.method),
    lifeCycle: parseLifeCycleParam(sp.life_cycle),
    hue: hue === null ? [] : Array.isArray(hue) ? hue : [hue],
    smallFarm: parseSmallFarmParam(sp.small_farm),
  };
}

/**
 * Client-side mirror of readBrowseFilters: reads the filter state back from a live
 * `location.search` string (a leading "?" is tolerated). The hydrated layer's popstate
 * handler re-syncs through this, so Back/Forward apply the same rule as first load.
 */
export function browseFiltersFromSearch(search: string, hueMode: HueMode): BrowseFilterState {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = (key: string): RawParam => {
    const all = q.getAll(key);
    return all.length > 1 ? all : (all[0] as string | undefined);
  };
  return readBrowseFilters(
    { season: raw("season"), method: raw("method"), life_cycle: raw("life_cycle"), color_family: raw("color_family"), small_farm: raw("small_farm") },
    hueMode,
  );
}

/** Client-side forgiving ?page= mirror for the popstate page-mismatch check (missing/garbage → 1). */
export function browsePageFromSearch(search: string): number {
  const v = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("page");
  return v !== null && /^[1-9]\d{0,5}$/.test(v) ? Number(v) : 1;
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
 * The /variety result-count line. The server page and the hydrated swap share this builder, so
 * first paint and every in-place update word the line identically (the live region's text is
 * the announcement — it changes exactly once per committed change, in step with the rows).
 */
export function browseCountLine(state: BrowseFilterState, total: number, page: number, pages: number): string {
  return `${[plural(total, "variety", "varieties"), ...activeFilterLabels(state)].join(" · ")}, alphabetical.${pages > 1 ? ` Page ${page} of ${pages}.` : ""}`;
}

export interface BrowseOption {
  value: string | null;
  label: string;
  hue?: ColorFamily;
}

/**
 * One applied-row remover: its stable key, its label (the activeFilterLabels vocabulary), and
 * the clearing transition — a function of the state it applies to, so rapid taps always clear
 * from the latest intent, never from a stale render. One remover per selected hue family.
 */
export interface BrowseRemover {
  key: string;
  label: string;
  clear: (state: BrowseFilterState) => BrowseFilterState;
}

/** The hue family leaves the set (idempotent — removing an absent family is a no-op). */
export function removeHue(state: BrowseFilterState, family: ColorFamily): BrowseFilterState {
  return state.hue.includes(family)
    ? { ...state, hue: state.hue.filter((h) => h !== family) }
    : state;
}

/** The applied row's removers for a state, in group order (hue families in set order). */
export function removersFor(state: BrowseFilterState): BrowseRemover[] {
  const out: BrowseRemover[] = [];
  if (state.season) {
    out.push({ key: "season", label: SEASON_LABELS[SEASON_PARAMS[state.season]], clear: (s) => clearGroup(s, "season") });
  }
  if (state.method) {
    out.push({ key: "method", label: SOWING_METHOD_LABELS[METHOD_PARAMS[state.method]], clear: (s) => clearGroup(s, "method") });
  }
  if (state.lifeCycle) {
    out.push({ key: "lifeCycle", label: LIFE_CYCLE_LABELS[state.lifeCycle], clear: (s) => clearGroup(s, "lifeCycle") });
  }
  for (const h of state.hue) {
    out.push({ key: `hue:${h}`, label: COLOR_FAMILY_LABELS[h], clear: (s) => removeHue(s, h) });
  }
  if (state.smallFarm) {
    out.push({ key: "smallFarm", label: SMALL_FARM_FILTER_LABEL, clear: (s) => clearGroup(s, "smallFarm") });
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
  // An attribute of the variety's sellers, not of the variety — its own group, last (ux-spec §3.1).
  // Plain text chips: the mark is NOT inside the filter chip (RULING carry-over); the legend line
  // under this strip is where the badge appears beside the filter.
  smallFarm: {
    legend: "Sellers",
    options: [
      { value: null, label: "All" },
      { value: "true", label: SMALL_FARM_CHIP_LABEL },
    ],
  },
};

/* ── Repository mapping + the per-option count matrix ── */

/** Browse state → the repository's VarietyFilters (the service layer already takes lists). */
export function varietyFiltersFromBrowse(state: BrowseFilterState): VarietyFilters {
  return {
    season: state.season ? [SEASON_PARAMS[state.season]] : undefined,
    methods: state.method ? [METHOD_PARAMS[state.method]] : undefined,
    lifeCycle: state.lifeCycle ? [state.lifeCycle] : undefined,
    colorFamily: state.hue.length ? [...state.hue] : undefined,
    smallFarmOnly: state.smallFarm || undefined,
  };
}

/**
 * One count query: the repository filters whose total is the chip's count. option null is the
 * group's "All" chip; otherwise the option's URL value ("true" for the sellers on-chip).
 */
export interface BrowseCountQuery {
  group: BrowseFilterGroup;
  option: string | null;
  filters: VarietyFilters;
}

/**
 * One chip's count from a computed BrowseCounts: value null is the group's "All" chip,
 * otherwise the option's URL value ("true" for the sellers on-chip).
 */
export function countFor(counts: BrowseCounts, group: BrowseFilterGroup, value: string | null): number {
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
 * The per-option count matrix for a filter state — every chip's count as repository filters,
 * each counted by the same total query behind the results, so counts and results can never
 * disagree. Single-select option o of group G: the total with G = o, every other group held;
 * "All": the total with G cleared, others held. Hue (PB-2): the total if that family were
 * toggled from its current state, other groups held; "All" clears the set. Zero-count options
 * keep their 0 and stay operable — the matrix never drops an option.
 */
export function browseCountQueries(state: BrowseFilterState): BrowseCountQuery[] {
  const out: BrowseCountQuery[] = [];
  for (const g of ["season", "method", "lifeCycle", "smallFarm"] as const) {
    const base = clearGroup(state, g);
    out.push({ group: g, option: null, filters: varietyFiltersFromBrowse(base) });
    for (const o of BROWSE_OPTIONS[g].options) {
      if (o.value === null) continue;
      out.push({ group: g, option: o.value, filters: varietyFiltersFromBrowse(withGroup(base, g, o.value)) });
    }
  }
  out.push({ group: "hue", option: null, filters: varietyFiltersFromBrowse(clearGroup(state, "hue")) });
  for (const f of COLOR_FAMILIES) {
    out.push({ group: "hue", option: f, filters: varietyFiltersFromBrowse(toggleHue(state, f)) });
  }
  return out;
}
