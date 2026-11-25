/**
 * Slice 5 shop/hub fixtures: the base fake catalog plus clearly-labeled
 * SYNTHESIZED catalog entries (never production claims) sized to
 * discriminate the shop and hub surfaces:
 *
 * - (i) blue-ridge-seeds: 30 listings (page 2 exists), mixed stock
 *   (in_stock/preorder/sold_out/shop_closed/unknown), packet sizes,
 *   checked dates, "Portland, OR" (parseable), a long description (the
 *   m-5 head-only branch), Small Farm badged, CS phone + email;
 * - (ii) two-roads-farm: 3 listings, primary physical + mailing locations;
 * - (iii) faraway-seeds: 2 listings, location "Online only" (no
 *   PostalAddress may be emitted);
 * - (iv) quiet-hollow-farm: zero listings (200, indexable);
 * - (v) shuttered-seed-co: removed (the seller-status source reports
 *   gone → 410), absent from every list;
 * - (vi) sunflower: 30 varieties (page 2 exists), hues spanning six
 *   families, sunbeam series subset (8) for the crop filter test;
 * - (vii) sunbeam (8 members, all with sellers) and moonshadow (3
 *   members, ZERO with sellers — 200, indexable);
 * - (viii) states OR (2 sellers, plural) / KS / TX / VT (1 each,
 *   singular); California is real but absent (404).
 *
 * Cross-fixture sharing (the invalidation spot proof): Blue Ridge's shop
 * listings with ids 1 and 3 ARE King's Ransom's detail listings (same
 * object), and Prairie's 2/10/11/20 likewise — one listing row read
 * through two endpoints. The stub clones per response, so the app's
 * caches never alias this state.
 *
 * Deterministic orders the HTTP suite hardcodes (grouped shop order:
 * orderable A–Z, then the rest A–Z — Name A–Z the sole key in each):
 * - shop page 1 = the 16 orderable (Apple Blossom … Zelda Star) + the
 *   first 8 non-orderable (Amber Waves … Golden Hour);
 * - shop page 2 = Harvest Rose, Ink Spot, Joyful Noise, Koko Loco, Linen
 *   White, Misty Rose (positions 25–30);
 * - the grouping proof: "Zelda Star" (orderable, pos 16) renders before
 *   "Amber Waves" (non-orderable, pos 17) though Z > A;
 * - crop page 1 = Autumn Beauty … Soraya (24); page 2 = Strawberry
 *   Blonde, Sunbright, Sunrich Orange, Teddy Bear, Valentine, Velvet
 *   Queen (positions 25–30); ?color_family=pink → 5; ?has_sellers=true
 *   → 25; ?series=sunbeam → 8.
 */
import type {
  ApiCrop,
  ApiCropDetail,
  ApiPlantRef,
  ApiPublicListing,
  ApiSellerDetail,
  ApiSellerItem,
  ApiSellerRef,
  ApiSellerStatus,
  ApiSeriesDetail,
  ApiVarietyListItem,
} from "../../src/data/types";
import type { CatalogApi } from "../../src/data/api";
import { fakeCatalogState, type FakeCatalogState } from "./fake-catalog";
import { createBrowseFakeApi } from "./browse-catalog";
import { stubSortVarieties } from "../stub/catalog-filter";

const NOT_RATED = { state: "not_yet_rated", average: null, review_count: 0 } as const;

const SWEET_PEA: ApiPlantRef = {
  slug: "sweet-pea",
  commonName: "Sweet Pea",
  latinName: "Lathyrus odoratus",
  lifeCycle: "Annual",
  season_class: "cool_season_hardy_annual",
  season_source_label: "The Gardener's Workshop",
  sowing_methods: ["direct_sow", "transplant"],
  sowing_method_source_label: "Floret",
};

const COSMOS: ApiPlantRef = {
  slug: "cosmos",
  commonName: "Cosmos",
  latinName: "Cosmos bipinnatus",
  lifeCycle: "Annual",
  season_class: "warm_season_tender_annual",
  season_source_label: "The Gardener's Workshop",
  sowing_methods: ["direct_sow"],
  sowing_method_source_label: "Floret",
};

