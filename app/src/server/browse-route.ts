/**
 * The browse/search routes' request-time decisions: strict ?page= parsing
 * (true 404s), forgiving filter parsing, the cached browse/search reads,
 * and the range check. The Vike +data hooks are thin throws over these
 * (render(404) for unknowns); the unit suite drives them directly against
 * the fake catalog and the HTTP suite proves the wire behavior.
 *
 * Static redirects NEVER live here: ?page=1, plural legacy paths, and
 * legacy ?v=/?s= slugs throw from +onBeforeRoute (redirects.ts) before
 * routing — so these resolvers treat ?page=1 as page 1 and never see a
 * legacy slug.
 */
import type { CatalogApi } from "../data/api";
import type { DataCache } from "../data/cache";
import {
  getCatalogApi,
  getDataCache,
  loadSearchResults,
  loadSellerBrowse,
  loadSellerStates,
  loadVarietyBrowse,
  type SearchBrowseData,
  type SellerBrowseData,
  type VarietyBrowseData,
} from "../data/load";
import { parseSearchQueryParam, readBrowseFilters, readBrowseFiltersForGroups } from "../lib/browse";
import { pageInRange, parsePageParam, type RawParam } from "../lib/paging";
import { readSellerBrowseFilters } from "../lib/seller-browse";

/** A live query string as a page-query-shaped record (repeats stay arrays — first wins, v2's rule). */
function searchToParams(search: string): Record<string, string | string[] | undefined> {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(q.keys())) {
    const all = q.getAll(key);
    out[key] = all.length > 1 ? all : (all[0] as string | undefined);
  }
  return out;
}

export type VarietyBrowseResult = { kind: "ok"; data: VarietyBrowseData } | { kind: "notFound" };

export async function resolveVarietyBrowse(
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
  request: { search: string },
): Promise<VarietyBrowseResult> {
  const sp: Record<string, RawParam> = searchToParams(request.search);
  const page = parsePageParam(sp.page);
  if (page === null) return { kind: "notFound" };
  const data = await loadVarietyBrowse(readBrowseFilters(sp, "multi"), page, api, cache);
  if (!pageInRange(page, data.total)) return { kind: "notFound" };
  return { kind: "ok", data };
}

export type SellerBrowseResult = { kind: "ok"; data: SellerBrowseData } | { kind: "notFound" };

export async function resolveSellerBrowse(
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
  request: { search: string },
): Promise<SellerBrowseResult> {
  const sp: Record<string, RawParam> = searchToParams(request.search);
  const page = parsePageParam(sp.page);
  if (page === null) return { kind: "notFound" };
  // The states list parses ?state= (unknown codes read as All states —
  // forgiving, never a 404) AND renders the cloud; one cached read serves both.
  const states = await loadSellerStates(api, cache);
  const data = await loadSellerBrowse(readSellerBrowseFilters(sp, states), page, api, cache);
  if (!pageInRange(page, data.total)) return { kind: "notFound" };
  return { kind: "ok", data };
}

/** Search never 404s: an empty result set is a 200 with the zero-results state. */
export type SearchBrowseResult = { kind: "ok"; data: SearchBrowseData } | { kind: "empty"; q: ""; filters: SearchBrowseData["state"] };

export async function resolveSearch(
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
  request: { search: string },
): Promise<SearchBrowseResult> {
  const sp: Record<string, RawParam> = searchToParams(request.search);
  const q = parseSearchQueryParam(sp.q);
  // /search stays single-select hue with four groups; the sort holds at rest.
  const filters = readBrowseFiltersForGroups(sp, ["season", "method", "lifeCycle", "hue"], "single");
  if (!q) return { kind: "empty", q: "", filters };
  const data = await loadSearchResults(q, filters, api, cache);
  return { kind: "ok", data };
}
