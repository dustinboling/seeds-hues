/**
 * Route data loading: one API client + one version-aware cache per process,
 * shared by every prerender `+data` hook and machine-file generator in the
 * build. At build time the cache is cold, so every entry loads live from the
 * API; at request time (the production Worker) warm entries serve until
 * their max age or the revalidate hook purges them.
 *
 * Each loader records the page paths that render its data (the purge
 * routing): e.g. the crops list feeds / and /crop, so a variety/seller tag
 * (which fans out to both paths) purges it.
 */
import { createCatalogApi, type CatalogApi } from "./api";
import {
  compareVarietyAvailability,
  filterSearchGroups,
  joinsFromCorpus,
  orderVarieties,
  searchBrowseCounts,
  sellersInState,
  suggestCorrection,
  varietyBrowseCounts,
  varietyFieldsOf,
  varietyMatchesGroups,
} from "./browse";
import { createDataCache, type DataCache } from "./cache";
import { BROWSE_SORT_REPO, type BrowseFilterState } from "../lib/browse";
import { pageWindow, totalPages } from "../lib/paging";
import type { SellerBrowseState, SellerState, SellerStateOption } from "../lib/seller-browse";
import { stateByCode } from "../lib/states";
import { PAGE_SIZE } from "../site";
import type {
  ApiBrowseCounts,
  ApiCoverageItem,
  ApiCrop,
  ApiCropDetail,
  ApiRecentItem,
  ApiSearchResult,
  ApiSellerBrowseCounts,
  ApiSellerDetail,
  ApiSellerItem,
  ApiSeriesCrop,
  ApiSeriesDetail,
  ApiVarietyDetail,
  ApiVarietyListItem,
  CatalogCounts,
  OpenApiDoc,
  SyncSnapshotData,
} from "./types";

export const DEFAULT_API_BASE_URL = "https://seeds.hues.flowers/api/v1";

export function apiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.SEEDS_API_BASE ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

let sharedApi: CatalogApi | null = null;
let sharedApiBase = "";
let sharedCache: DataCache | null = null;

export function getCatalogApi(baseUrl: string = apiBaseUrl()): CatalogApi {
  if (!sharedApi || sharedApiBase !== baseUrl) {
    sharedApi = createCatalogApi({ baseUrl });
    sharedApiBase = baseUrl;
  }
  return sharedApi;
}

export function getDataCache(): DataCache {
  if (!sharedCache) sharedCache = createDataCache();
  return sharedCache;
}

/** Test seam: reset the process singletons. */
export function resetDataSingletons(): void {
  sharedApi = null;
  sharedApiBase = "";
  sharedCache = null;
}

export interface HomeData {
  counts: CatalogCounts;
  coverage: ApiCoverageItem[];
  recent: ApiRecentItem[];
  crops: ApiCrop[];
  cropsTotal: number;
}

async function loadSnapshot(api: CatalogApi, cache: DataCache): Promise<SyncSnapshotData> {
  return cache.get<SyncSnapshotData>(
    "snapshot",
    async () => {
      const res = await api.snapshot();
      if ("notModified" in res) throw new Error("snapshot: unexpected 304 on a cold cache");
      return { value: res.data, catalogSeq: res.data.catalog_seq, paths: ["/sitemap.xml"] };
    },
    // The snapshot backs counts + sitemap membership; it revalidates through
    // the sitemap/lastmod refresh path, not the page fan-out.
    3_600_000,
  );
}

export async function loadHomeData(api: CatalogApi = getCatalogApi(), cache: DataCache = getDataCache()): Promise<HomeData> {
  const [crops, coverage, recent, counts] = await Promise.all([
    cache.get("crops", async () => {
      const { items, total } = await api.listCrops();
      return { value: { items, total }, paths: ["/", "/crop", "/llms.txt"] };
    }),
    cache.get<ApiCoverageItem[]>("coverage", async () => ({ value: await api.coverage(), paths: ["/", "/llms.txt"] })),
    cache.get<ApiRecentItem[]>("recent", async () => ({ value: await api.recent(6), paths: ["/"] })),
    cache.get<CatalogCounts>("counts", async () => ({ value: await api.counts(() => loadSnapshot(api, cache)), paths: ["/", "/llms.txt"] })),
  ]);
  return { counts, coverage, recent, crops: crops.items, cropsTotal: crops.total };
}

