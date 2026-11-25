/**
 * Mutable in-memory catalog source for the Slice 2 data-layer tests. It
 * implements the CatalogApi surface the loaders consume, backed by plain
 * state the test mutates to simulate a catalog write (the "change a variety
 * count" half of the invalidation proof). Nothing here touches the network.
 */
import type {
  ApiCoverageItem,
  ApiCrop,
  ApiGrowerGuide,
  ApiMedia,
  ApiOgSeller,
  ApiPlantGuidance,
  ApiPlantRef,
  ApiPublicListing,
  ApiRecentItem,
  ApiSellerDetail,
  ApiSellerItem,
  ApiSellerRef,
  ApiSeriesRef,
  ApiVarietyDetail,
  ApiVarietyListItem,
  CatalogCounts,
  LastmodCache,
  OpenApiDoc,
  SyncSnapshotData,
} from "../../src/data/types";
import type { CatalogApi } from "../../src/data/api";
import { fakeFormsState, type FormsState } from "./forms-fixtures";

export interface FakeCatalogState {
  crops: ApiCrop[];
  sellers: ApiSellerItem[];
  coverage: ApiCoverageItem[];
  recent: ApiRecentItem[];
  snapshot: SyncSnapshotData;
  openapi: OpenApiDoc;
  varietyDates: Record<string, string>;
  sellerDates: Record<string, string>;
  /** Slice 3: variety details by slug (GET /api/v1/varieties/[slug]). */
  details: Record<string, ApiVarietyDetail>;
  /** Slice 3: the /varieties list pool (sibling strips filter it by crop). */
  listItems: ApiVarietyListItem[];
  /** Slice 3: merged variety slug -> surviving slug. */
  merged: Record<string, string>;
  /**
   * Slice 4: the series catalog (slug, display name, owning crop) behind
   * /api/v1/search's Series group and /api/v1/series/[slug]. The public API
   * has no series LIST endpoint, so this table lives only in the stub.
   */
  seriesCatalog: { slug: string; name: string; plantSlug: string }[];
  /**
   * Slice 4: variety slugs with ≥1 visible listing from a Small-farm-badged
   * seller. VarietyListItem carries no such field (v1-faithful), so the
   * stub's small_farm filter reads this side table.
   */
  smallFarmVarieties: string[];
  /**
   * Slice 5: full seller records by slug (GET /api/v1/sellers/[slug]).
   * Sellers listed in `sellers` but absent here serve the legacy
   * OG-subset shape (the pre-Slice-5 stub behavior for old suites).
   */
  sellerDetails: Record<string, ApiSellerDetail>;
  /** Slice 5: removed-seller slugs (the seller-status source reports gone → 410). */
  removedSellers: string[];
  /**
   * Slice 5: per-crop detail fields behind GET /api/v1/crops/[slug] (the
   * list row in `crops` carries the rest; the varieties window derives
   * from `listItems` members). Crops absent here serve null prose/facts
   * and no series (the pre-Slice-5 shape for old suites).
   */
  cropExtras: Record<string, ApiCropExtra>;
  /**
   * Slice 6: the stub backend's form/account state (visitor accounts,
   * sessions, waitlist entries, the verbatim payload log, per-endpoint
   * accept/reject modes, /go listings + click log, unsubscribe tokens).
   */
  forms: FormsState;
}

/** The per-crop detail slice GET /api/v1/crops/[slug] adds to the list row. */
export interface ApiCropExtra {
  description: string | null;
  sowingNotes: string | null;
  life_cycle: string | null;
  hardiness: string | null;
  grower_guide: ApiGrowerGuide | null;
  series: ApiSeriesRef[];
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
  lifeCycle: "Annual",
  season_class: slug === "cosmos" ? "warm_season_tender_annual" : "cool_season_hardy_annual",
  sowing_methods: slug === "cosmos" ? ["direct_sow"] : ["direct_sow", "transplant"],
  varietyCount,
  varietiesWithSellers,
  lastUpdated: "2026-11-20",
  media: [{ url: `/crop/${slug}.webp` }],
});

const plate = (url: string): ApiMedia => ({ url, licence: "CC BY-NC 4.0", credit: "Hues Floral Park" });

