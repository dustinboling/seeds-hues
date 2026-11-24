/**
 * Mutable in-memory catalog source for the Slice 2 data-layer tests. It
 * implements the CatalogApi surface the loaders consume, backed by plain
 * state the test mutates to simulate a catalog write (the "change a variety
 * count" half of the invalidation proof). Nothing here touches the network.
 */
import type {
  ApiCoverageItem,
  ApiCrop,
  ApiRecentItem,
  ApiSellerItem,
  CatalogCounts,
  LastmodCache,
  OpenApiDoc,
  SyncSnapshotData,
} from "../../src/data/types";
import type { CatalogApi } from "../../src/data/api";

export interface FakeCatalogState {
  crops: ApiCrop[];
  sellers: ApiSellerItem[];
  coverage: ApiCoverageItem[];
  recent: ApiRecentItem[];
  snapshot: SyncSnapshotData;
  openapi: OpenApiDoc;
  varietyDates: Record<string, string>;
  sellerDates: Record<string, string>;
}

const crop = (
  slug: string,
  commonName: string,
  varietyCount: number,
  varietiesWithSellers: number,
  latinName: string | null = null,
): ApiCrop => ({
  slug,
  commonName,
  latinName,
  varietyCount,
  varietiesWithSellers,
  lastUpdated: "2026-11-20",
  media: [{ url: `/crop/${slug}.webp` }],
});

/** The standard fixture: 2 crops, 3 varieties (listed / zero-seller / hidden), 2 sellers. */
export function fakeCatalogState(): FakeCatalogState {
  return {
    crops: [
      crop("sweet-pea", "Sweet Pea", 10, 8, "Lathyrus odoratus"),
      crop("cosmos", "Cosmos", 4, 0),
    ],
    sellers: [
      { slug: "blue-ridge-seeds", name: "Blue Ridge Seeds", location: "Oregon, US", region: "OR", country: "US", varietyCount: 5 },
      { slug: "prairie-seed-house", name: "Prairie Seed House", location: "Kansas, US", region: "KS", country: "US", varietyCount: 3 },
    ],
    coverage: [
      { crop: { slug: "sweet-pea", name: "Sweet Pea" }, varieties: 10, varieties_with_sellers: 8, last_updated: "2026-11-20" },
      { crop: { slug: "cosmos", name: "Cosmos" }, varieties: 4, varieties_with_sellers: 0, last_updated: "2026-11-19" },
    ],
    recent: [
      {
        event: "restocked",
        at: "2026-11-23T10:00:00.000Z",
        listing: {
          id: 1,
          availability: "in_stock",
          variety: { slug: "sweet-pea-kings-ransom", varietyName: "King's Ransom", plant: { commonName: "Sweet Pea" } },
          seller: { slug: "blue-ridge-seeds", name: "Blue Ridge Seeds" },
        },
      },
    ],
    snapshot: {
      catalog_seq: 100,
      schema_version: 1,
      generated_at: "2026-11-24T00:00:00.000Z",
      crops: [
        { id: 1, slug: "sweet-pea", updated_seq: 10 },
        { id: 2, slug: "cosmos", updated_seq: 11 },
      ],
      series: [{ id: 1, slug: "spencer-mix", updated_seq: 12 }],
      varieties: [
        { id: 1, slug: "sweet-pea-kings-ransom", indexable: true, updated_seq: 20 },
        { id: 2, slug: "cosmos-lonely-bloom", indexable: true, updated_seq: 21 },
        { id: 3, slug: "cosmos-hidden-draft", indexable: false, updated_seq: 22 },
      ],
      sellers: [
        { id: 1, slug: "blue-ridge-seeds", region: "OR", country: "US", updated_seq: 30 },
        { id: 2, slug: "prairie-seed-house", region: "KS", country: "US", updated_seq: 31 },
      ],
      listings: [{ id: 1, variety_id: 1, seller_id: 1 }],
    },
    openapi: {
      info: { description: "Fake OpenAPI description for tests.", version: "1.0.0" },
      paths: {
        "/crops": { get: { summary: "List crops", parameters: [{ name: "limit", in: "query", description: "Page size", schema: { type: "integer", minimum: 1, maximum: 100, default: 24 } }] } },
        "/varieties": { get: { summary: "List varieties" } },
      },
    },
    varietyDates: {
      "sweet-pea-kings-ransom": "2026-11-20T00:00:00.000Z",
      "cosmos-lonely-bloom": "2026-11-19T00:00:00.000Z",
    },
    sellerDates: {
      "blue-ridge-seeds": "2026-11-18T00:00:00.000Z",
      "prairie-seed-house": "2026-11-17T00:00:00.000Z",
    },
  };
}

/** A lastmod cache verifying every fake row — plus one stale and one removed entry. */
export function fakeLastmodCache(): LastmodCache {
  return {
    generated_at: "2026-11-24T00:00:00.000Z",
    catalog_seq: 100,
    varieties: {
      "sweet-pea-kings-ransom": { updated_at: "2026-11-20T00:00:00.000Z", updated_seq: 20 },
      // Stale: the live row is at seq 21, so this date must be OMITTED, never emitted.
      "cosmos-lonely-bloom": { updated_at: "2026-11-01T00:00:00.000Z", updated_seq: 9 },
      // Removed: no such row in the snapshot — must neither emit nor resurrect a URL.
      "sweet-pea-removed-variety": { updated_at: "2026-10-01T00:00:00.000Z", updated_seq: 5 },
    },
    sellers: {
      "blue-ridge-seeds": { updated_at: "2026-11-18T00:00:00.000Z", updated_seq: 30 },
      "prairie-seed-house": { updated_at: "2026-11-17T00:00:00.000Z", updated_seq: 31 },
      // Removed seller: cached but gone from the snapshot — no URL, no date.
      "gone-seed-farm": { updated_at: "2026-09-01T00:00:00.000Z", updated_seq: 7 },
    },
    series: {},
  };
}

export function createFakeCatalogApi(state: FakeCatalogState): CatalogApi {
  const counts = (): CatalogCounts => ({
    varieties: state.snapshot.varieties.length,
    plants: state.crops.length,
    sellers: state.sellers.length,
    listings: state.snapshot.listings.length,
  });
  // Every read clones: a real API returns fresh JSON per fetch, never a live
  // reference into the source — without this the cache would alias the state
  // and no test could observe staleness.
  return {
    listCrops: async () => ({ items: structuredClone(state.crops), total: state.crops.length }),
    listSellers: async () => ({ items: structuredClone(state.sellers), total: state.sellers.length }),
    coverage: async () => structuredClone(state.coverage),
    recent: async (limit: number) => structuredClone(state.recent.slice(0, limit)),
    snapshot: async () => ({ data: structuredClone(state.snapshot), etag: `seq-${state.snapshot.catalog_seq}` }),
    counts: async () => counts(),
    varietyUpdatedAt: async (slug: string) => {
      const date = state.varietyDates[slug];
      if (!date) throw new Error(`fake api: no variety ${slug}`);
      return date;
    },
    sellerUpdatedAt: async (slug: string) => {
      const date = state.sellerDates[slug];
      if (!date) throw new Error(`fake api: no seller ${slug}`);
      return date;
    },
    openapi: async () => state.openapi,
  } as unknown as CatalogApi;
}