export async function loadCropIndexData(api: CatalogApi = getCatalogApi(), cache: DataCache = getDataCache()): Promise<{ crops: ApiCrop[]; total: number }> {
  const crops = await cache.get("crops", async () => {
    const { items, total } = await api.listCrops();
    return { value: { items, total }, paths: ["/", "/crop", "/llms.txt"] };
  });
  return { crops: crops.items, total: crops.total };
}

export async function loadApiDocsData(api: CatalogApi = getCatalogApi(), cache: DataCache = getDataCache()): Promise<{ doc: OpenApiDoc }> {
  const doc = await cache.get<OpenApiDoc>("openapi", async () => ({ value: await api.openapi(), paths: ["/api-docs"] }));
  return { doc };
}

export { compareVarietyAvailability };

/**
 * One variety's detail through the shared cache (null included: unknown
 * slugs are cached negative until max age). The entry renders the variety
 * page and its small-farms variant, so a variety tag purges both — and it
 * registers its sellers' shop paths, so a seller tag purges it too (a
 * listing write fans out to both templates it joins, Bea §9).
 */
export async function loadVarietyDetail(
  slug: string,
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
): Promise<ApiVarietyDetail | null> {
  return cache.get<ApiVarietyDetail | null>(`variety:detail:${slug}`, async () => {
    const detail = await api.getVarietyDetail(slug);
    const sellers = detail ? [...new Set(detail.listings.map((l) => l.seller.slug))] : [];
    return {
      value: detail,
      paths: [`/variety/${slug}`, `/variety/${slug}?small_farm=true`, ...sellers.map((s) => `/seller/${s}`)],
    };
  });
}

/* ── Slice 5 shop/hub loaders ── */

/**
 * One seller's detail through the shared cache (null included: unknown
 * AND removed slugs cache negative until max age — the route splits
 * gone from missing through the uncached status lookup). The entry
 * renders the shop page and registers its varieties' paths, so a variety
 * tag purges it too (a listing write fans out to both templates it joins).
 */
export async function loadSellerDetail(
  slug: string,
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
): Promise<ApiSellerDetail | null> {
  return cache.get<ApiSellerDetail | null>(`seller:detail:${slug}`, async () => {
    const detail = await api.getSellerDetail(slug);
    const varieties = detail ? [...new Set(detail.listings.map((l) => l.variety.slug))] : [];
    return {
      value: detail,
      paths: [`/seller/${slug}`, ...varieties.map((v) => `/variety/${v}`)],
    };
  });
}

/** One crop's walked detail: the head fields plus the FULL variety set. */
export interface CropDetailData {
  detail: ApiCropDetail;
  /** Every member variety (resting Name A–Z from the walk). */
  items: ApiVarietyListItem[];
  total: number;
}

/**
 * One crop's walked detail through the shared cache (null included). The
 * entry renders the crop hub and registers its members' variety paths, so
 * a variety tag purges it (counts move with every listing write).
 */
export async function loadCropDetail(
  slug: string,
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
): Promise<CropDetailData | null> {
  return cache.get<CropDetailData | null>(`crop:detail:${slug}`, async () => {
    const walked = await api.walkCropDetail(slug);
    if (!walked) return { value: null, paths: [`/crop/${slug}`] };
    return {
      value: { detail: walked.detail, items: walked.detail.varieties, total: walked.total },
      paths: [`/crop/${slug}`, ...walked.detail.varieties.map((v) => `/variety/${v.slug}`)],
    };
  });
}

/**
 * One series' detail through the shared cache (null included). The entry
 * renders the series hub and registers its members' variety paths, so a
 * variety tag purges it.
 */
