/**
 * Crop-detail filter model (Tranche 3.1b-2): the ONE home of the crop page's filter
 * vocabulary, state, URL encoding, and per-option count semantics — shared by the server
 * page, the /api/browse/crops/[slug] payload builder, and the hydrated in-place layer, so
 * the three can never disagree on what a filter state means.
 *
 * Groups (in order): sellers (tri-state has_sellers), hue (multi-select, PB-2), series
 * (single-select, dynamic per crop). URL parameters keep their shipped names and meanings:
 * color_family (now a comma list for the multi-select set, single values serialize exactly
 * as before), series (a series slug), has_sellers ("true"/"false"). Parsing is forgiving
 * (unknown values ignored, never a 404) like every other browse surface — the page's
 * soft-404 guards remain for bad slugs and pages past the end only.
 *
 * Client-safe by construction: the only runtime imports are lib/browse (vocabulary),
 * lib/format (plural) and lib/legacy (slug) — pure data and string helpers. The Zod-inferred
 * counts type comes back as `import type` (erased at build).
 */
import {
  BROWSE_SORT_PHRASE,
  COLOR_FAMILIES,
  COLOR_FAMILY_LABELS,
  parseSortParam,
  type BrowseSortParam,
  type ColorFamily,
} from "@/lib/browse";
import { plural } from "@/lib/format";
import { legacySlug } from "@/lib/legacy";
import type { VarietyFilters } from "@/lib/repositories/catalog-read";
import type { CropDetailCounts } from "@/lib/validators";

/** A crop hue family: the shared vocabulary plus "unknown" (the column default, a real option here). */
export type CropHue = ColorFamily | "unknown";

/** Canonical hue order: the shared vocabulary's order, unknown last — stable URLs. */
export const CROP_HUE_ORDER: readonly CropHue[] = [...COLOR_FAMILIES, "unknown"] as const;

/** Display label for a crop hue (Unknown for the column default). */
export function cropHueLabel(family: CropHue): string {
  return family === "unknown" ? "Unknown" : COLOR_FAMILY_LABELS[family];
}

/**
 * A crop's distinct color families (repository strings) as its rendered hue options: kept in
 * canonical order, values outside the vocabulary dropped (they could never be selected — the
 * parser ignores them — so rendering them would be a dead chip).
 */
export function cropHuesForFamilies(families: string[]): CropHue[] {
  const set = new Set(families);
  return CROP_HUE_ORDER.filter((f) => set.has(f));
}

/**
 * The crop page's active filters. Hue is multi-select (PB-2: any set, OR within — [] = All).
 * Sort rides the same state (Tranche 3.4 §5.2) but is NOT a filter group: it has no counts
 * column, no remover, and never shows the applied row.
 */
export interface CropDetailFilterState {
  hue: CropHue[];
  series: string | null;
  hasSellers: boolean | null;
  /** The list order (?sort=): resting "name" (PB-1). */
  sort: BrowseSortParam;
}

export type CropDetailGroup = "sellers" | "hue" | "series";

/** Group order on the crop page (the settled order — sellers first, series last). */
export const CROP_DETAIL_GROUPS: readonly CropDetailGroup[] = ["sellers", "hue", "series"] as const;

/** Eyebrow legend per group (the inline labels, promoted — register B-3). */
export const CROP_DETAIL_LEGENDS: Record<CropDetailGroup, string> = {
  sellers: "Sellers",
  hue: "Hue",
  series: "Series",
};

/** Query-param name per group (the shipped names, unchanged). */
export const CROP_DETAIL_PARAM: Record<CropDetailGroup, string> = {
  sellers: "has_sellers",
  hue: "color_family",
  series: "series",
};

/** Sellers option labels (the shipped chip words). */
export const CROP_SELLERS_LABELS = { has: "Has sellers", none: "No seller yet" } as const;

/**
 * Clear all: every filter group to All — the shopper's sort survives (SPEC §2.6: sort is
 * an ordering, not a filter group, so resetting groups never re-orders the list).
 */
export function clearCropDetailFilters(state: CropDetailFilterState): CropDetailFilterState {
  return { hue: [], series: null, hasSellers: null, sort: state.sort };
}

/** True when the group narrows the list. */
export function isCropGroupActive(state: CropDetailFilterState, g: CropDetailGroup): boolean {
  if (g === "hue") return state.hue.length > 0;
  if (g === "sellers") return state.hasSellers !== null;
  return state.series !== null;
}