const sweetPeaRef: ApiPlantRef = {
  slug: "sweet-pea",
  commonName: "Sweet Pea",
  latinName: "Lathyrus odoratus",
  lifeCycle: "Annual",
  season_class: "cool_season_hardy_annual",
  season_source_label: "The Gardener's Workshop",
  sowing_methods: ["direct_sow", "transplant"],
  sowing_method_source_label: "Floret",
};

const cosmosRef: ApiPlantRef = {
  slug: "cosmos",
  commonName: "Cosmos",
  latinName: "Cosmos bipinnatus",
  lifeCycle: "Annual",
  season_class: "warm_season_tender_annual",
  season_source_label: "The Gardener's Workshop",
  sowing_methods: ["direct_sow"],
  sowing_method_source_label: "Floret",
};

/** Fixture (v)'s crop: no Latin name anywhere (the Latin "Unknown" branch). */
const cosmosNoLatinRef: ApiPlantRef = { ...cosmosRef, latinName: null };

const blueRidge: ApiSellerRef = {
  slug: "blue-ridge-seeds",
  name: "Blue Ridge Seeds",
  location: "Portland, OR",
  region: "OR",
  country: "US",
  isSmallFarm: true,
};

const prairie: ApiSellerRef = {
  slug: "prairie-seed-house",
  name: "Prairie Seed House",
  location: "Lawrence, KS",
  region: "KS",
  country: "US",
  isSmallFarm: false,
};

const NOT_RATED = { state: "not_yet_rated", average: null, review_count: 0 } as const;

function listing(opts: {
  id: number;
  varietySlug: string;
  varietyName: string;
  plant: ApiPlantRef;
  media: ApiMedia[];
  seller: ApiSellerRef;
  availability: ApiPublicListing["availability"];
  lastCheckedAt: string | null;
  firstSeenAt: string | null;
  productUrl: string | null;
  notes: string | null;
  packetSizes: ApiPublicListing["packetSizes"];
  provenanceMethod: ApiPublicListing["provenance"]["method"];
}): ApiPublicListing {
  return {
    id: opts.id,
    variety: {
      slug: opts.varietySlug,
      varietyName: opts.varietyName,
      plant: opts.plant,
      colorSwatch: null,
      colorFamily: "pink",
      media: opts.media,
      cropMedia: [],
    },
    seller: opts.seller,
    availability: opts.availability,
    lastCheckedAt: opts.lastCheckedAt,
    firstSeenAt: opts.firstSeenAt,
    goUrl: `https://seeds.hues.flowers/go/${opts.id}`,
    productUrl: opts.productUrl,
    notes: opts.notes,
    status: "published",
    packetSizes: opts.packetSizes,
    provenance: {
      source_url: opts.productUrl,
      retrieved_at: opts.lastCheckedAt,
      method: opts.provenanceMethod,
      confidence: 0.95,
    },
    sourceLabel: null,
  };
}

/**
 * Fixture (i): WITH sellers — three listings across two sellers (one
 * Small-Farm-badged), mixed stock (in_stock / sold_out / preorder), packet
 * sizes, real checked dates, listing notes, a series assignment, complete
 * facts, one plate. Answer/title/description below are the live builders'
 * exact outputs for this data (hand-verified against the v2 builders).
 */