const SUNFLOWER: ApiPlantRef = {
  slug: "sunflower",
  commonName: "Sunflower",
  latinName: "Helianthus annuus",
  lifeCycle: "Annual",
  season_class: "warm_season_tender_annual",
  season_source_label: "The Gardener's Workshop",
  sowing_methods: ["direct_sow"],
  sowing_method_source_label: "Floret",
};

const BLUE_RIDGE: ApiSellerRef = {
  slug: "blue-ridge-seeds",
  name: "Blue Ridge Seeds",
  location: "Portland, OR",
  region: "OR",
  country: "US",
  isSmallFarm: true,
};

const PRAIRIE: ApiSellerRef = {
  slug: "prairie-seed-house",
  name: "Prairie Seed House",
  location: "Lawrence, KS",
  region: "KS",
  country: "US",
  isSmallFarm: false,
};

const TWO_ROADS: ApiSellerRef = {
  slug: "two-roads-farm",
  name: "Two Roads Farm",
  location: "Austin, TX",
  region: "TX",
  country: "US",
  isSmallFarm: true,
};

const FARAWAY: ApiSellerRef = {
  slug: "faraway-seeds",
  name: "Faraway Seeds",
  location: "Online only",
  region: "OR",
  country: "US",
  isSmallFarm: false,
};

const nameSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function shopListing(opts: {
  id: number;
  seller: ApiSellerRef;
  plant: ApiPlantRef;
  varietyName: string;
  colorFamily: string;
  availability: ApiPublicListing["availability"];
  lastCheckedAt: string | null;
  packetSizes: ApiPublicListing["packetSizes"];
  notes?: string | null;
  media?: boolean;
}): ApiPublicListing {
  const varietySlug = `${opts.plant.slug}-${nameSlug(opts.varietyName)}`;
  const productUrl = `https://shop.example.com/${opts.seller.slug}/${nameSlug(opts.varietyName)}`;
  return {
    id: opts.id,
    variety: {
      slug: varietySlug,
      varietyName: opts.varietyName,
      plant: structuredClone(opts.plant),
      colorSwatch: null,
      colorFamily: opts.colorFamily,
      media: opts.media
        ? [{ url: `/artwork/${varietySlug}.webp`, licence: "CC BY-NC 4.0", credit: "Hues Floral Park" }]
        : [],
      cropMedia: [],
    },
    seller: opts.seller,
    availability: opts.availability,
    lastCheckedAt: opts.lastCheckedAt,
    firstSeenAt: "2026-09-01T00:00:00.000Z",
    goUrl: `https://seeds.hues.flowers/go/${opts.id}`,
    productUrl,
    notes: opts.notes ?? null,
    status: "published",
    packetSizes: opts.packetSizes,
    provenance: { source_url: productUrl, retrieved_at: opts.lastCheckedAt, method: "human", confidence: 0.95 },
    sourceLabel: null,
  };
}

const packets25 = [{ label: "25 seeds", seedCount: 25 }];

/**
 * Blue Ridge's 28 synthesized listings (ids 100–127 join the shared ids 1
 * and 3): 14 orderable + 14 non-orderable, across sweet-pea (16 of 30)
 * and cosmos (14 of 30), hues cycling pink/yellow/white.
 */
