/**
 * Slice 4 browse/search fixtures: the base fake catalog plus clearly-labeled
 * SYNTHESIZED catalog entries (never production claims) sized to
 * discriminate the browse and search surfaces:
 *
 * - 55 varieties (5 curated + 50 "Testbloom NN") → 3 pages at 24/page,
 *   spanning hues (pink/yellow/white), seasons (cool/warm via their crops),
 *   life cycles (Annual/Perennial), and a 7-variety small-farm-only subset;
 * - 26 sellers (2 curated + 24 "Testbloom Farm NN") → 2 pages, across OR,
 *   KS, and CA, mixed types and badge flags;
 * - a "Testbloom" crop + "Testbloom Cascade" series so one query matches
 *   across all four search groups (Crops, Series, Varieties, Sellers).
 *
 * Deterministic orders the HTTP suite hardcodes (all sorts are the live
 * orders — lower(name), slug):
 * - name sort first: "Blue Ribbon"; page 2 first: "Testbloom 21"; page 3 =
 *   Testbloom 45–50 + "White Night" (7 items);
 * - availability sort first: "Pink Lady" (in stock, 3 sellers, 3 in stock);
 * - recent sort first: "Testbloom 14" (checked Nov 24, earliest name on ties);
 * - sellers first: "Blue Ridge Seeds"; page 2 = Testbloom Farm 23–24.
 */
import type {
  ApiCrop,
  ApiPlantRef,
  ApiSearchResponse,
  ApiSellerItem,
  ApiSeriesCrop,
  ApiVarietyListItem,
} from "../../src/data/types";
import type { CatalogApi } from "../../src/data/api";
import { fakeCatalogState, type FakeCatalogState } from "./fake-catalog";
import {
  stubSearch,
  stubSellerMatches,
  stubSortSellers,
  stubSortVarieties,
  stubVarietyMatches,
  type StubSeriesSeed,
  type StubVarietyFilters,
  type StubVarietySort,
} from "../stub/catalog-filter";

const NOT_RATED = { state: "not_yet_rated", average: null, review_count: 0 } as const;

const TESTBLOOM_SWEET_PEA: ApiPlantRef = {
  slug: "sweet-pea",
  commonName: "Sweet Pea",
  latinName: "Lathyrus odoratus",
  lifeCycle: "Annual",
  season_class: "cool_season_hardy_annual",
  season_source_label: "The Gardener's Workshop",
  sowing_methods: ["direct_sow", "transplant"],
  sowing_method_source_label: "Floret",
};