export async function loadSeriesDetail(
  slug: string,
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
): Promise<ApiSeriesDetail | null> {
  return cache.get<ApiSeriesDetail | null>(`series:detail:${slug}`, async () => {
    const detail = await api.getSeriesDetail(slug);
    if (!detail) return { value: null, paths: [`/series/${slug}`] };
    return {
      value: detail,
      paths: [`/series/${slug}`, ...seriesVarietyPaths(detail.varieties)],
    };
  });
}

function seriesVarietyPaths(varieties: ApiVarietyListItem[]): string[] {
  return [...new Set(varieties.map((v) => `/variety/${v.slug}`))];
}

/** One state hub's page window through the shared cache. */
export interface StateDetailData {
  state: SellerState;
  items: ApiSellerItem[];
  total: number;
  page: number;
  pages: number;
}

/**
 * One state hub's page window: the state record plus its sellers' window,
 * sliced read-side from the walked seller set. The entry renders the
 * state page and registers its sellers' shop paths, so a seller tag
 * purges it (membership moves with every seller write).
 */
export async function loadStateDetail(
  code: string,
  page: number,
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
): Promise<StateDetailData | null> {
  const cacheKey = `state:detail:${code}:${page}`;
  return cache.get<StateDetailData | null>(cacheKey, async () => {
    const [walked, states] = await Promise.all([
      cache.get<ApiSellerItem[]>("browse:seller:walk", async () => {
        const { items } = await api.walkSellers();
        return { value: items, paths: ["/seller"] };
      }),
      loadSellerStates(api, cache),
    ]);
    const found = states.find((s) => s.code === code) ?? null;
    if (!found) return { value: null, paths: [] };
    const matching = sellersInState(walked, code);
    const { offset, limit } = pageWindow(page, PAGE_SIZE);
    const total = matching.length;
    const items = matching.slice(offset, offset + limit);
    const state: SellerState = { code: found.code, name: found.name, slug: found.slug, sellerCount: total };
    return {
      value: { state, items, total, page, pages: totalPages(total, PAGE_SIZE) },
      paths: [`/state/${state.slug}`, ...matching.map((s) => `/seller/${s.slug}`)],
    };
  });
}

/**
 * A crop's sibling strip for one variety page: the crop's whole set in
 * availability order, minus the page itself, capped at six. The cached entry
 * carries no paths (a sibling strip refreshes on entry max age, like the
 * edge): the strip's membership spans every page of the crop, which no
 * single variety tag names — v2 parity, where sibling strips refresh on the
 * ISR fallback for the same reason.
 */
export async function loadVarietySiblings(
  cropSlug: string,
  selfSlug: string,
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
): Promise<ApiVarietyListItem[]> {
  const items = await cache.get<ApiVarietyListItem[]>(`variety:siblings:${cropSlug}`, async () => {
    const { items: walked } = await api.listVarietyListItems({ plant: [cropSlug] });
    return { value: [...walked].sort(compareVarietyAvailability), paths: [] };
  });
  return items.filter((item) => item.slug !== selfSlug).slice(0, 6);
}

export interface MachineData {
  counts: CatalogCounts;
  coverage: ApiCoverageItem[];
  crops: ApiCrop[];
  sellers: ApiSellerItem[];
  snapshot: SyncSnapshotData;
}

export async function loadMachineData(api: CatalogApi = getCatalogApi(), cache: DataCache = getDataCache()): Promise<MachineData> {
  const [counts, coverage, crops, sellers, snapshot] = await Promise.all([
    cache.get<CatalogCounts>("counts", async () => ({ value: await api.counts(() => loadSnapshot(api, cache)), paths: ["/", "/llms.txt"] })),
    cache.get<ApiCoverageItem[]>("coverage", async () => ({ value: await api.coverage(), paths: ["/", "/llms.txt"] })),
    loadCropIndexData(api, cache),
    cache.get("sellers", async () => {
      const { items } = await api.listSellers();
      return { value: items, paths: ["/llms.txt"] };
    }),
    loadSnapshot(api, cache),
  ]);
  return { counts, coverage, crops: crops.crops, sellers, snapshot };
}

/* ── Slice 4 browse/search loaders ── */

