/**
 * Shop-browse model (ported from v2/lib/shop-browse.ts): bands, the grouped
 * order, narrowing, search scope, counts, hrefs, removers, and lines —
 * asserted against the blue-ridge fixture set (30 listings).
 */
import { describe, expect, it } from "vitest";
import { shopCatalogState } from "./shop-catalog";
import {
  SHOP_CROP_LEGEND,
  SHOP_GROUP_ORDER,
  SHOP_SORT_OPTIONS,
  clearShopAll,
  clearShopBrowseFilters,
  clearShopGroup,
  compareShopNames,
  equalShopBrowseFilters,
  hasActiveShopFilters,
  hasActiveShopState,
  isOrderable,
  isShopGroupActive,
  isShopOptionActive,
  listingMatchesShop,
  narrowShopListings,
  parseShopCropParam,
  parseShopQueryParam,
  parseShopSortParam,
  removeShopHue,
  shopBand,
  shopBrowseFiltersFromSearch,
  shopBrowseHref,
  shopCountFor,
  shopCountLine,
  shopCountsFor,
  shopCropLine,
  shopCropsFor,
  shopDidYouMean,
  shopFilterParams,
  shopGroupsFor,
  shopHasFilters,
  shopHasSearch,
  shopIsAllSoldOut,
  shopLocationsName,
  shopName,
  shopPossessive,
  shopRemoversFor,
  shopViewListings,
  sortShopListings,
  toggleShopHue,
  withShopGroup,
} from "../../src/lib/shop-browse";

const listings = () => shopCatalogState().sellerDetails["blue-ridge-seeds"]!.listings;
const CROPS = [{ slug: "sweet-pea" }, { slug: "cosmos" }, { slug: "sunflower" }];
const rest = () => clearShopBrowseFilters();

describe("shop bands and orderability", () => {
  it("bands the tool thresholds 1–8 / 9–24 / 25+", () => {
    expect(shopBand(0)).toBe("empty");
    expect(shopBand(1)).toBe("plain");
    expect(shopBand(8)).toBe("plain");
    expect(shopBand(9)).toBe("filters");
    expect(shopBand(24)).toBe("filters");
    expect(shopBand(25)).toBe("full");
    expect(shopBand(30)).toBe("full");
    expect(shopHasFilters(8)).toBe(false);
    expect(shopHasFilters(9)).toBe(true);
    expect(shopHasSearch(24)).toBe(false);
    expect(shopHasSearch(25)).toBe(true);
  });

  it("orders in-stock + preorder above the rest (Name A–Z the sole key within)", () => {
    expect(isOrderable("in_stock")).toBe(true);
    expect(isOrderable("preorder")).toBe(true);
    expect(isOrderable("sold_out")).toBe(false);
    expect(isOrderable("shop_closed")).toBe(false);
    expect(isOrderable("unknown")).toBe(false);
    const names = sortShopListings(listings(), rest()).map((l) => l.variety.varietyName);
    expect(names.slice(0, 16)).toEqual([
      "Apple Blossom",
      "Blue Ribbon",
      "Candy Stripe",
      "Dwarf Jewel",
      "Early Wonder",
      "Floral Dance",
      "Giant Wave",
      "Honey Glow",
      "Ivory Princess",
      "Jubilee Gem",
      "King's Ransom",
      "King's Ransom",
      "Knee-Hi Mix",
      "Lavender Lady",
      "Mammoth Gold",
      "Zelda Star",
    ]);
    expect(names.slice(16)).toEqual([
      "Amber Waves",
      "Apricot Dream",
      "Butter Yellow",
      "Copper Glow",
      "Dainty Maid",
      "Ember Glow",
      "Frosted Hills",
      "Golden Hour",
      "Harvest Rose",
      "Ink Spot",
      "Joyful Noise",
      "Koko Loco",
      "Linen White",
      "Misty Rose",
    ]);
  });

  it("breaks name ties by slug, then listing id", () => {
    const [a, b] = sortShopListings(listings(), { ...rest(), sort: "name" }).filter(
      (l) => l.variety.varietyName === "King's Ransom",
    );
    expect(a!.id).toBe(1);
    expect(b!.id).toBe(3);
    expect(compareShopNames(a!, b!)).toBeLessThan(0);
  });

  it("orders ungrouped recency with unchecked last, then A–Z", () => {
    const names = sortShopListings(listings(), { ...rest(), sort: "recent" }).map((l) => l.variety.varietyName);
    expect(names[0]).toBe("Zelda Star");
    expect(names.slice(-2)).toEqual(["Koko Loco", "Misty Rose"]);
  });

  it("lets relevance own the order while a query is active", () => {
    const names = sortShopListings(listings(), { ...rest(), q: "rose" }).map((l) => l.variety.varietyName);
    expect(names.slice(0, 2)).toEqual(["Harvest Rose", "Misty Rose"]);
  });
});