const TESTBLOOM_COSMOS: ApiPlantRef = {
  slug: "cosmos",
  commonName: "Cosmos",
  latinName: "Cosmos bipinnatus",
  lifeCycle: "Perennial",
  season_class: "warm_season_tender_annual",
  season_source_label: "The Gardener's Workshop",
  sowing_methods: ["direct_sow"],
  sowing_method_source_label: "Floret",
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** NN 01–50 → hue (pink/yellow/white cycle) + counts + dates, all deterministic. */
export function testbloomVariety(nn: number): ApiVarietyListItem {
  const n = pad2(nn);
  const sellerCount = nn % 4;
  return {
    slug: `testbloom-${n}`,
    varietyName: `Testbloom ${n}`,
    plant: structuredClone(nn % 2 === 1 ? TESTBLOOM_SWEET_PEA : TESTBLOOM_COSMOS),
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: { slug: "testbloom-cascade", name: "Testbloom Cascade" },
    colorSwatch: null,
    colorFamily: nn % 3 === 1 ? "pink" : nn % 3 === 2 ? "white" : "yellow",
    listingCount: sellerCount,
    sellerCount,
    inStockCount: nn % 2,
    lastCheckedAt: sellerCount > 0 ? `2026-11-${pad2(10 + (nn % 15))}T00:00:00.000Z` : null,
    indexable: true,
    rating: { ...NOT_RATED },
    media: [],
    cropMedia: [],
  };
}

const SELLER_TYPES = ["retail", "wholesale", "specialty"] as const;

export function testbloomSeller(nn: number): ApiSellerItem {
  const n = pad2(nn);
  const region = nn <= 8 ? "OR" : nn <= 16 ? "KS" : "CA";
  const location = region === "OR" ? "Portland, OR" : region === "KS" ? "Lawrence, KS" : "Davis, CA";
  return {
    slug: `testbloom-farm-${n}`,
    name: `Testbloom Farm ${n}`,
    type: SELLER_TYPES[nn % 3]!,
    location,
    region,
    country: "US",
    varietyCount: nn % 5,
    ratingCount: 0,
    isSmallFarm: nn % 2 === 1,
  };
}

export const TESTBLOOM_CROP: ApiCrop = {
  slug: "testbloom",
  commonName: "Testbloom",
  latinName: "Testbloomia fictitious",
  lifeCycle: "Annual",
  season_class: "cool_season_hardy_annual",
  sowing_methods: ["direct_sow"],
  varietyCount: 50,
  varietiesWithSellers: 38,
  lastUpdated: "2026-11-20",
  media: [],
};

export const TESTBLOOM_SERIES: StubSeriesSeed = { slug: "testbloom-cascade", name: "Testbloom Cascade", plantSlug: "testbloom" };

/**
 * The 7-variety small-farm-only subset (every member has ≥1 listing — a
 * badged listing needs one), spanning hues (yellow/white/pink) and seasons
 * (cool + one warm) so AND-intersections stay non-trivial.
 */
export const SMALL_FARM_SLUGS = [
  "testbloom-03",
  "testbloom-05",
  "testbloom-11",
  "testbloom-17",
  "testbloom-23",
  "testbloom-37",
  "testbloom-38",
];

/** The full browse/seed-search fixture state: base catalog + synthesized entries. */
export function browseCatalogState(): FakeCatalogState {
  const state = fakeCatalogState();
  const varieties: ApiVarietyListItem[] = [];
  for (let nn = 1; nn <= 50; nn++) varieties.push(testbloomVariety(nn));
  state.listItems = [...state.listItems, ...varieties];
  const sellers: ApiSellerItem[] = [];
  for (let nn = 1; nn <= 24; nn++) sellers.push(testbloomSeller(nn));
  state.sellers = [...state.sellers, ...sellers];
  state.crops = [...state.crops, TESTBLOOM_CROP];
  state.seriesCatalog = [...state.seriesCatalog, TESTBLOOM_SERIES];
  state.smallFarmVarieties = [...SMALL_FARM_SLUGS];
  // The snapshot stays coherent with the served lists (sitemap membership +
  // listed/zero-seller segmentation read it): one row per synthesized entry,
  // one listing row per variety the fixtures give sellers to.
  const varietyRows = varieties.map((v, i) => ({
    id: 100 + i,
    slug: v.slug,
    indexable: true,
    updated_seq: 100 + i,
  }));
  const sellerRows = sellers.map((s, i) => ({
    id: 100 + i,
    slug: s.slug,
    region: s.region,
    country: s.country,
    updated_seq: 200 + i,
  }));
  const listingRows = varieties
    .filter((v) => v.sellerCount > 0)
    .map((v, i) => ({ id: 1000 + i, variety_id: 100 + varieties.indexOf(v), seller_id: 1 }));
  state.snapshot = {
    ...state.snapshot,
    varieties: [...state.snapshot.varieties, ...varietyRows],
    sellers: [...state.snapshot.sellers, ...sellerRows],
    listings: [...state.snapshot.listings, ...listingRows],
  };
  return state;
}

/**
 * The in-memory fake for the Slice 4 loader unit tests: the new CatalogApi
 * reads over fixture state, sharing the stub's filter/sort/search logic so
 * the two implementations cannot drift. Every read clones (a real API
 * returns fresh JSON per fetch — without this the cache would alias the
 * state and no test could observe staleness).
 */
export function createBrowseFakeApi(state: FakeCatalogState): Pick<
  CatalogApi,
  "walkVarieties" | "countVarieties" | "walkSellers" | "searchWide" | "seriesCrop" | "listCrops"
> {
  const smallFarm = (): ReadonlySet<string> => new Set(state.smallFarmVarieties);
  return {
    listCrops: async () => ({ items: structuredClone(state.crops), total: state.crops.length }),
    walkVarieties: async (filters: StubVarietyFilters, sort: StubVarietySort) => {
      const items = stubSortVarieties(
        state.listItems.filter((item) => stubVarietyMatches(item, filters, smallFarm())),
        sort,
      );
      return { items: structuredClone(items), total: items.length };
    },
    countVarieties: async (filters: StubVarietyFilters) =>
      state.listItems.filter((item) => stubVarietyMatches(item, filters, smallFarm())).length,
    walkSellers: async (filters: { region?: string[] } = {}) => {
      const items = stubSortSellers(state.sellers.filter((s) => stubSellerMatches(s, { region: filters.region })));
      return { items: structuredClone(items), total: items.length };
    },
    searchWide: async (q: string): Promise<ApiSearchResponse> =>
      structuredClone(
        stubSearch(
          {
            varieties: state.listItems,
            smallFarmSlugs: smallFarm(),
            crops: state.crops,
            series: state.seriesCatalog,
            sellers: state.sellers,
          },
          q,
          { limit: 50 },
        ),
      ),
    seriesCrop: async (slug: string): Promise<ApiSeriesCrop | null> => {
      const seed = state.seriesCatalog.find((s) => s.slug === slug);
      if (!seed) return null;
      const crop = state.crops.find((c) => c.slug === seed.plantSlug);
      if (!crop) return null;
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
      };
    },
  };
}
