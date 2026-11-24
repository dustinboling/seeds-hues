/**
 * Browse/search loader unit tests: paging windows, read-side sorts and
 * filters, the count matrices, grouped search totals, did-you-mean, and
 * purge routing — against the in-memory browse fake (the HTTP suite proves
 * the same behavior over the wire). Every expectation is hardcoded from
 * the fixture distributions in browse-catalog.ts.
 */
import { describe, expect, it } from "vitest";
import { createDataCache } from "../../src/data/cache";
import { loadSearchResults, loadSellerBrowse, loadSellerStates, loadVarietyBrowse } from "../../src/data/load";
import { pathsForTag } from "../../src/data/revalidate";
import type { BrowseFilterState } from "../../src/lib/browse";
import { browseCatalogState, createBrowseFakeApi } from "./browse-catalog";
import { fakeCatalogState } from "./fake-catalog";

const REST: BrowseFilterState = { season: null, method: null, lifeCycle: null, hue: [], smallFarm: false, sort: "name" };

const setup = () => {
  const state = browseCatalogState();
  const api = createBrowseFakeApi(state);
  return { state, api: api as never, cache: createDataCache() };
};

describe("loadVarietyBrowse", () => {
  it("pages the resting set (55 total, 24/24/7, alphabetical)", async () => {
    const { api, cache } = setup();
    const p1 = await loadVarietyBrowse(REST, 1, api, cache);
    expect(p1.total).toBe(55);
    expect(p1.pages).toBe(3);
    expect(p1.items).toHaveLength(24);
    expect(p1.items[0]!.varietyName).toBe("Blue Ribbon");
    expect(p1.items[23]!.varietyName).toBe("Testbloom 20");
    const p2 = await loadVarietyBrowse(REST, 2, api, cache);
    expect(p2.items).toHaveLength(24);
    expect(p2.items[0]!.varietyName).toBe("Testbloom 21");
    const p3 = await loadVarietyBrowse(REST, 3, api, cache);
    expect(p3.items).toHaveLength(7);
    expect(p3.items[6]!.varietyName).toBe("White Night");
  });

  it("sorts availability read-side (Pink Lady first) and recent (Testbloom 14 first)", async () => {
    const { api, cache } = setup();
    const avail = await loadVarietyBrowse({ ...REST, sort: "availability" }, 1, api, cache);
    expect(avail.items[0]!.varietyName).toBe("Pink Lady");
    const recent = await loadVarietyBrowse({ ...REST, sort: "recent" }, 1, api, cache);
    expect(recent.items[0]!.varietyName).toBe("Testbloom 14");
    // The counts matrix is order-independent: identical under every sort.
    expect(avail.counts).toEqual(p1Counts(await loadVarietyBrowse(REST, 1, api, cache)));
    expect(recent.counts).toEqual(p1Counts(await loadVarietyBrowse(REST, 1, api, cache)));
  });

  const p1Counts = (d: { counts: unknown }): unknown => d.counts;

  it("filters hue (OR within) and ANDs across groups", async () => {
    const { api, cache } = setup();
    const yellow = await loadVarietyBrowse({ ...REST, hue: ["yellow"] }, 1, api, cache);
    expect(yellow.total).toBe(16);
    expect(yellow.items[0]!.varietyName).toBe("Testbloom 03");
    const union = await loadVarietyBrowse({ ...REST, hue: ["white", "yellow"] }, 1, api, cache);
    expect(union.total).toBe(33);
    const anded = await loadVarietyBrowse({ ...REST, hue: ["yellow"], season: "cool" }, 1, api, cache);
    expect(anded.total).toBe(8);
    expect(anded.items.map((v) => v.varietyName)).toContain("Testbloom 03");
    const cool = await loadVarietyBrowse({ ...REST, season: "cool" }, 1, api, cache);
    expect(cool.total).toBe(28);
    const small = await loadVarietyBrowse({ ...REST, smallFarm: true }, 1, api, cache);
    expect(small.total).toBe(7);
    expect(small.items.map((v) => v.varietyName)).toContain("Testbloom 05");
  });

  it("computes the full counts matrix at rest (zero kept, smallFarm on=7)", async () => {
    const { api, cache } = setup();
    const { counts } = await loadVarietyBrowse(REST, 1, api, cache);
    expect(counts).toEqual({
      season: { all: 55, options: { cool: 28, warm: 27 } },
      method: { all: 55, options: { direct: 55, trays: 28 } },
      lifeCycle: { all: 55, options: { annual: 30, biennial: 0, perennial: 25 } },
      hue: {
        all: 55,
        options: {
          white: 17,
          blush: 0,
          pink: 22,
          peach: 0,
          orange: 0,
          yellow: 16,
          red: 0,
          burgundy: 0,
          purple: 0,
          blue: 0,
          green: 0,
          chocolate: 0,
          mix: 0,
        },
      },
      smallFarm: { all: 55, on: 7 },
    });
  });

  it("holds other groups in every cell (yellow-held: season-cool 8, hue-all 55)", async () => {
    const { api, cache } = setup();
    const { counts } = await loadVarietyBrowse({ ...REST, hue: ["yellow"] }, 1, api, cache);
    expect(counts.season.options.cool).toBe(8);
    expect(counts.season.options.warm).toBe(8);
    expect(counts.hue.all).toBe(55);
    expect(counts.hue.options.yellow).toBe(55); // toggling the last family off clears the group
    expect(counts.hue.options.white).toBe(33); // toggling white on: yellow + white
    expect(counts.smallFarm).toEqual({ all: 16, on: 1 }); // testbloom-03 is the one yellow small-farm variety
  });

  it("purges through the existing variety/list tags (register, don't fork)", async () => {
    const { state, api, cache } = setup();
    await loadVarietyBrowse(REST, 1, api, cache);
    await loadVarietyBrowse({ ...REST, hue: ["yellow"] }, 1, api, cache);
    expect(cache.size()).toBeGreaterThan(0);
    // Every browse key starts with the browse:variety: prefix (the HTTP proof asserts this shape).
    const purged = cache.invalidatePaths(pathsForTag("variety:testbloom-05"));
    expect(purged.length).toBeGreaterThan(0);
    expect(purged.every((k) => k.startsWith("browse:variety:"))).toBe(true);
    expect(cache.invalidatePaths(pathsForTag("list:variety"))).toEqual([]);
    // And the reload observes the catalog write (no stale aliasing).
    state.listItems.find((v) => v.slug === "testbloom-05")!.varietyName = "Testbloom 05 Restocked";
    const fresh = await loadVarietyBrowse(REST, 1, api, cache);
    expect(fresh.items.map((v) => v.varietyName)).toContain("Testbloom 05 Restocked");
  });
});

