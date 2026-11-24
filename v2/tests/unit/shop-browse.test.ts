/**
 * Shop browse model (lib/shop-browse.ts): parsing (every param incl. the forgiving
 * cases), narrowing, the grouped order (the SH-21 fixture at unit level), relevance
 * classes, counts (an option holds other groups + query), discrimination on the full
 * set, removers + Clear All scope (sort never cleared), count-line forms, did-you-mean
 * bounds, bands, and the CS-05 possessive.
 *
 * Non-vacuity (T-A): fails on pre-build code — the module does not exist there.
 */
import { describe, expect, it } from "vitest";
import {
  clearShopAll,
  clearShopBrowseFilters,
  clearShopGroup,
  compareShopNames,
  equalShopBrowseFilters,
  hasActiveShopFilters,
  hasActiveShopState,
  isOrderable,
  isShopOptionActive,
  listingMatchesShop,
  narrowShopListings,
  parseShopCropParam,
  parseShopQueryParam,
  parseShopSortParam,
  readShopBrowseFilters,
  removeShopHue,
  shopBand,
  shopBrowseHref,
  shopBrowseTitle,
  shopCountFor,
  shopCountLine,
  shopCountsFor,
  shopCountStateFor,
  shopCropOptions,
  shopCropsFor,
  shopDidYouMean,
  shopDocumentTitle,
  shopFilterParams,
  shopGroupsFor,
  shopHasFilters,
  shopHasSearch,
  shopIsAllSoldOut,
  shopLocationsName,
  shopMatchClass,
  shopName,
  shopPossessive,
  shopRemoversFor,
  shopViewListings,
  toggleShopHue,
  withShopGroup,
  type ShopBrowseState,
  type ShopCrop,
} from "@/lib/shop-browse";
import type { Availability, PublicListing } from "@/lib/validators";

const CROPS: ShopCrop[] = [
  { slug: "zinnia", commonName: "Zinnia" },
  { slug: "sweet-pea", commonName: "Sweet Pea" },
  { slug: "cosmos", commonName: "Cosmos" },
  { slug: "nigella", commonName: "Nigella" },
];

let nextId = 1;
function listing(over: {
  varietyName?: string;
  varietySlug?: string;
  crop?: string;
  commonName?: string;
  latinName?: string | null;
  lifeCycle?: string | null;
  season_class?: "cool_season_hardy_annual" | "warm_season_tender_annual" | null;
  sowing_methods?: ("direct_sow" | "transplant")[];
  colorFamily?: string;
  availability?: Availability;
  lastCheckedAt?: string | null;
}): PublicListing {
  const id = nextId++;
  const crop = over.crop ?? "zinnia";
  return {
    id,
    variety: {
      slug: over.varietySlug ?? `v-${id}`,
      varietyName: over.varietyName ?? `Variety ${id}`,
      plant: {
        slug: crop,
        commonName: over.commonName ?? CROPS.find((c) => c.slug === crop)!.commonName,
        latinName: over.latinName ?? null,
        lifeCycle: over.lifeCycle ?? null,
        season_class: over.season_class ?? null,
        season_source_label: null,
        sowing_methods: over.sowing_methods ?? [],
        sowing_method_source_label: null,
      },
      colorSwatch: null,
      colorFamily: over.colorFamily ?? "pink",
      media: [],
      cropMedia: [],
    },
    seller: { slug: "test-farm", name: "Test Farm", location: null, region: "OR", country: "US", isSmallFarm: false },
    availability: over.availability ?? "in_stock",
    lastCheckedAt: over.lastCheckedAt === undefined ? "2026-11-15" : over.lastCheckedAt,
    firstSeenAt: "2026-11-01",
    goUrl: `https://seeds.hues.flowers/go/${id}`,
    productUrl: null,
    notes: null,
    status: "published",
    packetSizes: [],
    provenance: { source_url: null, retrieved_at: "2026-11-15", method: "human", confidence: 1 },
    sourceLabel: "Shop check",
  };
}

const rest = (): ShopBrowseState => clearShopBrowseFilters();