function kingsRansom(): ApiVarietyDetail {
  const media = [plate("/artwork/sweet-pea-kings-ransom.webp")];
  const plant: ApiPlantGuidance = {
    ...sweetPeaRef,
    description: "Sweet peas are cool-season annuals grown for cut flowers.",
    sowingNotes: "Start indoors or sow directly after frost.",
  };
  return {
    slug: "sweet-pea-kings-ransom",
    varietyName: "King's Ransom",
    plant,
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: { slug: "spencer-mix", name: "Spencer" },
    colorSwatch: null,
    colorFamily: "pink",
    listingCount: 3,
    sellerCount: 2,
    inStockCount: 1,
    lastCheckedAt: "2026-11-20T08:00:00.000Z",
    indexable: true,
    rating: { ...NOT_RATED },
    description: "King's Ransom bears large, ruffled blooms in deep rose on strong stems.",
    templateDescription:
      "King's Ransom is a Sweet Pea variety (Lathyrus odoratus). It is listed by 2 seed sellers in this directory.",
    answer: "As of Nov 20, 2026, 2 sellers list King's Ransom: Blue Ridge Seeds and Prairie Seed House.",
    sowingNotes: "Sow indoors 4 weeks before last frost.",
    heightCm: 180,
    facts: {
      color_family: "pink",
      pollination: "open_pollinated",
      height_cm: { min: 180, max: 180 },
      days_to_bloom: { min: 70, max: 80 },
    },
    tags: ["fragrant"],
    aliases: ["Ransom"],
    protection: "none_stated",
    protectionNote: null,
    contentLevel: "factual",
    updatedAt: "2026-11-20T00:00:00.000Z",
    listings: [
      listing({
        id: 1,
        varietySlug: "sweet-pea-kings-ransom",
        varietyName: "King's Ransom",
        plant: sweetPeaRef,
        media,
        seller: blueRidge,
        availability: "in_stock",
        lastCheckedAt: "2026-11-20T08:00:00.000Z",
        firstSeenAt: "2026-09-01T00:00:00.000Z",
        productUrl: "https://shop.example.com/blue-ridge/kings-ransom",
        notes: "Packet sizes vary by season.",
        packetSizes: [
          { label: "25 seeds", seedCount: 25 },
          { label: "1 g", seedCount: 90 },
        ],
        provenanceMethod: "human",
      }),
      listing({
        id: 2,
        varietySlug: "sweet-pea-kings-ransom",
        varietyName: "King's Ransom",
        plant: sweetPeaRef,
        media,
        seller: prairie,
        availability: "sold_out",
        lastCheckedAt: "2026-11-18T10:30:00.000Z",
        firstSeenAt: "2026-10-05T00:00:00.000Z",
        productUrl: "https://shop.example.com/prairie/kings-ransom",
        notes: null,
        packetSizes: [{ label: "50 seeds", seedCount: 50 }],
        provenanceMethod: "exact",
      }),
      listing({
        id: 3,
        varietySlug: "sweet-pea-kings-ransom",
        varietyName: "King's Ransom",
        plant: sweetPeaRef,
        media,
        seller: blueRidge,
        availability: "preorder",
        lastCheckedAt: null,
        firstSeenAt: null,
        productUrl: null,
        notes: "Treated seed.",
        packetSizes: [],
        provenanceMethod: "model",
      }),
    ],
    media,
  };
}

/** Fixture (ii): ZERO sellers — the indexable no-seller form with its waitlist block. */
function lonelyBloom(): ApiVarietyDetail {
  return {
    slug: "cosmos-lonely-bloom",
    varietyName: "Lonely Bloom",
    plant: { ...cosmosRef, description: null, sowingNotes: null },
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: null,
    colorSwatch: null,
    colorFamily: "unknown",
    listingCount: 0,
    sellerCount: 0,
    inStockCount: 0,
    lastCheckedAt: null,
    indexable: true,
    rating: { ...NOT_RATED },
    description: "Lonely Bloom opens single white flowers.",
    templateDescription: "Lonely Bloom is a Cosmos variety (Cosmos bipinnatus). No seller found selling Lonely Bloom yet.",
    answer: "No seller found selling Lonely Bloom yet.",
    sowingNotes: null,
    heightCm: null,
    facts: {
      color_family: "white",
      pollination: "unknown",
      height_cm: { min: null, max: null },
      days_to_bloom: { min: null, max: null },
    },
    tags: [],
    aliases: [],
    protection: "none_stated",
    protectionNote: null,
    contentLevel: "thin",
    updatedAt: "2026-11-19T00:00:00.000Z",
    listings: [],
    media: [],
  };
}

/**
 * Fixture (iii): listings but NO badged seller — the small-farm empty state.
 * No prose description (the Template B meta description).
 */