describe("loadSellerStates + loadSellerBrowse", () => {
  it("derives states alphabetical with counts (CA 8, KS 9, OR 9)", async () => {
    const { api, cache } = setup();
    expect(await loadSellerStates(api, cache)).toEqual([
      { code: "CA", name: "California", slug: "california", sellerCount: 8 },
      { code: "KS", name: "Kansas", slug: "kansas", sellerCount: 9 },
      { code: "OR", name: "Oregon", slug: "oregon", sellerCount: 9 },
    ]);
  });

  it("pages the resting set (26 total, 24 + 2, name order)", async () => {
    const { api, cache } = setup();
    const p1 = await loadSellerBrowse({ state: null }, 1, api, cache);
    expect(p1.total).toBe(26);
    expect(p1.pages).toBe(2);
    expect(p1.items).toHaveLength(24);
    expect(p1.items[0]!.name).toBe("Blue Ridge Seeds");
    expect(p1.counts).toEqual({ all: 26, options: { CA: 8, KS: 9, OR: 9 } });
    const p2 = await loadSellerBrowse({ state: null }, 2, api, cache);
    expect(p2.items.map((s) => s.name)).toEqual(["Testbloom Farm 23", "Testbloom Farm 24"]);
  });

  it("narrows to the state's sellers (OR: Blue Ridge + Farm 01–08)", async () => {
    const { api, cache } = setup();
    const or = await loadSellerBrowse({ state: "OR" }, 1, api, cache);
    expect(or.total).toBe(9);
    expect(or.items[0]!.name).toBe("Blue Ridge Seeds");
    expect(or.items.map((s) => s.name)).toContain("Testbloom Farm 08");
    expect(or.counts.all).toBe(26);
  });

  it("purges through the existing seller/list tags", async () => {
    const { api, cache } = setup();
    await loadSellerBrowse({ state: null }, 1, api, cache);
    const purged = cache.invalidatePaths(pathsForTag("seller:testbloom-farm-01"));
    expect(purged.length).toBeGreaterThan(0);
    expect(purged.every((k) => k.startsWith("browse:seller:"))).toBe(true);
  });
});