describe("parsing (forgiving — unknown values are All, never a 404)", () => {
  it("parses every param", () => {
    expect(
      readShopBrowseFilters(
        { crop: "zinnia", season: "cool", method: "direct", life_cycle: "annual", color_family: "pink,blue", sort: "recent", q: "  zinnia  " },
        CROPS,
      ),
    ).toEqual({ crop: "zinnia", season: "cool", method: "direct", lifeCycle: "annual", hues: ["pink", "blue"], sort: "recent", q: "zinnia" });
  });

  it("unknown crop is ignored (all-crops shop); a valid slug the shop does not stock stays and narrows to []", () => {
    expect(parseShopCropParam("not-a-crop", CROPS)).toBeNull();
    expect(parseShopCropParam("  ", CROPS)).toBeNull();
    expect(parseShopCropParam(["zinnia", "cosmos"], CROPS)).toBe("zinnia");
    // Valid but unstocked: parsing keeps it; narrowing empties (the zero-combination state, not a 404).
    const state = { ...rest(), crop: parseShopCropParam("nigella", CROPS) };
    expect(state.crop).toBe("nigella");
    const shop = [listing({ crop: "zinnia" })];
    expect(narrowShopListings(shop, state)).toEqual([]);
    // ...with the Crop remover present so the state is recoverable in place.
    expect(shopRemoversFor(state, CROPS).map((r) => r.key)).toContain("crop");
  });

  it("garbage filter values are All", () => {
    expect(readShopBrowseFilters({ season: "autumn", method: "carrier-pigeon", life_cycle: "immortal", color_family: "chartreuse" }, CROPS)).toMatchObject({
      season: null,
      method: null,
      lifeCycle: null,
      hues: [],
    });
    // Unknown hue families are dropped; known ones survive.
    expect(readShopBrowseFilters({ color_family: "pink,chartreuse" }, CROPS).hues).toEqual(["pink"]);
  });

  it("absent or garbage sort is the grouped default (availability)", () => {
    expect(parseShopSortParam(undefined)).toBe("availability");
    expect(parseShopSortParam("sellers")).toBe("availability");
    expect(parseShopSortParam("name")).toBe("name");
    expect(parseShopSortParam("recent")).toBe("recent");
  });

  it("queries trim, cap at 100 chars, and drop below 2 characters", () => {
    expect(parseShopQueryParam("  zin ")).toBe("zin");
    expect(parseShopQueryParam("z")).toBe("");
    expect(parseShopQueryParam("")).toBe("");
    expect(parseShopQueryParam(undefined)).toBe("");
    expect(parseShopQueryParam("x".repeat(101))).toBe("x".repeat(100));
    expect(parseShopQueryParam(["ab", "cd"])).toBe("ab");
  });
});

describe("narrowing (AND across groups and the query; OR within Hue)", () => {
  const shop = [
    listing({ varietyName: "A", crop: "zinnia", season_class: "warm_season_tender_annual", sowing_methods: ["direct_sow"], lifeCycle: "Annual", colorFamily: "pink" }),
    listing({ varietyName: "B", crop: "sweet-pea", season_class: "cool_season_hardy_annual", sowing_methods: ["transplant"], lifeCycle: "Hardy annual", colorFamily: "blue" }),
    listing({ varietyName: "C", crop: "zinnia", season_class: "cool_season_hardy_annual", sowing_methods: ["direct_sow", "transplant"], lifeCycle: "Biennial or short-lived perennial", colorFamily: "pink" }),
    listing({ varietyName: "D", crop: "cosmos", season_class: null, sowing_methods: [], lifeCycle: null, colorFamily: "unknown" }),
  ];

  it("each single group narrows; unclassified listings belong to no option", () => {
    expect(narrowShopListings(shop, { ...rest(), crop: "zinnia" }).map((l) => l.variety.varietyName)).toEqual(["A", "C"]);
    expect(narrowShopListings(shop, { ...rest(), season: "cool" }).map((l) => l.variety.varietyName)).toEqual(["B", "C"]);
    expect(narrowShopListings(shop, { ...rest(), method: "trays" }).map((l) => l.variety.varietyName)).toEqual(["B", "C"]);
    expect(narrowShopListings(shop, { ...rest(), lifeCycle: "annual" }).map((l) => l.variety.varietyName)).toEqual(["A", "B"]);
    expect(narrowShopListings(shop, { ...rest(), lifeCycle: "perennial" }).map((l) => l.variety.varietyName)).toEqual(["C"]);
    // D (null season, no methods, null life cycle, unknown family) is excluded by any group.
    expect(narrowShopListings(shop, { ...rest(), hues: ["pink"] }).map((l) => l.variety.varietyName)).toEqual(["A", "C"]);
  });

  it("Hue is OR within; groups AND across; the query ANDs with everything", () => {
    expect(narrowShopListings(shop, { ...rest(), hues: ["pink", "blue"] })).toHaveLength(3);
    expect(narrowShopListings(shop, { ...rest(), crop: "zinnia", hues: ["pink"] }).map((l) => l.variety.varietyName)).toEqual(["A", "C"]);
    expect(narrowShopListings(shop, { ...rest(), crop: "zinnia", hues: ["blue"] })).toEqual([]);
    expect(narrowShopListings(shop, { ...rest(), crop: "zinnia", q: "zin" }).map((l) => l.variety.varietyName)).toEqual(["A", "C"]);
    expect(narrowShopListings(shop, { ...rest(), crop: "zinnia", q: "sweet pea" })).toEqual([]);
  });
});