function blueRidgeSynth(): ApiPublicListing[] {
  const rows: [number, string, ApiPlantRef, ApiPublicListing["availability"], string | null][] = [
    [100, "Zelda Star", COSMOS, "in_stock", "2026-11-21T08:00:00.000Z"],
    [101, "Apple Blossom", SWEET_PEA, "preorder", "2026-11-19T08:00:00.000Z"],
    [102, "Blue Ribbon", SWEET_PEA, "in_stock", "2026-11-18T08:00:00.000Z"],
    [103, "Candy Stripe", COSMOS, "in_stock", "2026-11-17T08:00:00.000Z"],
    [104, "Dwarf Jewel", COSMOS, "preorder", null],
    [105, "Early Wonder", SWEET_PEA, "in_stock", "2026-11-16T08:00:00.000Z"],
    [106, "Floral Dance", COSMOS, "in_stock", "2026-11-15T08:00:00.000Z"],
    [107, "Giant Wave", SWEET_PEA, "preorder", "2026-11-14T08:00:00.000Z"],
    [108, "Honey Glow", COSMOS, "in_stock", "2026-11-13T08:00:00.000Z"],
    [109, "Ivory Princess", SWEET_PEA, "in_stock", "2026-11-12T08:00:00.000Z"],
    [110, "Jubilee Gem", COSMOS, "in_stock", "2026-11-11T08:00:00.000Z"],
    [111, "Knee-Hi Mix", SWEET_PEA, "in_stock", null],
    [112, "Lavender Lady", COSMOS, "in_stock", "2026-11-10T08:00:00.000Z"],
    [113, "Mammoth Gold", SWEET_PEA, "in_stock", "2026-11-09T08:00:00.000Z"],
    [114, "Amber Waves", SWEET_PEA, "sold_out", "2026-11-20T08:00:00.000Z"],
    [115, "Apricot Dream", COSMOS, "sold_out", "2026-11-19T08:00:00.000Z"],
    [116, "Butter Yellow", COSMOS, "shop_closed", "2026-11-08T08:00:00.000Z"],
    [117, "Copper Glow", SWEET_PEA, "sold_out", "2026-11-07T08:00:00.000Z"],
    [118, "Dainty Maid", COSMOS, "unknown", null],
    [119, "Ember Glow", SWEET_PEA, "sold_out", "2026-11-06T08:00:00.000Z"],
    [120, "Frosted Hills", COSMOS, "sold_out", "2026-11-05T08:00:00.000Z"],
    [121, "Golden Hour", SWEET_PEA, "shop_closed", "2026-11-04T08:00:00.000Z"],
    [122, "Harvest Rose", COSMOS, "unknown", null],
    [123, "Ink Spot", SWEET_PEA, "sold_out", "2026-11-03T08:00:00.000Z"],
    [124, "Joyful Noise", COSMOS, "sold_out", "2026-11-02T08:00:00.000Z"],
    [125, "Koko Loco", SWEET_PEA, "unknown", null],
    [126, "Linen White", COSMOS, "sold_out", "2026-11-01T08:00:00.000Z"],
    [127, "Misty Rose", SWEET_PEA, "unknown", null],
  ];
  const hues = ["pink", "yellow", "white"];
  return rows.map(([id, varietyName, plant, availability, lastCheckedAt], i) =>
    shopListing({
      id,
      seller: BLUE_RIDGE,
      plant,
      varietyName,
      colorFamily: hues[i % 3]!,
      availability,
      lastCheckedAt,
      packetSizes:
        id === 101
          ? [
              { label: "25 seeds", seedCount: 25 },
              { label: "1 g", seedCount: 90 },
            ]
          : id === 113
            ? [{ label: "100 seeds", seedCount: 100 }]
            : id % 5 === 0
              ? []
              : packets25,
      notes: id === 105 ? "New harvest." : null,
      media: id === 100,
    }),
  );
}

/** Prairie's 8 synthesized listings (ids 200–207 join the shared 2/10/11/20). */
function prairieSynth(): ApiPublicListing[] {
  const rows: [number, string, ApiPlantRef, ApiPublicListing["availability"]][] = [
    [200, "Prairie Rose", SWEET_PEA, "in_stock"],
    [201, "Amber Star", COSMOS, "sold_out"],
    [202, "Blue Boy", SWEET_PEA, "preorder"],
    [203, "Coral Charm", COSMOS, "in_stock"],
    [204, "Dawn Chorus", SWEET_PEA, "shop_closed"],
    [205, "Ember Star", COSMOS, "unknown"],
    [206, "Frost King", SWEET_PEA, "in_stock"],
    [207, "Golden Boy", COSMOS, "sold_out"],
  ];
  const hues = ["pink", "yellow", "red", "white"];
  return rows.map(([id, varietyName, plant, availability], i) =>
    shopListing({
      id,
      seller: PRAIRIE,
      plant,
      varietyName,
      colorFamily: hues[i % 4]!,
      availability,
      lastCheckedAt: availability === "unknown" ? null : `2026-11-${String(10 + (i % 12)).padStart(2, "0")}T08:00:00.000Z`,
      packetSizes: packets25,
    }),
  );
}