/**
 * The /variety browse snapshot: one page window, the filtered total, and
 * the per-option counts matrix — the identical contract v2's server page
 * and /api/browse/varieties share, computed here from one walked API set
 * (the /api/browse endpoints are internal Next routes, not public API).
 */
export interface VarietyBrowseData {
  state: BrowseFilterState;
  counts: ApiBrowseCounts;
  items: ApiVarietyListItem[];
  total: number;
  page: number;
  pages: number;
}

const stableWalkFilters = (state: BrowseFilterState): string =>
  JSON.stringify([state.season, state.method, state.lifeCycle, [...state.hue].sort(), state.smallFarm, state.sort]);

/**
 * One walked variety set, shared by every filter state with the same
 * smallFarm flag and server sort: smallFarm is the one group no read-side
 * predicate can answer (list items carry no badged-seller flag), so the
 * walk applies it server-side and every other group filters read-side.
 * Paths ["/variety"]: variety and list:variety tags purge it.
 */
async function loadVarietyWalk(
  smallFarmOnly: boolean,
  serverSort: "name" | "-recently_checked",
  api: CatalogApi,
  cache: DataCache,
): Promise<ApiVarietyListItem[]> {
  return cache.get<ApiVarietyListItem[]>(`browse:variety:walk:${smallFarmOnly ? 1 : 0}:${serverSort}`, async () => {
    const { items } = await api.walkVarieties(smallFarmOnly ? { smallFarmOnly: true } : {}, serverSort);
    return { value: items, paths: ["/variety"] };
  });
}

export async function loadVarietyBrowse(
  filters: BrowseFilterState,
  page: number,
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
): Promise<VarietyBrowseData> {
  const repoSort = BROWSE_SORT_REPO[filters.sort];
  const serverSort = repoSort === "availability" ? "name" : repoSort;
  const cacheKey = `browse:variety:result:${stableWalkFilters(filters)}:${page}`;
  return cache.get<VarietyBrowseData>(cacheKey, async () => {
    const walked = await loadVarietyWalk(filters.smallFarm, serverSort, api, cache);
    const matching = walked.filter((v) => varietyMatchesGroups(varietyFieldsOf(v), filters));
    const ordered = orderVarieties(matching, filters);
    const { offset, limit } = pageWindow(page, PAGE_SIZE);
    // The one cell no walk answers: the smallFarm total under the OPPOSITE
    // flag (same flag reads off the walked set).
    const opposite = await api.countVarieties({
      season: filters.season ?? undefined,
      methods: filters.method ? [filters.method] : undefined,
      lifeCycle: filters.lifeCycle ? [filters.lifeCycle] : undefined,
      colorFamily: filters.hue.length ? [...filters.hue] : undefined,
      smallFarmOnly: filters.smallFarm ? undefined : true,
    });
    const total = matching.length;
    return {
      value: {
        state: filters,
        counts: varietyBrowseCounts(walked, filters, opposite),
        items: ordered.slice(offset, offset + limit),
        total,
        page,
        pages: totalPages(total, PAGE_SIZE),
      },
      paths: ["/variety"],
    };
  });
}

/**
 * US states with at least one visible seller, alphabetical by name, with
 * counts — v2's catalog.listSellerStates() rule, derived read-side from
 * the walked seller set (no public list-states endpoint exists). Regions
 * that are not a US state code (or non-US sellers) are left out.
 */