describe("the grouped order (SH-21 at unit level)", () => {
  // Names interleave alphabetically across the sections on purpose.
  const shop = [
    listing({ varietyName: "Zinnia Giant", availability: "in_stock" }),
    listing({ varietyName: "Apple Blossom", availability: "sold_out" }),
    listing({ varietyName: "Blue Fountain", availability: "sold_out" }),
    listing({ varietyName: "Apricot Dream", availability: "preorder" }),
    listing({ varietyName: "Copper Queen", availability: "unknown" }),
    listing({ varietyName: "Amber Waves", availability: "shop_closed" }),
  ];
  const names = (ls: PublicListing[]) => ls.map((l) => l.variety.varietyName);

  it("orderable above not-orderable; name A–Z the sole key within each section (no sub-tiering)", () => {
    expect(names(shopViewListings(shop, rest()))).toEqual([
      "Apricot Dream", // preorder (orderable)
      "Zinnia Giant", // in_stock — below preorder alphabetically, above every not-orderable listing
      "Amber Waves", // shop_closed
      "Apple Blossom", // sold_out
      "Blue Fountain", // sold_out — above unknown alphabetically (no tier order)
      "Copper Queen", // unknown
    ]);
  });

  it("sort=name is pure A–Z (the sold-out A first); sort=recent is ungrouped", () => {
    expect(names(shopViewListings(shop, { ...rest(), sort: "name" })) [0]).toBe("Amber Waves");
    expect(names(shopViewListings(shop, { ...rest(), sort: "name" }))).toEqual([
      "Amber Waves",
      "Apple Blossom",
      "Apricot Dream",
      "Blue Fountain",
      "Copper Queen",
      "Zinnia Giant",
    ]);
    const dated = [
      listing({ varietyName: "Old Stock", availability: "in_stock", lastCheckedAt: "2026-11-01" }),
      listing({ varietyName: "Fresh Soldout", availability: "sold_out", lastCheckedAt: "2026-11-20" }),
      listing({ varietyName: "Never Checked", availability: "in_stock", lastCheckedAt: null }),
    ];
    expect(names(shopViewListings(dated, { ...rest(), sort: "recent" }))).toEqual(["Fresh Soldout", "Old Stock", "Never Checked"]);
  });

  it("compareShopNames is case-insensitive with slug then id tiebreaks", () => {
    const a = listing({ varietyName: "apple", varietySlug: "a-1" });
    const b = listing({ varietyName: "Banana", varietySlug: "b-1" });
    expect(compareShopNames(a, b)).toBeLessThan(0);
    expect(compareShopNames(b, a)).toBeGreaterThan(0);
    const same1 = listing({ varietyName: "Same", varietySlug: "same-a" });
    const same2 = listing({ varietyName: "same", varietySlug: "same-b" });
    expect(compareShopNames(same1, same2)).toBeLessThan(0);
  });
});