/** The 30 sunflower variety names, already in A–Z order (page 1 = first 24). */
const SUNFLOWER_NAMES = [
  "Autumn Beauty",
  "Buttercream",
  "Chianti",
  "Chocolate Cherry",
  "Claret",
  "Evening Sun",
  "Florenza",
  "Giant Sungold",
  "Gold Rush",
  "Indian Blanket",
  "Italian White",
  "Lemon Queen",
  "Moulin Rouge",
  "Orange Hobbit",
  "Pacino Gold",
  "Pastiche",
  "Prado Red",
  "ProCut Gold",
  "ProCut Orange",
  "Red Sun",
  "Ring of Fire",
  "Ruby Eclipse",
  "Solano Flame",
  "Soraya",
  "Strawberry Blonde",
  "Sunbright",
  "Sunrich Orange",
  "Teddy Bear",
  "Valentine",
  "Velvet Queen",
];

/** Zero-seller members (everything else has sellers): moonshadow's three plus two. */
const SUNFLOWER_ZERO = new Set(["Italian White", "Sunbright", "Teddy Bear", "Valentine", "Velvet Queen"]);

/** Sunbeam's 8 members (all with sellers); moonshadow's 3 (zero with sellers). */
const SUNBEAM = new Set(SUNFLOWER_NAMES.slice(0, 8));
const MOONSHADOW = new Set(["Teddy Bear", "Valentine", "Velvet Queen"]);

const SUNFLOWER_HUES = ["pink", "yellow", "red", "orange", "white", "unknown"];

function sunflowerVarieties(): ApiVarietyListItem[] {
  return SUNFLOWER_NAMES.map((varietyName, i) => {
    const zero = SUNFLOWER_ZERO.has(varietyName);
    const sellerCount = zero ? 0 : (i % 4) + 1;
    return {
      slug: `sunflower-${nameSlug(varietyName)}`,
      varietyName,
      plant: structuredClone(SUNFLOWER),
      category: { slug: "flowers", name: "Flowers" },
      subcategory: null,
      series: SUNBEAM.has(varietyName)
        ? { slug: "sunbeam", name: "Sunbeam" }
        : MOONSHADOW.has(varietyName)
          ? { slug: "moonshadow", name: "Moonshadow" }
          : null,
      colorSwatch: null,
      colorFamily: SUNFLOWER_HUES[i % 6]!,
      listingCount: sellerCount,
      sellerCount,
      inStockCount: sellerCount === 0 ? 0 : i % 3 === 0 ? 0 : 1,
      lastCheckedAt: sellerCount > 0 ? `2026-11-${String(10 + (i % 15)).padStart(2, "0")}T00:00:00.000Z` : null,
      indexable: true,
      rating: { ...NOT_RATED },
      media:
        i === 0
          ? [{ url: "/artwork/sunflower-autumn-beauty.webp", licence: "CC BY-NC 4.0", credit: "Hues Floral Park" }]
          : [],
      cropMedia: [],
    };
  });
}

const SUNFLOWER_CROP: ApiCrop = {
  slug: "sunflower",
  commonName: "Sunflower",
  latinName: "Helianthus annuus",
  lifeCycle: "Annual",
  season_class: "warm_season_tender_annual",
  sowing_methods: ["direct_sow"],
  varietyCount: 30,
  varietiesWithSellers: 25,
  lastUpdated: "2026-11-21",
  media: [{ url: "/crop/sunflower.webp" }],
};