/** True when at least one group is active (the applied row shows iff this is true). */
export function hasActiveCropFilters(state: CropDetailFilterState): boolean {
  return state.hue.length > 0 || state.series !== null || state.hasSellers !== null;
}

/** The group cleared to its "All" state. */
export function clearCropGroup(state: CropDetailFilterState, g: CropDetailGroup): CropDetailFilterState {
  if (g === "hue") return { ...state, hue: [] };
  if (g === "sellers") return { ...state, hasSellers: null };
  return { ...state, series: null };
}

/**
 * Multi-select hue toggle (PB-2): the family joins or leaves the set; the set stays in
 * canonical order so equal sets always serialize to equal URLs.
 */
export function toggleCropHue(state: CropDetailFilterState, family: CropHue): CropDetailFilterState {
  const set = new Set<CropHue>(state.hue);
  if (set.has(family)) set.delete(family);
  else set.add(family);
  return { ...state, hue: CROP_HUE_ORDER.filter((f) => set.has(f)) };
}

/** The hue family leaves the set (idempotent — removing an absent family is a no-op). */
export function removeCropHue(state: CropDetailFilterState, family: CropHue): CropDetailFilterState {
  return state.hue.includes(family) ? { ...state, hue: state.hue.filter((h) => h !== family) } : state;
}

/** Whether the option reads active: single equality, or set membership on multi hue. */
export function isCropOptionActive(state: CropDetailFilterState, g: CropDetailGroup, value: string | null): boolean {
  if (g === "hue") {
    return value === null ? state.hue.length === 0 : state.hue.includes(value as CropHue);
  }
  if (g === "sellers") {
    const current = state.hasSellers === null ? null : String(state.hasSellers);
    return value === current;
  }
  return value === state.series;
}

/** Structural equality (hue compared as a set — order never distinguishes states). */
export function equalCropDetailFilters(a: CropDetailFilterState, b: CropDetailFilterState): boolean {
  return (
    a.series === b.series &&
    a.hasSellers === b.hasSellers &&
    a.sort === b.sort &&
    a.hue.length === b.hue.length &&
    a.hue.every((h) => b.hue.includes(h))
  );
}

/* ── URL ── */

/**
 * The filter params to carry on links (e.g. pagination) — only the active groups, plus a
 * non-resting ?sort= (resting "name" serializes to the absent param, PB-1's fallback meaning).
 */
export function cropFilterParams(state: CropDetailFilterState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.hue.length) out[CROP_DETAIL_PARAM.hue] = state.hue.join(",");
  if (state.series) out[CROP_DETAIL_PARAM.series] = state.series;
  if (state.hasSellers !== null) out[CROP_DETAIL_PARAM.sellers] = String(state.hasSellers);
  if (state.sort !== "name") out.sort = state.sort;
  return out;
}

/**
 * Link for a filter state: ?page= is never carried (a changed filter starts at page 1).
 * The server chips AND the hydrated layer's History API update share this, so the two can
 * never disagree on the shareable URL.
 */