describe("relevance (exact → prefix → substring, then A–Z)", () => {
  const shop = [
    listing({ varietyName: "Sunspot", crop: "zinnia" }),
    listing({ varietyName: "Asunder", crop: "cosmos" }),
    listing({ varietyName: "Sun", crop: "sweet-pea" }),
    listing({ varietyName: "Sunday Best", crop: "nigella" }),
  ];

  it("orders exact, then prefix, then substring; A–Z within a class", () => {
    expect(shopMatchClass(shop[2]!, "sun")).toBe(0); // exact variety name
    expect(shopMatchClass(shop[0]!, "sun")).toBe(1); // prefix of the variety
    expect(shopMatchClass(shop[3]!, "sun")).toBe(1); // prefix of a word ("Sunday")
    expect(shopMatchClass(shop[1]!, "sun")).toBe(2); // substring ("Asunder")
    expect(shopMatchClass(shop[1]!, "cosmos")).toBe(0); // exact crop name counts as exact too
    expect(shopMatchClass(shop[1]!, "dahlia")).toBeNull();
    const state = { ...rest(), q: "sun" };
    expect(shopViewListings(shop, state).map((l) => l.variety.varietyName)).toEqual(["Sun", "Sunday Best", "Sunspot", "Asunder"]);
  });

  it("matches variety name + crop common name only (never Latin)", () => {
    const l = listing({ varietyName: "Blue Vein", crop: "sweet-pea", latinName: "Lathyrus odoratus" });
    expect(shopMatchClass(l, "blue")).toBe(1);
    expect(shopMatchClass(l, "pea")).toBe(1); // crop word prefix
    expect(shopMatchClass(l, "lathyrus")).toBeNull();
  });
});

describe("counts (an option holds other groups + query; no second bucketing)", () => {
  const shop = [
    listing({ varietyName: "A", crop: "zinnia", season_class: "warm_season_tender_annual", colorFamily: "pink" }),
    listing({ varietyName: "B", crop: "sweet-pea", season_class: "cool_season_hardy_annual", colorFamily: "blue" }),
    listing({ varietyName: "C", crop: "zinnia", season_class: "cool_season_hardy_annual", colorFamily: "pink" }),
  ];
  const shopCrops = shopCropsFor(shop);

  it("a count holds every other group and the query", () => {
    // With crop=zinnia held: cool counts only C; warm only A.
    const counts = shopCountsFor(shop, { ...rest(), crop: "zinnia" }, shopCrops);
    expect(shopCountFor(counts, "season", "cool")).toBe(1);
    expect(shopCountFor(counts, "season", "warm")).toBe(1);
    expect(shopCountFor(counts, "season", null)).toBe(2); // the All cell with the group cleared
    // With a query held too: cool counts only C-with-"c".
    const qcounts = shopCountsFor(shop, { ...rest(), crop: "zinnia", q: "zz" }, shopCrops);
    expect(shopCountFor(qcounts, "season", "cool")).toBe(0); // renders 0, stays operable
    expect(shopCountFor(qcounts, "season", null)).toBe(0);
  });

  it("a selected Hue's count follows the toggle definition", () => {
    // hues=[pink]: pink's count toggles pink OFF (0 hues → all 3); blue toggles ON (pink+blue → 3).
    const counts = shopCountsFor(shop, { ...rest(), hues: ["pink"] }, shopCrops);
    expect(shopCountFor(counts, "hue", "pink")).toBe(3);
    expect(shopCountFor(counts, "hue", "blue")).toBe(3);
    expect(shopCountFor(counts, "hue", null)).toBe(3);
    // Empty hues: each family's count is its own slice.
    const all = shopCountsFor(shop, rest(), shopCrops);
    expect(shopCountFor(all, "hue", "pink")).toBe(2);
    expect(shopCountFor(all, "hue", "blue")).toBe(1);
    expect(shopCountFor(all, "hue", "red")).toBe(0);
    expect(shopCountFor(all, "hue", null)).toBe(3);
  });

  it("crop counts key by shop slug; unknown slugs read 0", () => {
    const counts = shopCountsFor(shop, rest(), shopCrops);
    expect(shopCountFor(counts, "crop", "zinnia")).toBe(2);
    expect(shopCountFor(counts, "crop", "sweet-pea")).toBe(1);
    expect(shopCountFor(counts, "crop", null)).toBe(3);
    expect(shopCountFor(counts, "crop", "nigella")).toBe(0);
  });
});