function sellerDetail(opts: {
  item: ApiSellerItem;
  homepage: string | null;
  description: string | null;
  orderingNotes: string | null;
  updatedAt: string;
  listings: ApiPublicListing[];
  customerServicePhone: string | null;
  customerServiceEmail: string | null;
  locations: ApiSellerDetail["locations"];
  importedRating?: ApiSellerDetail["importedRating"];
}): ApiSellerDetail {
  return {
    slug: opts.item.slug,
    name: opts.item.name,
    type: opts.item.type,
    location: opts.item.location,
    region: opts.item.region,
    country: opts.item.country,
    homepage: opts.homepage,
    ratingCount: opts.item.ratingCount,
    ratingAverage: null,
    rating: { ...NOT_RATED },
    importedRating: opts.importedRating ?? null,
    isSmallFarm: opts.item.isSmallFarm,
    description: opts.description,
    orderingNotes: opts.orderingNotes,
    varietyCount: opts.listings.length,
    updatedAt: opts.updatedAt,
    claimStatus: "unclaimed",
    shipsTo: ["US"],
    isSiteOwner: false,
    listings: opts.listings,
    customerServicePhone: opts.customerServicePhone,
    customerServiceEmail: opts.customerServiceEmail,
    locations: opts.locations,
  };
}