describe("loadSearchResults", () => {
  it("groups testbloom across all four groups with the truthful total (50+1+1+5=57)", async () => {
    const { api, cache } = setup();
    const res = await loadSearchResults("testbloom", REST, api, cache);
    expect(res.total).toBe(57);
    expect(res.varieties).toHaveLength(50);
    expect(res.crops.map((r) => r.slug)).toEqual(["testbloom"]);
    expect(res.series.map((r) => r.slug)).toEqual(["testbloom-cascade"]);
    expect(res.sellers.map((r) => r.slug)).toEqual([
      "testbloom-farm-01",
      "testbloom-farm-02",
      "testbloom-farm-03",
      "testbloom-farm-04",
      "testbloom-farm-05",
    ]);
    expect(res.suggestion).toBeNull();
    expect(res.varieties[0]!.href).toBe("/variety/testbloom-01");
  });

  it("filters read-side per group (cool: 25 varieties + crop + series + 5 sellers = 32)", async () => {
    const { api, cache } = setup();
    const res = await loadSearchResults("testbloom", { ...REST, season: "cool" }, api, cache);
    expect(res.varieties).toHaveLength(25);
    expect(res.crops).toHaveLength(1);
    expect(res.series).toHaveLength(1);
    expect(res.sellers).toHaveLength(5);
    expect(res.total).toBe(32);
  });

  it("moves hue on the variety slice only (yellow: 16 varieties, other groups intact)", async () => {
    const { api, cache } = setup();
    const res = await loadSearchResults("testbloom", { ...REST, hue: ["yellow"] }, api, cache);
    expect(res.varieties).toHaveLength(16);
    expect(res.crops).toHaveLength(1);
    expect(res.series).toHaveLength(1);
    expect(res.sellers).toHaveLength(5);
    expect(res.total).toBe(23);
  });

  it("suggests Testbloom for testbloomx (zero results) and nothing for zxqv", async () => {
    const { api, cache } = setup();
    const typo = await loadSearchResults("testbloomx", REST, api, cache);
    expect(typo.total).toBe(0);
    expect(typo.suggestion).toEqual({ name: "Testbloom", href: "/search?q=Testbloom" });
    const none = await loadSearchResults("zxqv", REST, api, cache);
    expect(none.total).toBe(0);
    expect(none.suggestion).toBeNull();
  });

  it("counts each chip's state (cool-held: season-all 57, warm 27, smallFarm fail-closed)", async () => {
    const { api, cache } = setup();
    const res = await loadSearchResults("testbloom", { ...REST, season: "cool" }, api, cache);
    expect(res.counts.season.all).toBe(57);
    // Warm: 25 warm varieties + 5 sellers — the Testbloom crop and its
    // series are cool, so they drop out of the warm cell.
    expect(res.counts.season.options).toEqual({ cool: 32, warm: 30 });
    expect(res.counts.smallFarm).toEqual({ all: 32, on: 0 });
  });

  it("registers search entries against /search (max-age refresh — Bea names no search fan-out)", async () => {
    const { api, cache } = setup();
    await loadSearchResults("testbloom", REST, api, cache);
    const purged = cache.invalidatePaths(["/search"]);
    expect(purged.length).toBeGreaterThan(0);
    expect(purged.every((k) => k.startsWith("browse:search:"))).toBe(true);
    // No existing tag fans out to /search (asserted, not assumed).
    for (const tag of ["variety:testbloom-01", "seller:testbloom-farm-01", "crop:testbloom", "list:variety", "list:seller"]) {
      expect(pathsForTag(tag), tag).not.toContain("/search");
    }
  });

  it("shares the variety walk with browse (one walk, two readers)", async () => {
    const { api, cache } = setup();
    await loadVarietyBrowse(REST, 1, api, cache);
    const before = cache.size();
    await loadSearchResults("testbloom", REST, api, cache);
    // Search adds its wide/response/series entries but NO second variety walk.
    const keys = cache.invalidatePaths(["/variety", "/search"]);
    expect(keys.filter((k) => k === "browse:variety:walk:0:name")).toHaveLength(1);
    expect(before).toBeGreaterThan(0);
  });
});

describe("base catalog compatibility", () => {
  it("loads browse snapshots over the small base catalog too", async () => {
    const state = fakeCatalogState();
    const api = createBrowseFakeApi(state) as never;
    const cache = createDataCache();
    const browse = await loadVarietyBrowse(REST, 1, api, cache);
    expect(browse.total).toBe(5);
    const sellers = await loadSellerBrowse({ state: null }, 1, api, cache);
    expect(sellers.total).toBe(2);
  });
});