describe("discrimination (full set, never the narrowed set)", () => {
  it("a group renders only with ≥2 distinct values with ≥2 non-zero counts", () => {
    const single = [listing({ crop: "zinnia", season_class: "warm_season_tender_annual" }), listing({ crop: "zinnia", season_class: "warm_season_tender_annual" })];
    expect(shopGroupsFor(single)).toEqual([]);
    const mixed = [
      listing({ crop: "zinnia", season_class: "warm_season_tender_annual", sowing_methods: ["direct_sow"], lifeCycle: "Annual", colorFamily: "pink" }),
      listing({ crop: "sweet-pea", season_class: "cool_season_hardy_annual", sowing_methods: ["transplant"], lifeCycle: "Perennial", colorFamily: "blue" }),
    ];
    expect(shopGroupsFor(mixed)).toEqual(["crop", "season", "method", "lifeCycle", "hue"]);
  });

  it("unclassified listings belong to no value (nulls never discriminate alone)", () => {
    const shop = [listing({ season_class: "warm_season_tender_annual" }), listing({ season_class: null }), listing({ colorFamily: "unknown" })];
    expect(shopGroupsFor(shop)).toEqual([]);
  });

  it("multi-bucket life cycles discriminate (the shared lifeCycleBuckets, once)", () => {
    const shop = [listing({ lifeCycle: "Annual or biennial" }), listing({ lifeCycle: "Perennial" })];
    expect(shopGroupsFor(shop)).toContain("lifeCycle");
  });
});

describe("removers + Clear All scope", () => {
  it("one remover per group, one per hue, plus the search remover — sort never in the row", () => {
    const state: ShopBrowseState = { crop: "zinnia", season: "cool", method: null, lifeCycle: null, hues: ["pink", "blue"], sort: "recent", q: "sun" };
    const removers = shopRemoversFor(state, CROPS);
    expect(removers.map((r) => r.key)).toEqual(["crop", "season", "hue:pink", "hue:blue", "q"]);
    expect(removers[0]).toMatchObject({ label: "Crop: Zinnia", removeLabel: "Remove the Crop filter, Zinnia" });
    expect(removers[4]).toMatchObject({ label: "Search: “sun”", removeLabel: "Clear the search for sun" });
    // Each transition clears only its own scope.
    expect(removers[0]!.clear(state)).toMatchObject({ crop: null, season: "cool", q: "sun" });
    expect(removers[2]!.clear(state).hues).toEqual(["blue"]);
    expect(removers[4]!.clear(state)).toMatchObject({ q: "", crop: "zinnia", hues: ["pink", "blue"] });
  });

  it("Clear All clears filters AND query — never sort", () => {
    const state: ShopBrowseState = { crop: "zinnia", season: "cool", method: "direct", lifeCycle: "annual", hues: ["pink"], sort: "recent", q: "sun" };
    expect(clearShopAll(state)).toEqual({ crop: null, season: null, method: null, lifeCycle: null, hues: [], sort: "recent", q: "" });
  });

  it("row visibility: filters or query show it; sort alone never does", () => {
    expect(hasActiveShopState(rest())).toBe(false);
    expect(hasActiveShopState({ ...rest(), sort: "name" })).toBe(false);
    expect(hasActiveShopState({ ...rest(), q: "sun" })).toBe(true);
    expect(hasActiveShopState({ ...rest(), hues: ["pink"] })).toBe(true);
    expect(hasActiveShopFilters({ ...rest(), q: "sun" })).toBe(false);
  });
});