export function cropDetailHref(basePath: string, state: CropDetailFilterState): string {
  const p = new URLSearchParams(cropFilterParams(state));
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Link for one chip: the state with that option applied. On hue the family toggles (null
 * clears the set); on sellers/series the value assigns (null clears the group).
 */
export function cropChipHref(
  basePath: string,
  state: CropDetailFilterState,
  group: CropDetailGroup,
  value: string | null,
): string {
  return cropDetailHref(basePath, cropCountStateFor(state, group, value));
}

/* ── Parsing (page query → state; forgiving — unknown values ignored, never a 404) ── */

type RawParam = string | string[] | undefined;

/**
 * ?color_family= for crop detail (multi): a comma list and/or repeated params; unknown
 * families are ignored, the set is deduped into canonical order ([] = all hues). Accepts the
 * shared vocabulary plus "unknown" (the column default, a real option on this surface).
 */
export function parseCropHueParam(raw: RawParam): CropHue[] {
  const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const set = new Set<CropHue>();
  for (const v of values) {
    for (const part of v.split(",")) {
      const f = part.trim();
      if ((CROP_HUE_ORDER as readonly string[]).includes(f)) set.add(f as CropHue);
    }
  }
  return CROP_HUE_ORDER.filter((f) => set.has(f));
}

/**
 * ?series= for crop detail: any valid slug (forgiving — invalid shapes are All). Unknown
 * slugs (not this crop's series) are kept, not ignored: they filter honestly to zero.
 */
export function parseCropSeriesParam(raw: RawParam): string | null {
  return legacySlug(raw);
}

/**
 * ?has_sellers= for crop detail: exactly "true" or "false" (first value wins on repeats);
 * anything else — absent, garbage — is All.
 */
export function parseCropHasSellersParam(raw: RawParam): boolean | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

/**
 * Next searchParams → filter state. The crop page and /api/browse/crops/[slug] share this
 * (the crop page is a sorted surface, so ?sort= parses — forgiving, never a 404).
 */
export function readCropDetailFilters(sp: Record<string, string | string[] | undefined>): CropDetailFilterState {
  return {
    hue: parseCropHueParam(sp.color_family),
    series: parseCropSeriesParam(sp.series),
    hasSellers: parseCropHasSellersParam(sp.has_sellers),
    sort: parseSortParam(sp.sort),
  };
}

/** A live `location.search` string as a Next-searchParams-shaped record (repeats stay arrays). */
function searchToRecord(search: string): Record<string, string | string[] | undefined> {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = (key: string): RawParam => {
    const all = q.getAll(key);
    return all.length > 1 ? all : (all[0] as string | undefined);
  };
  return { color_family: raw("color_family"), series: raw("series"), has_sellers: raw("has_sellers"), sort: raw("sort") };
}

/**
 * Client-side mirror of readCropDetailFilters: reads the filter state back from a live
 * `location.search` string (a leading "?" is tolerated). The hydrated layer's popstate
 * handler re-syncs through this, so Back/Forward apply the same rule as first load.
 */
export function cropDetailFiltersFromSearch(search: string): CropDetailFilterState {
  return readCropDetailFilters(searchToRecord(search));
}

/* ── Labels, count line, removers ── */

/**
 * The crop-detail result-count line: the match count ("N varieties match" when narrowed, the
 * bare "N varieties" at rest), the ordering phrase (Tranche 3.4 §5.2 — following the active
 * sort, never "alphabetical" under another order), and the page echo when paged. The server
 * page and the hydrated swap share this builder (the element stays, the live region never
 * remounts).
 */
export function cropDetailCountLine(state: CropDetailFilterState, total: number, page: number, pages: number): string {
  return `${plural(total, "variety", "varieties")}${hasActiveCropFilters(state) ? " match" : ""}, ${BROWSE_SORT_PHRASE[state.sort]}.${pages > 1 ? ` Page ${page} of ${pages}.` : ""}`;
}

/**
 * One applied-row remover: its stable key, its visible label ("{Group}: {Value}" per §2.6.1),
 * its accessible name ("Remove the {Group} filter, {Value}" per §2.6.2), and the clearing
 * transition — a function of the state it applies to, so rapid taps always clear from the
 * latest intent, never from a stale render. One remover per selected hue family.
 */
export interface CropDetailRemover {
  key: string;
  label: string;
  removeLabel: string;
  clear: (state: CropDetailFilterState) => CropDetailFilterState;
}

/** The applied row's removers for a state, in group order (hue families in set order). */
export function cropRemoversFor(
  state: CropDetailFilterState,
  opts: { seriesName: (slug: string) => string },
): CropDetailRemover[] {
  const remover = (
    key: string,
    group: CropDetailGroup,
    value: string,
    clear: (s: CropDetailFilterState) => CropDetailFilterState,
  ): CropDetailRemover => {
    const g = CROP_DETAIL_LEGENDS[group];
    return { key, label: `${g}: ${value}`, removeLabel: `Remove the ${g} filter, ${value}`, clear };
  };
  const out: CropDetailRemover[] = [];
  if (state.hasSellers !== null) {
    const value = state.hasSellers ? CROP_SELLERS_LABELS.has : CROP_SELLERS_LABELS.none;
    out.push(remover("sellers", "sellers", value, (s) => clearCropGroup(s, "sellers")));
  }
  for (const h of state.hue) {
    out.push(remover(`hue:${h}`, "hue", cropHueLabel(h), (s) => removeCropHue(s, h)));
  }
  if (state.series) {
    out.push(remover("series", "series", opts.seriesName(state.series), (s) => clearCropGroup(s, "series")));
  }
  return out;
}

/* ── Repository mapping + the per-option count matrix ── */

/** Crop-detail state → the repository's VarietyFilters for one crop (the service adds plant). */
export function cropVarietyFiltersFromState(state: CropDetailFilterState): Pick<VarietyFilters, "colorFamily" | "series" | "hasListings"> {
  return {
    colorFamily: state.hue.length ? [...state.hue] : undefined,
    series: state.series ? [state.series] : undefined,
    hasListings: state.hasSellers ?? undefined,
  };
}

/**
 * One chip's count from a computed CropDetailCounts: value null is the group's "All" chip,
 * otherwise the option's URL value (sellers "true"/"false", hue family, series slug).
 */
export function cropCountFor(counts: CropDetailCounts, group: CropDetailGroup, value: string | null): number {
  if (group === "sellers") {
    if (value === null) return counts.sellers.all;
    if (value === "true") return counts.sellers.has;
    return counts.sellers.none;
  }
  if (group === "hue") {
    return value === null ? counts.hue.all : (counts.hue.options[value] ?? 0);
  }
  return value === null ? counts.series.all : (counts.series.options[value] ?? 0);
}

/**
 * One count query: the state to total. Option null is the group's "All" chip; otherwise the
 * option's URL value (sellers "true"/"false", hue family, series slug).
 */
export interface CropCountState {
  group: CropDetailGroup;
  option: string | null;
  state: CropDetailFilterState;
}

/**
 * The state a chip's count totals: "All" clears its group, others held; a single-select
 * option assigns; a multi-select hue family toggles from its current state (PB-2). Shared by
 * the matrix and the hydrated tap path, so counts and taps can never disagree on what an
 * option means.
 */
export function cropCountStateFor(
  state: CropDetailFilterState,
  group: CropDetailGroup,
  option: string | null,
): CropDetailFilterState {
  if (option === null) return clearCropGroup(state, group);
  if (group === "hue") return toggleCropHue(state, option as CropHue);
  if (group === "sellers") return { ...state, hasSellers: option === "true" };
  return { ...state, series: option };
}

/**
 * The per-option count matrix for a filter state, as states: every rendered chip's count is
 * the surface's total under the mapped state. Groups emit in the settled order, "All" first
 * per group. Zero-count options keep their 0 and stay operable — the matrix never drops an
 * option. Hues/series are the crop's rendered options (dynamic per crop).
 */
export function cropCountStates(
  state: CropDetailFilterState,
  opts: { hues: CropHue[]; series: string[] },
): CropCountState[] {
  const out: CropCountState[] = [];
  out.push({ group: "sellers", option: null, state: cropCountStateFor(state, "sellers", null) });
  out.push({ group: "sellers", option: "true", state: cropCountStateFor(state, "sellers", "true") });
  out.push({ group: "sellers", option: "false", state: cropCountStateFor(state, "sellers", "false") });
  out.push({ group: "hue", option: null, state: cropCountStateFor(state, "hue", null) });
  for (const h of opts.hues) {
    out.push({ group: "hue", option: h, state: cropCountStateFor(state, "hue", h) });
  }
  out.push({ group: "series", option: null, state: cropCountStateFor(state, "series", null) });
  for (const s of opts.series) {
    out.push({ group: "series", option: s, state: cropCountStateFor(state, "series", s) });
  }
  return out;
}

/**
 * Strict narrowing for the crop-detail counts matrix (the schema's mirror, without zod —
 * client-safe). A 0 is a valid count, never a missing one; malformed means the failure path,
 * never broken chips.
 */
export function isCropDetailCountsPayload(value: unknown): value is CropDetailCounts {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const sellers = v.sellers as Record<string, unknown> | undefined;
  if (!sellers || typeof sellers.all !== "number" || typeof sellers.has !== "number" || typeof sellers.none !== "number") {
    return false;
  }
  for (const g of ["hue", "series"]) {
    const c = v[g] as Record<string, unknown> | undefined;
    if (!c || typeof c.all !== "number") return false;
    const opts = c.options as Record<string, unknown> | undefined;
    if (!opts || typeof opts !== "object" || Array.isArray(opts)) return false;
    for (const n of Object.values(opts)) if (typeof n !== "number") return false;
  }
  return true;
}
