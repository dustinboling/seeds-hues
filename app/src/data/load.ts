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
import type { ApiCoverageItem, ApiCrop, ApiRecentItem, CatalogCounts, OpenApiDoc, SyncSnapshotData } from "./types";

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

export interface MachineData {
  counts: CatalogCounts;
  coverage: ApiCoverageItem[];
  crops: ApiCrop[];
  sellers: { slug: string; name: string; location: string | null }[];
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