describe("count-line forms", () => {
  it("rest lines name the order; the phrase never changes when a section is empty", () => {
    expect(shopCountLine(rest(), 24, 1, 1)).toBe("24 listings, in stock first.");
    expect(shopCountLine({ ...rest(), sort: "name" }, 24, 1, 1)).toBe("24 listings, A–Z.");
    expect(shopCountLine({ ...rest(), sort: "recent" }, 24, 1, 1)).toBe("24 listings, most recently checked first.");
    expect(shopCountLine(rest(), 0, 1, 1)).toBe("0 listings, in stock first.");
    expect(shopCountLine(rest(), 1, 1, 1)).toBe("1 listing, in stock first.");
  });

  it("searched lines name the query; pagination appends the shipped suffix", () => {
    expect(shopCountLine({ ...rest(), q: "sun" }, 3, 1, 1)).toBe("3 matches for “sun”, best match first.");
    expect(shopCountLine({ ...rest(), q: "sun" }, 1, 1, 1)).toBe("1 match for “sun”, best match first.");
    expect(shopCountLine({ ...rest(), q: "sun" }, 0, 1, 1)).toBe("0 matches for “sun”, best match first.");
    expect(shopCountLine(rest(), 179, 2, 8)).toBe("179 listings, in stock first. · page 2 of 8");
    expect(shopCountLine({ ...rest(), q: "sun" }, 30, 2, 2)).toBe("30 matches for “sun”, best match first. · page 2 of 2");
  });
});

describe("did-you-mean bounds (in-shop names only)", () => {
  const shop = [
    listing({ varietyName: "Alison", availability: "sold_out" }),
    listing({ varietyName: "Alison Valentini", availability: "in_stock" }),
    listing({ varietyName: "Zinnia", crop: "zinnia", availability: "in_stock" }),
  ];

  it("same first letter, distance ≤2, at most one; ties to stock, then alphabetical", () => {
    expect(shopDidYouMean("alsion", shop)).toBe("Alison");
    expect(shopDidYouMean("kalison", shop)).toBeNull(); // first letter differs
    expect(shopDidYouMean("alxxxxxx", shop)).toBeNull(); // too far
    expect(shopDidYouMean("Alison", shop)).toBeNull(); // an exact match is not a correction
    expect(shopDidYouMean("zzqqx", shop)).toBeNull();
  });

  it("never suggests a name the shop does not carry", () => {
    expect(shopDidYouMean("dahlia", shop)).toBeNull();
  });
});

describe("CS-05 possessive (COPY §2's worked cases)", () => {
  it("default, s-final, possessive-containing, plural, Co., and long names", () => {
    expect(shopPossessive("GeoSeed")).toBe("GeoSeed’s");
    expect(shopPossessive("3 Porch Farm")).toBe("3 Porch Farm’s");
    expect(shopPossessive("Floret")).toBe("Floret’s");
    expect(shopPossessive("Three Brothers Blooms")).toBe("Three Brothers Blooms’");
    expect(shopPossessive("Johnny’s Selected Seeds")).toBe("Johnny’s Selected Seeds’");
    expect(shopPossessive("Peace Seedlings")).toBe("Peace Seedlings’");
    expect(shopPossessive("Botanical Interests")).toBe("Botanical Interests’");
    // The test is the final character alone.
    expect(shopPossessive("The Gardener’s Workshop")).toBe("The Gardener’s Workshop’s");
    expect(shopPossessive("Renee’s Garden")).toBe("Renee’s Garden’s");
    expect(shopPossessive("Hudson Valley Seed Co.")).toBe("Hudson Valley Seed Co.’s");
    expect(shopPossessive("Songbird Seed Co.")).toBe("Songbird Seed Co.’s");
    expect(shopPossessive("Millay and Meadowlark Flower Farm")).toBe("Millay and Meadowlark Flower Farm’s");
    expect(shopPossessive("High Mowing Organic Seeds")).toBe("High Mowing Organic Seeds’");
  });

  it("the shop and locations namings share the one rule", () => {
    expect(shopName("GeoSeed")).toBe("GeoSeed’s shop");
    expect(shopName("Peace Seedlings")).toBe("Peace Seedlings’ shop");
    expect(shopLocationsName("GeoSeed")).toBe("GeoSeed’s locations");
    expect(shopLocationsName("Peace Seedlings")).toBe("Peace Seedlings’ locations");
  });
});