function candyStripe(): ApiVarietyDetail {
  return {
    slug: "cosmos-candy-stripe",
    varietyName: "Candy Stripe",
    plant: { ...cosmosRef, description: null, sowingNotes: null },
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: null,
    colorSwatch: null,
    colorFamily: "pink",
    listingCount: 2,
    sellerCount: 1,
    inStockCount: 1,
    lastCheckedAt: "2026-11-15T12:00:00.000Z",
    indexable: true,
    rating: { ...NOT_RATED },
    description: null,
    templateDescription: "Candy Stripe is a Cosmos variety (Cosmos bipinnatus). It is listed by 1 seed seller in this directory.",
    answer: "As of Nov 15, 2026, 1 seller lists Candy Stripe: Prairie Seed House.",
    sowingNotes: null,
    heightCm: 120,
    facts: {
      color_family: "pink",
      pollination: "open_pollinated",
      height_cm: { min: 120, max: 120 },
      days_to_bloom: { min: 60, max: 70 },
    },
    tags: [],
    aliases: [],
    protection: "none_stated",
    protectionNote: null,
    contentLevel: "factual",
    updatedAt: "2026-11-15T00:00:00.000Z",
    listings: [
      listing({
        id: 10,
        varietySlug: "cosmos-candy-stripe",
        varietyName: "Candy Stripe",
        plant: cosmosRef,
        media: [],
        seller: prairie,
        availability: "in_stock",
        lastCheckedAt: "2026-11-15T12:00:00.000Z",
        firstSeenAt: "2026-08-20T00:00:00.000Z",
        productUrl: "https://shop.example.com/prairie/candy-stripe",
        notes: null,
        packetSizes: [{ label: "25 seeds", seedCount: 25 }],
        provenanceMethod: "synonym",
      }),
      listing({
        id: 11,
        varietySlug: "cosmos-candy-stripe",
        varietyName: "Candy Stripe",
        plant: cosmosRef,
        media: [],
        seller: prairie,
        availability: "sold_out",
        lastCheckedAt: "2026-11-12T09:00:00.000Z",
        firstSeenAt: "2026-08-20T00:00:00.000Z",
        productUrl: "https://shop.example.com/prairie/candy-stripe-large",
        notes: "Check back in spring.",
        packetSizes: [],
        provenanceMethod: "exact",
      }),
    ],
    media: [],
  };
}

/**
 * Fixture (v): facts with unknowns — no height, no days-to-bloom, no Latin,
 * no season, no sowing methods, unknown pollination and color family, no
 * series. Every unknown renders the word "Unknown" (series renders "None").
 */
function mysteryBloom(): ApiVarietyDetail {
  return {
    slug: "cosmos-mystery-bloom",
    varietyName: "Mystery Bloom",
    plant: {
      ...cosmosNoLatinRef,
      season_class: null,
      season_source_label: null,
      sowing_methods: [],
      sowing_method_source_label: null,
      description: null,
      sowingNotes: null,
    },
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: null,
    colorSwatch: null,
    colorFamily: "unknown",
    listingCount: 1,
    sellerCount: 1,
    inStockCount: 1,
    lastCheckedAt: "2026-11-19T14:00:00.000Z",
    indexable: true,
    rating: { ...NOT_RATED },
    description: null,
    templateDescription: "Mystery Bloom is a Cosmos variety. It is listed by 1 seed seller in this directory.",
    answer: "As of Nov 19, 2026, 1 seller lists Mystery Bloom: Prairie Seed House.",
    sowingNotes: null,
    heightCm: null,
    facts: {
      color_family: "unknown",
      pollination: "unknown",
      height_cm: { min: null, max: null },
      days_to_bloom: { min: null, max: null },
    },
    tags: [],
    aliases: [],
    protection: "none_stated",
    protectionNote: null,
    contentLevel: "thin",
    updatedAt: "2026-11-19T00:00:00.000Z",
    listings: [
      listing({
        id: 20,
        varietySlug: "cosmos-mystery-bloom",
        varietyName: "Mystery Bloom",
        plant: cosmosNoLatinRef,
        media: [],
        seller: prairie,
        availability: "in_stock",
        lastCheckedAt: "2026-11-19T14:00:00.000Z",
        firstSeenAt: "2026-11-01T00:00:00.000Z",
        productUrl: "https://shop.example.com/prairie/mystery-bloom",
        notes: null,
        packetSizes: [{ label: "25 seeds", seedCount: 25 }],
        provenanceMethod: "human",
      }),
    ],
    media: [],
  };
}

function listItem(opts: {
  slug: string;
  varietyName: string;
  plant: ApiPlantRef;
  series: ApiVarietyListItem["series"];
  sellerCount: number;
  media: ApiMedia[];
  cropMedia: ApiMedia[];
}): ApiVarietyListItem {
  return {
    slug: opts.slug,
    varietyName: opts.varietyName,
    plant: opts.plant,
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: opts.series,
    colorSwatch: null,
    colorFamily: "pink",
    listingCount: opts.sellerCount,
    sellerCount: opts.sellerCount,
    inStockCount: opts.sellerCount,
    lastCheckedAt: opts.sellerCount > 0 ? "2026-11-17T00:00:00.000Z" : null,
    indexable: true,
    rating: { ...NOT_RATED },
    media: opts.media,
    cropMedia: opts.cropMedia,
  };
}

