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
import { createDataCache, type DataCache } from "./cache";
import type {
  ApiCoverageItem,
  ApiCrop,
  ApiRecentItem,
  ApiSellerItem,
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

/**
 * v2's availability comparator (repositories/catalog-read.ts
 * summaryComparator, verbatim logic): in-stock listings first, then any
 * listings, then none; within a tier more sellers first, then in-stock
 * listings, then listings, then name ascending with slug tiebreak. The
 * public API has no availability sort, so the sibling loader applies this
 * read-side over the walked set.
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

/**
 * One variety's detail through the shared cache (null included: unknown
 * slugs are cached negative until max age). The entry renders the variety
 * page and its small-farms variant, so a variety tag purges both.
 */
export async function loadVarietyDetail(
  slug: string,
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
): Promise<ApiVarietyDetail | null> {
  return cache.get<ApiVarietyDetail | null>(`variety:detail:${slug}`, async () => ({
    value: await api.getVarietyDetail(slug),
    paths: [`/variety/${slug}`, `/variety/${slug}?small_farm=true`],
  }));
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