/** The full shop/hub fixture state: base catalog + Slice 5 entries. */
export function shopCatalogState(): FakeCatalogState {
  const state = fakeCatalogState();

  // (vi–vii) Sunflower + its 30 varieties + two series.
  const members = sunflowerVarieties();
  state.crops = [...state.crops, SUNFLOWER_CROP];
  state.listItems = [...state.listItems, ...members];
  state.seriesCatalog = [
    ...state.seriesCatalog,
    { slug: "sunbeam", name: "Sunbeam", plantSlug: "sunflower" },
    { slug: "moonshadow", name: "Moonshadow", plantSlug: "sunflower" },
  ];
  state.cropExtras = {
    sunflower: {
      description: "Sunflowers turn their faces to the sun and give armloads of cutting stems.",
      sowingNotes: "Sow after frost; sunflowers dislike transplanting.",
      life_cycle: "Annual",
      hardiness: "Tolerates light frost once established.",
      grower_guide: {
        growing: {
          sowing: "Sow 1 inch deep after frost.",
          germination: "7 to 10 days.",
          transplanting: null,
          days_to_bloom: "70 to 90 days.",
          spacing: "6 inches.",
          growing: "Full sun and steady water.",
          harvest_for_cutting: "Cut when petals lift.",
          good_to_know: ["Succession sow every two weeks.", "Single-stem types need no pinching."],
        },
        seed_saving: {
          difficulty: "Easy",
          when_to_harvest: "When heads brown.",
          how_to_collect: "Rub seeds from the head.",
          cleaning: null,
          drying: "Dry on screens.",
          storage: "Cool and dry.",
          pollination_notes: null,
        },
      },
      series: [
        { slug: "sunbeam", name: "Sunbeam" },
        { slug: "moonshadow", name: "Moonshadow" },
      ],
    },
  };

  // (i–iv) The shop sellers join the visible-seller list with coherent counts.
  const extraSellers: ApiSellerItem[] = [
    {
      slug: "two-roads-farm",
      name: "Two Roads Farm",
      type: "retail",
      location: "Austin, TX",
      region: "TX",
      country: "US",
      varietyCount: 3,
      ratingCount: 0,
      isSmallFarm: true,
    },
    {
      slug: "faraway-seeds",
      name: "Faraway Seeds",
      type: "specialty",
      location: "Online only",
      region: "OR",
      country: "US",
      varietyCount: 2,
      ratingCount: 0,
      isSmallFarm: false,
    },
    {
      slug: "quiet-hollow-farm",
      name: "Quiet Hollow Farm",
      type: "wholesale",
      location: "Burlington, VT",
      region: "VT",
      country: "US",
      varietyCount: 0,
      ratingCount: 0,
      isSmallFarm: false,
    },
  ];
  state.sellers.find((s) => s.slug === "blue-ridge-seeds")!.varietyCount = 30;
  state.sellers.find((s) => s.slug === "prairie-seed-house")!.varietyCount = 12;
  state.sellers = [...state.sellers, ...extraSellers];

  // Shared listing rows: the SAME objects the variety details carry.
  const byId = new Map<number, ApiPublicListing>();
  for (const detail of Object.values(state.details)) for (const l of detail.listings) byId.set(l.id, l);
  const shared = (id: number): ApiPublicListing => {
    const l = byId.get(id);
    if (!l) throw new Error(`shop catalog: no shared listing ${id}`);
    return l;
  };

  const blueRidge = state.sellers.find((s) => s.slug === "blue-ridge-seeds")!;
  const prairie = state.sellers.find((s) => s.slug === "prairie-seed-house")!;
  const twoRoads = extraSellers[0]!;
  const faraway = extraSellers[1]!;
  const quietHollow = extraSellers[2]!;

  state.sellerDetails = {
    "blue-ridge-seeds": sellerDetail({
      item: blueRidge,
      homepage: "https://blueridgeseeds.example.com",
      description:
        "We are a family farm in the Willamette Valley growing open-pollinated flower seed on twelve acres, and we test every lot for germination before it ships.",
      orderingNotes: "Ships within two weeks.",
      updatedAt: "2026-11-20T00:00:00.000Z",
      listings: [shared(1), shared(3), ...blueRidgeSynth()],
      customerServicePhone: "(503) 555-0114",
      customerServiceEmail: "help@blueridgeseeds.example.com",
      locations: [],
    }),
    "prairie-seed-house": sellerDetail({
      item: prairie,
      homepage: null,
      description: "Heirloom seed, plainly grown.",
      orderingNotes: null,
      updatedAt: "2026-11-17T00:00:00.000Z",
      listings: [shared(2), shared(10), shared(11), shared(20), ...prairieSynth()],
      customerServicePhone: "(785) 555-0199",
      customerServiceEmail: null,
      locations: [],
      importedRating: {
        source: "Google",
        placeName: "Prairie Seed House",
        placeId: "ChIJprairie seed house",
        rating: 4.7,
        reviewCount: 132,
        fetchedDate: "2026-11-15",
      },
    }),
    "two-roads-farm": sellerDetail({
      item: twoRoads,
      homepage: "https://tworoadsfarm.example.com",
      description: "Two fields, one farm.",
      orderingNotes: null,
      updatedAt: "2026-11-16T00:00:00.000Z",
      listings: [300, 301, 302].map((id, i) =>
        shopListing({
          id,
          seller: TWO_ROADS,
          plant: SWEET_PEA,
          varietyName: ["North Field", "South Field", "Gate Row"][i]!,
          colorFamily: "pink",
          availability: "in_stock",
          lastCheckedAt: "2026-11-16T08:00:00.000Z",
          packetSizes: packets25,
        }),
      ),
      customerServicePhone: null,
      customerServiceEmail: null,
      locations: [
        { kind: "physical", street: "4810 Springdale Rd", city: "Austin", state: "TX", zip: "78723", isPrimary: true },
        { kind: "mailing", street: "PO Box 1408", city: "Austin", state: "TX", zip: "78768", isPrimary: false },
      ],
    }),
    "faraway-seeds": sellerDetail({
      item: faraway,
      homepage: null,
      description: null,
      orderingNotes: null,
      updatedAt: "2026-11-15T00:00:00.000Z",
      listings: [400, 401].map((id, i) =>
        shopListing({
          id,
          seller: FARAWAY,
          plant: COSMOS,
          varietyName: ["Distant Star", "Far Horizon"][i]!,
          colorFamily: "white",
          availability: i === 0 ? "in_stock" : "sold_out",
          lastCheckedAt: i === 0 ? "2026-11-15T08:00:00.000Z" : null,
          packetSizes: packets25,
        }),
      ),
      customerServicePhone: null,
      customerServiceEmail: "hello@farawayseeds.example.com",
      locations: [],
    }),
    "quiet-hollow-farm": sellerDetail({
      item: quietHollow,
      homepage: null,
      description: "A quiet hillside farm.",
      orderingNotes: null,
      updatedAt: "2026-11-14T00:00:00.000Z",
      listings: [],
      customerServicePhone: null,
      customerServiceEmail: null,
      locations: [],
    }),
  };

  // (v) The removed seller: known to the status source only — no list row, no detail.
  state.removedSellers = ["shuttered-seed-co"];

  // The snapshot stays coherent with the served lists (one row per new
  // variety/seller, one listing row per with-seller sunflower variety).
  const varietyRows = members.map((v, i) => ({ id: 200 + i, slug: v.slug, indexable: true, updated_seq: 300 + i }));
  const sellerRows = extraSellers.map((s, i) => ({
    id: 10 + i,
    slug: s.slug,
    region: s.region,
    country: s.country,
    updated_seq: 400 + i,
  }));
  const listingRows = members
    .filter((v) => v.sellerCount > 0)
    .map((v, i) => ({ id: 2000 + i, variety_id: 200 + members.indexOf(v), seller_id: 1 }));
  state.snapshot = {
    ...state.snapshot,
    varieties: [...state.snapshot.varieties, ...varietyRows],
    sellers: [...state.snapshot.sellers, ...sellerRows],
    listings: [...state.snapshot.listings, ...listingRows],
  };
  return state;
}

