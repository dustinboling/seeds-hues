/**
 * Crop-detail filter model — ported from v2/lib/crop-detail.ts (same
 * vocabulary, state, URL encoding, and per-option count semantics): the ONE
 * home of the crop page's filter meaning, shared by the server page, the
 * read-side count builder, and the hydrated in-place layer, so the three
 * can never disagree on what a filter state means.
 *
 * Groups (in order): sellers (tri-state has_sellers), hue (multi-select),
 * series (single-select, dynamic per crop). URL parameters keep their
 * shipped names and meanings: color_family (a comma list for the
 * multi-select set, single values serialize exactly as before), series (a
 * series slug), has_sellers ("true"/"false").
 *
 * Strictness (Bea §3.4 — deliberate, unlike the browse pages' forgiving
 * parse): a color_family value failing the API's pattern, or a has_sellers
 * value other than exactly "true"/"false", 404s (cropDetailParamsValid —
 * the route's gate). Vocabulary forgiveness stays: a pattern-clean hue
 * outside the vocabulary is ignored, and an unknown series slug is kept
 * (filtering honestly to zero).
 *
 * Client-safe by construction: the only runtime imports are lib/browse
 * (vocabulary), lib/format (plural), and lib/legacy (slug) — pure data
 * and string helpers.
 */
import {
  BROWSE_SORT_PHRASE,
  COLOR_FAMILIES,
  COLOR_FAMILY_LABELS,
  documentTitleFor,
  parseSortParam,
  titlePageSuffix,
  type BrowseSortParam,
  type ColorFamily,
} from "./browse";
import { plural, shortCommonName } from "./format";
import { legacySlug } from "./legacy";
import type { ApiCropDetailCounts, ApiVarietyListItem } from "../data/types";

/** A crop hue family: the shared vocabulary plus "unknown" (the column default, a real option here). */
export type CropHue = ColorFamily | "unknown";

/** Canonical hue order: the shared vocabulary's order, unknown last — stable URLs. */
export const CROP_HUE_ORDER: readonly CropHue[] = [...COLOR_FAMILIES, "unknown"] as const;

/** Display label for a crop hue (Unknown for the column default). */
export function cropHueLabel(family: CropHue): string {
  return family === "unknown" ? "Unknown" : COLOR_FAMILY_LABELS[family];
}

/**
 * A crop's distinct color families (repository strings) as its rendered
 * hue options: kept in canonical order, values outside the vocabulary
 * dropped (they could never be selected — the parser ignores them — so
 * rendering them would be a dead chip).
 */
export function cropHuesForFamilies(families: string[]): CropHue[] {
  const set = new Set(families);
  return CROP_HUE_ORDER.filter((f) => set.has(f));
}

/**
 * The crop page's active filters. Hue is multi-select (any set, OR within
 * — [] = All). Sort rides the same state but is NOT a filter group: it
 * has no counts column, no remover, and never shows the applied row.
 */
export interface CropDetailFilterState {
  hue: CropHue[];
  series: string | null;
  hasSellers: boolean | null;
  /** The list order (?sort=): resting "name". */
  sort: BrowseSortParam;
}

export type CropDetailGroup = "sellers" | "hue" | "series";

/** Group order on the crop page (the settled order — sellers first, series last). */
export const CROP_DETAIL_GROUPS: readonly CropDetailGroup[] = ["sellers", "hue", "series"] as const;

/** Eyebrow legend per group (the inline labels). */
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
 * Clear all: every filter group to All — the shopper's sort survives (sort
 * is an ordering, not a filter group, so resetting groups never re-orders
 * the list).
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
 * Multi-select hue toggle: the family joins or leaves the set; the set
 * stays in canonical order so equal sets always serialize to equal URLs.
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
 * The filter params to carry on links (e.g. pagination) — only the active
 * groups, plus a non-resting ?sort= (resting "name" serializes to the
 * absent param).
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
 * Link for a filter state: ?page= is never carried (a changed filter
 * starts at page 1). The server chips AND the hydrated layer's History API
 * update share this, so the two can never disagree on the shareable URL.
 */