/** The sibling pool: three sweet-pea and two cosmos list items. */
function siblingPool(): ApiVarietyListItem[] {
  const sweetPeaCrop = [plate("/artwork/crops/sweet-pea.webp")];
  const cosmosCrop = [plate("/artwork/crops/cosmos.webp")];
  return [
    listItem({
      slug: "sweet-pea-blue-ribbon",
      varietyName: "Blue Ribbon",
      plant: sweetPeaRef,
      series: { slug: "spencer-mix", name: "Spencer" },
      sellerCount: 2,
      media: [plate("/artwork/sweet-pea-blue-ribbon.webp")],
      cropMedia: sweetPeaCrop,
    }),
    listItem({
      slug: "sweet-pea-rose-queen",
      varietyName: "Rose Queen",
      plant: sweetPeaRef,
      series: null,
      sellerCount: 0,
      media: [],
      cropMedia: sweetPeaCrop,
    }),
    listItem({
      slug: "sweet-pea-giant-wave",
      varietyName: "Giant Wave",
      plant: sweetPeaRef,
      series: null,
      sellerCount: 1,
      media: [plate("/artwork/sweet-pea-giant-wave.webp")],
      cropMedia: [],
    }),
    listItem({
      slug: "cosmos-pink-lady",
      varietyName: "Pink Lady",
      plant: cosmosRef,
      series: null,
      sellerCount: 3,
      media: [],
      cropMedia: cosmosCrop,
    }),
    listItem({
      slug: "cosmos-white-night",
      varietyName: "White Night",
      plant: cosmosRef,
      series: null,
      sellerCount: 1,
      media: [],
      cropMedia: [],
    }),
  ];
}

/** The standard fixture: 2 crops, 3 varieties (listed / zero-seller / hidden), 2 sellers. */
export function fakeCatalogState(): FakeCatalogState {
  return {
    crops: [
      crop("sweet-pea", "Sweet Pea", 10, 8, "Lathyrus odoratus"),
      crop("cosmos", "Cosmos", 4, 0),
    ],
    sellers: [
      {
        slug: "blue-ridge-seeds",
        name: "Blue Ridge Seeds",
        type: "retail",
        location: "Portland, OR",
        region: "OR",
        country: "US",
        varietyCount: 5,
        ratingCount: 0,
        isSmallFarm: true,
      },
      {
        slug: "prairie-seed-house",
        name: "Prairie Seed House",
        type: "wholesale",
        location: "Lawrence, KS",
        region: "KS",
        country: "US",
        varietyCount: 3,
        ratingCount: 0,
        isSmallFarm: false,
      },
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
    details: {
      "sweet-pea-kings-ransom": kingsRansom(),
      "cosmos-lonely-bloom": lonelyBloom(),
      "cosmos-candy-stripe": candyStripe(),
      "cosmos-mystery-bloom": mysteryBloom(),
    },
    listItems: siblingPool(),
    // Fixture (iv): a MERGED variety resolving to fixture (i)'s slug.
    merged: { "sweet-pea-old-ransom": "sweet-pea-kings-ransom" },
    seriesCatalog: [{ slug: "spencer-mix", name: "Spencer", plantSlug: "sweet-pea" }],
    smallFarmVarieties: [],
    sellerDetails: {},
    removedSellers: [],
    cropExtras: {},
    forms: fakeFormsState(),
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
    getVarietyDetail: async (slug: string) => structuredClone(state.details[slug] ?? null),
    listVarietyListItems: async (opts: { plant: string[] }) => {
      const items = state.listItems.filter((item) => opts.plant.includes(item.plant.slug));
      return { items: structuredClone(items), total: items.length };
    },
    mergedVarietyTarget: async (slug: string) => state.merged[slug] ?? null,
    ogSeller: async (slug: string): Promise<ApiOgSeller | null> => {
      const seller = state.sellers.find((s) => s.slug === slug);
      if (!seller) return null;
      return { slug: seller.slug, name: seller.name, location: seller.location, varietyCount: seller.varietyCount };
    },
    ogCrop: async (slug: string) => structuredClone(state.crops.find((c) => c.slug === slug) ?? null),
  } as unknown as CatalogApi;
}