export async function loadSellerStates(
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
): Promise<SellerStateOption[]> {
  return cache.get<SellerStateOption[]>("browse:seller:states", async () => {
    const { items } = await api.walkSellers();
    const counts = new Map<string, number>();
    for (const s of items) {
      if (s.country !== "US") continue;
      const st = stateByCode(s.region);
      if (st && s.region === st.code) counts.set(st.code, (counts.get(st.code) ?? 0) + 1);
    }
    const states = [...counts]
      .map(([code, sellerCount]) => {
        const st = stateByCode(code)!;
        return { code, name: st.name, slug: st.slug, sellerCount };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { value: states, paths: ["/seller"] };
  });
}

/** The /seller browse snapshot: one page window, the total, the cloud options, and its counts. */
export interface SellerBrowseData {
  state: SellerBrowseState;
  counts: ApiSellerBrowseCounts;
  items: ApiSellerItem[];
  total: number;
  page: number;
  pages: number;
  states: SellerStateOption[];
}

export async function loadSellerBrowse(
  filters: SellerBrowseState,
  page: number,
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
): Promise<SellerBrowseData> {
  const cacheKey = `browse:seller:result:${filters.state ?? "all"}:${page}`;
  return cache.get<SellerBrowseData>(cacheKey, async () => {
    const [walked, states] = await Promise.all([
      cache.get<ApiSellerItem[]>("browse:seller:walk", async () => {
        const { items } = await api.walkSellers();
        return { value: items, paths: ["/seller"] };
      }),
      loadSellerStates(api, cache),
    ]);
    const matching = sellersInState(walked, filters.state);
    const { offset, limit } = pageWindow(page, PAGE_SIZE);
    const total = matching.length;
    return {
      value: {
        state: filters,
        counts: {
          all: walked.length,
          options: Object.fromEntries(states.map((s) => [s.code, walked.filter((w) => w.region === s.code).length])),
        },
        items: matching.slice(offset, offset + limit),
        total,
        page,
        pages: totalPages(total, PAGE_SIZE),
        states,
      },
      paths: ["/seller"],
    };
  });
}

/** The /search snapshot: grouped results under the filter state, the grouped total, counts, and did-you-mean. */
export interface SearchBrowseData {
  q: string;
  state: BrowseFilterState;
  counts: ApiBrowseCounts;
  crops: ApiSearchResult[];
  series: ApiSearchResult[];
  varieties: ApiSearchResult[];
  sellers: ApiSearchResult[];
  total: number;
  /** Did-you-mean: the zero-results state's single near-match, or null (computed only at total 0). */
  suggestion: { name: string; href: string } | null;
}

/**
 * The /search read: one unfiltered v1 response (limit 50 — the live caps
 * are then exactly v2's browseSearch caps), filtered read-side per group
 * with joins from the walked variety set, the crops list, and per-series
 * detail reads (≤5, cached per slug). Paths ["/search"]: Bea §9's fan-out
 * names no search purge, so these entries refresh on max age — the
 * documented no-fan-out.
 */
export async function loadSearchResults(
  q: string,
  filters: BrowseFilterState,
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
): Promise<SearchBrowseData> {
  const cacheKey = `browse:search:result:${encodeURIComponent(q)}:${stableWalkFilters(filters)}`;
  return cache.get<SearchBrowseData>(cacheKey, async () => {
    const wide = await cache.get(`browse:search:wide:${encodeURIComponent(q)}`, async () => ({
      value: await api.searchWide(q),
      paths: ["/search"],
    }));
    const [corpus, { crops }] = await Promise.all([
      loadVarietyWalk(false, "name", api, cache),
      loadCropIndexData(api, cache),
    ]);
    // Series joins for every matched series (≤5, cached per slug): the
    // read-side filter needs each series' crop, and a series missing from
    // the joins drops like v2's ids-join — so unfiltered searches need the
    // joins too, or the group would wrongly empty.
    const seriesDetails = await Promise.all(
      [...new Set(wide.series.map((r) => r.slug))].map((slug) =>
        cache.get<ApiSeriesCrop | null>(`browse:search:series:${slug}`, async () => ({
          value: await api.seriesCrop(slug),
          paths: ["/search"],
        })),
      ),
    );
    const joins = joinsFromCorpus(
      corpus,
      crops,
      seriesDetails.filter((d): d is ApiSeriesCrop => d !== null),
    );
    const groups = filterSearchGroups(wide, joins, filters);
    const suggestion =
      groups.total === 0 ? suggestCorrection(q, corpus, crops) : null;
    return {
      value: {
        q,
        state: filters,
        counts: searchBrowseCounts(wide, joins, filters, "single"),
        ...groups,
        suggestion: suggestion ? { name: suggestion, href: `/search?q=${encodeURIComponent(suggestion)}` } : null,
      },
      paths: ["/search"],
    };
  });
}