export function cropDetailHref(basePath: string, state: CropDetailFilterState): string {
  const p = new URLSearchParams(cropFilterParams(state));
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Link for one chip: the state with that option applied. On hue the
 * family toggles (null clears the set); on sellers/series the value
 * assigns (null clears the group).
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
 * ?color_family= for crop detail (multi): a comma list and/or repeated
 * params; unknown families are ignored, the set is deduped into canonical
 * order ([] = all hues). Accepts the shared vocabulary plus "unknown" (the
 * column default, a real option on this surface).
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
 * ?series= for crop detail: any valid slug (forgiving — invalid shapes are
 * All). Unknown slugs (not this crop's series) are kept, not ignored: they
 * filter honestly to zero.
 */
export function parseCropSeriesParam(raw: RawParam): string | null {
  return legacySlug(raw);
}

/**
 * ?has_sellers= for crop detail: exactly "true" or "false" (first value
 * wins on repeats); anything else — absent, garbage — is All.
 */
export function parseCropHasSellersParam(raw: RawParam): boolean | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

/** SearchParams → filter state (the crop page is a sorted surface, so ?sort= parses — forgiving, never a 404). */
export function readCropDetailFilters(sp: Record<string, string | string[] | undefined>): CropDetailFilterState {
  return {
    hue: parseCropHueParam(sp.color_family),
    series: parseCropSeriesParam(sp.series),
    hasSellers: parseCropHasSellersParam(sp.has_sellers),
    sort: parseSortParam(sp.sort),
  };
}

/** A live `location.search` string as a searchParams-shaped record (repeats stay arrays). */
function searchToRecord(search: string): Record<string, string | string[] | undefined> {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = (key: string): RawParam => {
    const all = q.getAll(key);
    return all.length > 1 ? all : (all[0] as string | undefined);
  };
  return { color_family: raw("color_family"), series: raw("series"), has_sellers: raw("has_sellers"), sort: raw("sort") };
}

/**
 * Client-side mirror of readCropDetailFilters: reads the filter state back
 * from a live `location.search` string (a leading "?" is tolerated). The
 * hydrated layer's popstate handler re-syncs through this, so Back/Forward
 * apply the same rule as first load.
 */
export function cropDetailFiltersFromSearch(search: string): CropDetailFilterState {
  return readCropDetailFilters(searchToRecord(search));
}

/* ── Strict validation (Bea §3.4 — the route's gate; malformed values 404) ── */

/** One color_family value's pattern (v2's API listParam pattern, verbatim). */
const COLOR_FAMILY_VALUE = /^[a-z_-]{1,40}$/;

/**
 * True when the crop page's filter params are well-formed. Absent and
 * empty values read as absent (the v2 API's boolParam/listParam rule);
 * every non-empty color_family comma-part must match the API pattern, and
 * a non-empty first has_sellers value must be exactly "true"/"false".
 * Pattern-clean hues outside the vocabulary stay forgiving (the parser
 * ignores them) — only the shape is strict.
 */
export function cropDetailParamsValid(sp: Record<string, string | string[] | undefined>): boolean {
  const hueRaw = sp.color_family;
  if (hueRaw !== undefined) {
    const values = Array.isArray(hueRaw) ? hueRaw : [hueRaw];
    for (const v of values) {
      for (const part of v.split(",")) {
        const f = part.trim();
        if (f === "") continue;
        if (!COLOR_FAMILY_VALUE.test(f)) return false;
      }
    }
  }
  const sellersRaw = sp.has_sellers;
  if (sellersRaw !== undefined) {
    const first = Array.isArray(sellersRaw) ? sellersRaw[0] : sellersRaw;
    if (first !== "" && first !== undefined && first !== "true" && first !== "false") return false;
  }
  return true;
}

/* ── Narrowing (AND across groups; OR within hue) ── */

/** True when the variety satisfies every active group (AND, always). */
export function varietyMatchesCrop(v: ApiVarietyListItem, state: CropDetailFilterState): boolean {
  if (state.hue.length > 0 && !state.hue.includes(v.colorFamily as CropHue)) return false;
  if (state.series !== null && v.series?.slug !== state.series) return false;
  if (state.hasSellers !== null && (v.listingCount > 0) !== state.hasSellers) return false;
  return true;
}

/** The crop's full set narrowed by a state (a new array; the input is never mutated). */
export function narrowCropVarieties(items: ApiVarietyListItem[], state: CropDetailFilterState): ApiVarietyListItem[] {
  return items.filter((v) => varietyMatchesCrop(v, state));
}

/* ── Labels, count line, removers ── */

/**
 * The crop-detail result-count line: the match count ("N varieties match"
 * when narrowed, the bare "N varieties" at rest), the ordering phrase, and
 * the page echo when paged. The server page and the hydrated swap share
 * this builder (the element stays, the live region never remounts).
 */
export function cropDetailCountLine(state: CropDetailFilterState, total: number, page: number, pages: number): string {
  return `${plural(total, "variety", "varieties")}${hasActiveCropFilters(state) ? " match" : ""}, ${BROWSE_SORT_PHRASE[state.sort]}.${pages > 1 ? ` Page ${page} of ${pages}.` : ""}`;
}

/**
 * The crop page title's facts: everything the title needs beyond the page
 * number. The title never names the active filters — only the crop and the
 * page suffix — so an in-place commit changes it exactly when the page
 * resets from N > 1 to 1.
 */
export interface CropDetailTitleFacts {
  commonName: string;
  latinName: string | null;
  varietyCount: number;
  varietiesWithSellers: number;
}

/**
 * The crop page title the server renders for a page: the crop's seed line
 * plus the page suffix. The head builder and the in-place title sync share
 * this, so SSR and in-place titles can never disagree.
 */
export function cropDetailTitle(facts: CropDetailTitleFacts, page: number): string {
  const common = shortCommonName(facts.commonName);
  return `${common} Seeds${facts.latinName ? ` (${facts.latinName})` : ""} — ${plural(facts.varietyCount, "Variety", "Varieties")}, ${facts.varietiesWithSellers} With Sellers${titlePageSuffix(page)}`;
}

/** The crop page document.title for a committed page. */
export function cropDetailDocumentTitle(facts: CropDetailTitleFacts, page: number): string {
  return documentTitleFor(cropDetailTitle(facts, page));
}

/**
 * One applied-row remover: its stable key, its visible label ("{Group}:
 * {Value}"), its accessible name ("Remove the {Group} filter, {Value}"),
 * and the clearing transition — a function of the state it applies to, so
 * rapid taps always clear from the latest intent, never from a stale
 * render. One remover per selected hue family.
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

/* ── The per-option count matrix (read-side over one walked set) ── */

/**
 * One chip's count from a computed ApiCropDetailCounts: value null is the
 * group's "All" chip, otherwise the option's URL value (sellers
 * "true"/"false", hue family, series slug).
 */
export function cropCountFor(counts: ApiCropDetailCounts, group: CropDetailGroup, value: string | null): number {
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
 * The state a chip's count totals: "All" clears its group, others held; a
 * single-select option assigns; a multi-select hue family toggles from its
 * current state. Shared by the matrix and the hydrated tap path, so counts
 * and taps can never disagree on what an option means.
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
 * The per-option count matrix for a filter state over the walked set:
 * every rendered chip's count is the surface's total under the mapped
 * state. Groups emit in the settled order, "All" first per group.
 * Zero-count options keep their 0 and stay operable — the matrix never
 * drops an option. Hues/series are the crop's rendered options (dynamic
 * per crop).
 */
export function cropDetailCountsFor(
  items: ApiVarietyListItem[],
  state: CropDetailFilterState,
  hues: CropHue[],
  series: string[],
): ApiCropDetailCounts {
  const total = (s: CropDetailFilterState): number => narrowCropVarieties(items, s).length;
  const one = (group: CropDetailGroup, option: string | null): number => total(cropCountStateFor(state, group, option));
  const hueOptions: Record<string, number> = {};
  for (const h of hues) hueOptions[h] = one("hue", h);
  const seriesOptions: Record<string, number> = {};
  for (const s of series) seriesOptions[s] = one("series", s);
  return {
    sellers: { all: one("sellers", null), has: one("sellers", "true"), none: one("sellers", "false") },
    hue: { all: one("hue", null), options: hueOptions },
    series: { all: one("series", null), options: seriesOptions },
  };
}

/**
 * Strict narrowing for the crop-detail counts shape (the schema's mirror,
 * without zod — client-safe). A 0 is a valid count, never a missing one;
 * malformed means the failure path, never broken chips.
 */
export function isCropDetailCountsPayload(value: unknown): value is ApiCropDetailCounts {
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