describe("shop narrowing and search scope", () => {
  it("narrows AND across groups, OR within hue", () => {
    expect(narrowShopListings(listings(), { ...rest(), crop: "cosmos" })).toHaveLength(14);
    expect(narrowShopListings(listings(), { ...rest(), crop: "cosmos", season: "cool" })).toHaveLength(0);
    expect(narrowShopListings(listings(), { ...rest(), hues: ["pink", "yellow"] })).toHaveLength(21);
  });

  it("matches the query against variety and crop names only, in this shop", () => {
    expect(narrowShopListings(listings(), { ...rest(), q: "rose" }).map((l) => l.variety.varietyName).sort()).toEqual([
      "Harvest Rose",
      "Misty Rose",
    ]);
    expect(narrowShopListings(listings(), { ...rest(), q: "lonely" })).toHaveLength(0);
    expect(narrowShopListings(listings(), { ...rest(), q: "cosmos" })).toHaveLength(14);
    const l = listings().find((x) => x.variety.varietyName === "Harvest Rose")!;
    expect(listingMatchesShop(l, { ...rest(), q: "rose", crop: "cosmos" })).toBe(true);
    expect(listingMatchesShop(l, { ...rest(), q: "rose", crop: "sweet-pea" })).toBe(false);
  });

  it("renders only discriminating groups (crop leads) from the full set", () => {
    expect(SHOP_GROUP_ORDER[0]).toBe("crop");
    expect(SHOP_CROP_LEGEND).toBe("Crop");
    // Both crops are Annual: lifeCycle carries one value and stays header-only.
    expect(shopGroupsFor(listings())).toEqual(["crop", "season", "method", "hue"]);
    expect(shopCropsFor(listings())).toEqual([
      { slug: "cosmos", commonName: "Cosmos" },
      { slug: "sweet-pea", commonName: "Sweet Pea" },
    ]);
    expect(shopCropLine("Cornflower / Bachelor's Buttons")).toBe("Cornflower");
  });

  it("counts per option with other groups and the query held", () => {
    const counts = shopCountsFor(listings(), rest(), shopCropsFor(listings()));
    expect(shopCountFor(counts, "crop", null)).toBe(30);
    expect(shopCountFor(counts, "crop", "cosmos")).toBe(14);
    expect(shopCountFor(counts, "crop", "sweet-pea")).toBe(16);
    expect(shopCountFor(counts, "hue", "pink")).toBe(12);
    const narrowed = shopCountsFor(listings(), { ...rest(), crop: "cosmos" }, shopCropsFor(listings()));
    expect(shopCountFor(narrowed, "crop", null)).toBe(30);
    expect(shopCountFor(narrowed, "season", "warm")).toBe(14);
    expect(shopCountFor(narrowed, "season", "cool")).toBe(0);
  });
});