/**
 * The in-memory fake for the Slice 5 loader unit tests: the new CatalogApi
 * reads over fixture state. Every read clones (a real API returns fresh
 * JSON per fetch — without this the cache would alias the state and no
 * test could observe staleness).
 */
export function createShopFakeApi(state: FakeCatalogState): Pick<
  CatalogApi,
  | "getSellerDetail"
  | "sellerStatus"
  | "walkCropDetail"
  | "getSeriesDetail"
  | "walkSellers"
  | "listCrops"
  | "getVarietyDetail"
> {
  const browse = createBrowseFakeApi(state);
  return {
    walkSellers: browse.walkSellers,
    listCrops: browse.listCrops,
    getVarietyDetail: async (slug: string) => structuredClone(state.details[slug] ?? null),
    getSellerDetail: async (slug: string) => structuredClone(state.sellerDetails[slug] ?? null),
    sellerStatus: async (slug: string): Promise<ApiSellerStatus> => {
      if (state.removedSellers.includes(slug)) return { status: "gone" };
      if (state.sellerDetails[slug] || state.sellers.some((s) => s.slug === slug)) return { status: "ok" };
      return { status: "missing" };
    },
    walkCropDetail: async (slug: string): Promise<{ detail: ApiCropDetail; total: number } | null> => {
      const crop = state.crops.find((c) => c.slug === slug);
      if (!crop) return null;
      const extra = state.cropExtras[slug] ?? {
        description: null,
        sowingNotes: null,
        life_cycle: null,
        hardiness: null,
        grower_guide: null,
        series: [],
      };
      const items = stubSortVarieties(
        state.listItems.filter((item) => item.plant.slug === slug),
        "name",
      );
      return {
        detail: {
          slug: crop.slug,
          commonName: crop.commonName,
          latinName: crop.latinName,
          lifeCycle: crop.lifeCycle,
          season_class: crop.season_class,
          sowing_methods: [...crop.sowing_methods],
          varietyCount: crop.varietyCount,
          varietiesWithSellers: crop.varietiesWithSellers,
          lastUpdated: crop.lastUpdated,
          media: structuredClone(crop.media),
          description: extra.description,
          sowingNotes: extra.sowingNotes,
          life_cycle: extra.life_cycle,
          hardiness: extra.hardiness,
          grower_guide: structuredClone(extra.grower_guide),
          series: structuredClone(extra.series),
          varieties: structuredClone(items),
        },
        total: items.length,
      };
    },
    getSeriesDetail: async (slug: string): Promise<ApiSeriesDetail | null> => {
      const seed = state.seriesCatalog.find((s) => s.slug === slug);
      if (!seed) return null;
      const crop = state.crops.find((c) => c.slug === seed.plantSlug);
      if (!crop) return null;
      const members = stubSortVarieties(
        state.listItems.filter((item) => item.series?.slug === slug),
        "name",
      );
      return {
        slug: seed.slug,
        name: seed.name,
        plant: {
          slug: crop.slug,
          commonName: crop.commonName,
          latinName: crop.latinName,
          lifeCycle: crop.lifeCycle,
          season_class: crop.season_class,
          season_source_label: null,
          sowing_methods: [...crop.sowing_methods],
          sowing_method_source_label: null,
        },
        varietyCount: members.length,
        varietiesWithSellers: members.filter((m) => m.listingCount > 0).length,
        varieties: structuredClone(members),
      };
    },
  };
}

