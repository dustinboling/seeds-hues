/**
 * Slice 5 fixture coherence: the shop/hub fixtures' hand-computed facts
 * (counts, orders, sharing, statuses) hold exactly as the HTTP suite
 * hardcodes them. Guards the suite's expectations, not the app.
 */
import { describe, expect, it } from "vitest";
import { shopCatalogState } from "./shop-catalog";

describe("shop catalog fixtures", () => {
  it("blue-ridge carries 30 listings with the designed stock mix", () => {
    const state = shopCatalogState();
    const listings = state.sellerDetails["blue-ridge-seeds"]!.listings;
    expect(listings).toHaveLength(30);
    const byAvailability = Map.groupBy(listings, (l) => l.availability);
    expect(byAvailability.get("in_stock")).toHaveLength(12);
    expect(byAvailability.get("preorder")).toHaveLength(4);
    expect(byAvailability.get("sold_out")).toHaveLength(8);
    expect(byAvailability.get("shop_closed")).toHaveLength(2);
    expect(byAvailability.get("unknown")).toHaveLength(4);
    expect(state.sellers.find((s) => s.slug === "blue-ridge-seeds")!.varietyCount).toBe(30);
  });

  it("shares King's Ransom's listings between detail and shop (one row, two reads)", () => {
    const state = shopCatalogState();
    const detail = state.details["sweet-pea-kings-ransom"]!;
    const shop = state.sellerDetails["blue-ridge-seeds"]!.listings;
    expect(shop).toContain(detail.listings.find((l) => l.id === 1));
    expect(shop).toContain(detail.listings.find((l) => l.id === 3));
    const prairieShop = state.sellerDetails["prairie-seed-house"]!.listings;
    expect(prairieShop.map((l) => l.id)).toContain(2);
    expect(prairieShop.map((l) => l.id)).toEqual(expect.arrayContaining([10, 11, 20]));
    expect(prairieShop).toHaveLength(12);
  });

  it("sunflower carries 30 varieties, 25 with sellers, hues spanning six families", () => {
    const state = shopCatalogState();
    const members = state.listItems.filter((v) => v.plant.slug === "sunflower");
    expect(members).toHaveLength(30);
    expect(members.filter((v) => v.sellerCount > 0)).toHaveLength(25);
    expect(new Set(members.map((v) => v.colorFamily))).toEqual(
      new Set(["pink", "yellow", "red", "orange", "white", "unknown"]),
    );
    const crop = state.crops.find((c) => c.slug === "sunflower")!;
    expect(crop.varietyCount).toBe(30);
    expect(crop.varietiesWithSellers).toBe(25);
  });

  it("sunbeam has 8 members with sellers; moonshadow has 3 with zero sellers", () => {
    const state = shopCatalogState();
    const sunbeam = state.listItems.filter((v) => v.series?.slug === "sunbeam");
    const moonshadow = state.listItems.filter((v) => v.series?.slug === "moonshadow");
    expect(sunbeam).toHaveLength(8);
    expect(sunbeam.every((v) => v.sellerCount > 0)).toBe(true);
    expect(moonshadow).toHaveLength(3);
    expect(moonshadow.every((v) => v.sellerCount === 0)).toBe(true);
  });

  it("the grouped shop order tiles page 1 as 16 + 8 and page 2 as 6", () => {
    const state = shopCatalogState();
    const listings = state.sellerDetails["blue-ridge-seeds"]!.listings;
    const orderable = (a: (typeof listings)[number]): boolean => a.availability === "in_stock" || a.availability === "preorder";
    const byName = [...listings].sort((a, b) => {
      const an = a.variety.varietyName.toLowerCase();
      const bn = b.variety.varietyName.toLowerCase();
      if (an !== bn) return an < bn ? -1 : 1;
      if (a.variety.slug !== b.variety.slug) return a.variety.slug < b.variety.slug ? -1 : 1;
      return a.id - b.id;
    });
    const grouped = [...byName].sort((a, b) => Number(orderable(b)) - Number(orderable(a)) || 0);
    // Stable sort keeps the A–Z order within each group (verified explicitly).
    const names = grouped.map((l) => l.variety.varietyName);
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
    expect(names.slice(16, 24)).toEqual([
      "Amber Waves",
      "Apricot Dream",
      "Butter Yellow",
      "Copper Glow",
      "Dainty Maid",
      "Ember Glow",
      "Frosted Hills",
      "Golden Hour",
    ]);
    expect(names.slice(24)).toEqual([
      "Harvest Rose",
      "Ink Spot",
      "Joyful Noise",
      "Koko Loco",
      "Linen White",
      "Misty Rose",
    ]);
  });

  it("states resolve OR/KS/TX/VT with 2/1/1/1 sellers; California is absent", () => {
    const state = shopCatalogState();
    const regions = state.sellers.map((s) => s.region);
    expect(regions.filter((r) => r === "OR")).toHaveLength(2);
    expect(regions.filter((r) => r === "KS")).toHaveLength(1);
    expect(regions.filter((r) => r === "TX")).toHaveLength(1);
    expect(regions.filter((r) => r === "VT")).toHaveLength(1);
    expect(regions).not.toContain("CA");
  });

  it("the removed seller is known to the status source only", () => {
    const state = shopCatalogState();
    expect(state.removedSellers).toEqual(["shuttered-seed-co"]);
    expect(state.sellers.some((s) => s.slug === "shuttered-seed-co")).toBe(false);
    expect(state.sellerDetails["shuttered-seed-co"]).toBeUndefined();
  });

  it("quiet-hollow carries zero listings with fitting prose", () => {
    const state = shopCatalogState();
    const quiet = state.sellerDetails["quiet-hollow-farm"]!;
    expect(quiet.listings).toHaveLength(0);
    expect(quiet.varietyCount).toBe(0);
    expect(quiet.description).toBe("A quiet hillside farm.");
  });
});