describe("shop state, parsing, and hrefs", () => {
  it("parses forgivingly (unknowns are All, never a 404)", () => {
    expect(parseShopCropParam("Nope", CROPS)).toBeNull();
    expect(parseShopCropParam("sunflower", CROPS)).toBe("sunflower");
    expect(parseShopCropParam(" Cosmos ", CROPS)).toBe("cosmos");
    expect(parseShopSortParam("bogus")).toBe("availability");
    expect(parseShopSortParam("name")).toBe("name");
    expect(parseShopQueryParam("x")).toBe("");
    expect(parseShopQueryParam("rose")).toBe("rose");
    const s = shopBrowseFiltersFromSearch("?crop=cosmos&season=warm&color_family=pink%2Cwhite&sort=name&q=rose", CROPS);
    expect(s).toEqual({ crop: "cosmos", season: "warm", method: null, lifeCycle: null, hues: ["white", "pink"], sort: "name", q: "rose" });
  });

  it("transitions groups, hues, and Clear All (sort survives)", () => {
    const s = { ...rest(), crop: "cosmos", hues: ["pink"] as ("pink")[], sort: "name" as const, q: "rose" };
    expect(isShopGroupActive(s, "crop")).toBe(true);
    expect(isShopGroupActive(s, "season")).toBe(false);
    expect(isShopOptionActive(s, "crop", "cosmos")).toBe(true);
    expect(toggleShopHue(s, "pink").hues).toEqual([]);
    expect(toggleShopHue(s, "white").hues).toEqual(["white", "pink"]);
    expect(removeShopHue(s, "white")).toBe(s);
    expect(clearShopGroup(s, "crop").crop).toBeNull();
    expect(withShopGroup(s, "season", "cool").season).toBe("cool");
    expect(clearShopAll(s)).toEqual({ crop: null, season: null, method: null, lifeCycle: null, hues: [], sort: "name", q: "" });
    expect(hasActiveShopState(rest())).toBe(false);
    expect(hasActiveShopState({ ...rest(), sort: "name" })).toBe(false);
    expect(hasActiveShopFilters({ ...rest(), q: "rose" })).toBe(false);
    expect(equalShopBrowseFilters(rest(), clearShopBrowseFilters())).toBe(true);
  });

  it("serializes states to shareable hrefs (page dropped, resting sort absent)", () => {
    expect(shopBrowseHref("/seller/x", rest())).toBe("/seller/x");
    expect(shopFilterParams({ ...rest(), crop: "cosmos", sort: "name", q: "rose" })).toEqual({
      crop: "cosmos",
      sort: "name",
      q: "rose",
    });
    expect(shopBrowseHref("/seller/x", { ...rest(), crop: "cosmos", sort: "name" })).toBe("/seller/x?crop=cosmos&sort=name");
    expect(SHOP_SORT_OPTIONS.map((o) => o.label)).toEqual(["In stock first", "Name A–Z", "Recently checked"]);
  });

  it("builds removers in group order plus the search remover (sort never)", () => {
    const removers = shopRemoversFor(
      { ...rest(), crop: "cosmos", hues: ["pink"], sort: "name", q: "rose" },
      [
        { slug: "cosmos", commonName: "Cosmos" },
        { slug: "sweet-pea", commonName: "Sweet Pea" },
      ],
    );
    expect(removers.map((r) => r.label)).toEqual(["Crop: Cosmos", "Hue: Pink", "Search: “rose”"]);
    expect(removers[0]!.removeLabel).toBe("Remove the Crop filter, Cosmos");
  });

  it("words the count line for rest and searched views", () => {
    expect(shopCountLine(rest(), 30, 1, 2)).toBe("30 listings, in stock first. · page 1 of 2");
    expect(shopCountLine({ ...rest(), sort: "name" }, 30, 2, 2)).toBe("30 listings, A–Z. · page 2 of 2");
    expect(shopCountLine({ ...rest(), q: "rose" }, 2, 1, 1)).toBe("2 matches for “rose”, best match first.");
  });

  it("suggests did-you-mean from the shop's names only", () => {
    expect(shopDidYouMean("rose", listings())).toBeNull();
    expect(shopDidYouMean("appla blossom", listings())).toBe("Apple Blossom");
    expect(shopDidYouMean("lonely", listings())).toBeNull();
    expect(shopIsAllSoldOut(listings())).toBe(false);
    expect(shopIsAllSoldOut([])).toBe(false);
  });

  it("forms possessives without rewording", () => {
    expect(shopPossessive("Blue Ridge Seeds")).toBe("Blue Ridge Seeds’");
    expect(shopPossessive("Two Roads Farm")).toBe("Two Roads Farm’s");
    expect(shopName("Blue Ridge Seeds")).toBe("Blue Ridge Seeds’ shop");
    expect(shopLocationsName("Two Roads Farm")).toBe("Two Roads Farm’s locations");
  });

  it("narrowing and ordering compose in one view pass", () => {
    const names = shopViewListings(listings(), { ...rest(), crop: "cosmos" }).map((l) => l.variety.varietyName);
    expect(names).toEqual([
      "Candy Stripe",
      "Dwarf Jewel",
      "Floral Dance",
      "Honey Glow",
      "Jubilee Gem",
      "Lavender Lady",
      "Zelda Star",
      "Apricot Dream",
      "Butter Yellow",
      "Dainty Maid",
      "Frosted Hills",
      "Harvest Rose",
      "Joyful Noise",
      "Linen White",
    ]);
  });
});