describe("href builders, bands, titles, misc", () => {
  it("carries active state only; page never carried; resting sort serializes absent", () => {
    expect(shopFilterParams(rest())).toEqual({});
    const state: ShopBrowseState = { crop: "zinnia", season: "cool", method: null, lifeCycle: null, hues: ["pink", "blue"], sort: "recent", q: "sun" };
    expect(shopFilterParams(state)).toEqual({ crop: "zinnia", season: "cool", color_family: "pink,blue", q: "sun", sort: "recent" });
    expect(shopBrowseHref("/seller/geo", state)).toBe("/seller/geo?crop=zinnia&season=cool&color_family=pink%2Cblue&q=sun&sort=recent");
    expect(shopBrowseHref("/seller/geo", rest())).toBe("/seller/geo");
    expect(shopFilterParams({ ...rest(), sort: "availability" })).toEqual({});
  });

  it("bands: 0 / 1–8 / 9–24 / 25+", () => {
    expect(shopBand(0)).toBe("empty");
    expect(shopBand(1)).toBe("plain");
    expect(shopBand(8)).toBe("plain");
    expect(shopBand(9)).toBe("filters");
    expect(shopBand(24)).toBe("filters");
    expect(shopBand(25)).toBe("full");
    expect(shopBand(179)).toBe("full");
    expect(shopHasFilters(8)).toBe(false);
    expect(shopHasFilters(9)).toBe(true);
    expect(shopHasSearch(24)).toBe(false);
    expect(shopHasSearch(25)).toBe(true);
  });

  it("titles: one builder, page suffix only — state never changes the title", () => {
    expect(shopBrowseTitle("GeoSeed — Flower Seed Seller", 1)).toBe("GeoSeed — Flower Seed Seller");
    expect(shopBrowseTitle("GeoSeed — Flower Seed Seller", 2)).toBe("GeoSeed — Flower Seed Seller — page 2");
    expect(shopDocumentTitle("GeoSeed — Flower Seed Seller", 1)).toBe("GeoSeed — Flower Seed Seller | seeds.hues.flowers");
  });

  it("all-sold-out is T > 0 with zero orderable (computed on the full set)", () => {
    expect(shopIsAllSoldOut([])).toBe(false);
    expect(shopIsAllSoldOut([listing({ availability: "sold_out" }), listing({ availability: "unknown" })])).toBe(true);
    expect(shopIsAllSoldOut([listing({ availability: "sold_out" }), listing({ availability: "preorder" })])).toBe(false);
  });

  it("crop options: All first, then A–Z, no cap", () => {
    const shop = [listing({ crop: "zinnia" }), listing({ crop: "cosmos" }), listing({ crop: "sweet-pea" })];
    expect(shopCropOptions(shopCropsFor(shop))).toEqual([
      { value: null, label: "All" },
      { value: "cosmos", label: "Cosmos" },
      { value: "sweet-pea", label: "Sweet Pea" },
      { value: "zinnia", label: "Zinnia" },
    ]);
  });

  it("orderability follows §9.4 (in_stock + preorder)", () => {
    expect(isOrderable("in_stock")).toBe(true);
    expect(isOrderable("preorder")).toBe(true);
    expect(isOrderable("unknown")).toBe(false);
    expect(isOrderable("shop_closed")).toBe(false);
    expect(isOrderable("sold_out")).toBe(false);
  });

  it("equality, transitions, option-active", () => {
    expect(equalShopBrowseFilters(rest(), rest())).toBe(true);
    expect(equalShopBrowseFilters({ ...rest(), hues: ["pink", "blue"] }, { ...rest(), hues: ["blue", "pink"] })).toBe(true);
    expect(equalShopBrowseFilters(rest(), { ...rest(), q: "x" })).toBe(false);
    expect(toggleShopHue(rest(), "pink").hues).toEqual(["pink"]);
    expect(toggleShopHue({ ...rest(), hues: ["pink"] }, "pink").hues).toEqual([]);
    const s = rest();
    expect(removeShopHue(s, "pink")).toBe(s); // idempotent: removing an absent family returns the state itself
    expect(withShopGroup(rest(), "crop", "zinnia").crop).toBe("zinnia");
    expect(clearShopGroup({ ...rest(), crop: "zinnia" }, "crop").crop).toBeNull();
    expect(isShopOptionActive({ ...rest(), hues: ["pink"] }, "hue", "pink")).toBe(true);
    expect(isShopOptionActive({ ...rest(), hues: ["pink"] }, "hue", null)).toBe(false);
    expect(isShopOptionActive(rest(), "crop", null)).toBe(true);
  });
});
