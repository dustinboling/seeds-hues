/**
 * Shop/hub route-resolver unit tests: slug validation, the gone/missing
 * split, strict crop filters, page bounds, and purge routing — against the
 * in-memory shop fake (the HTTP suite proves the same behavior over the
 * wire). Every expectation is hardcoded from shop-catalog.ts.
 */
import { describe, expect, it } from "vitest";
import { createDataCache } from "../../src/data/cache";
import { loadCropDetail, loadSellerDetail, loadSeriesDetail, loadVarietyDetail } from "../../src/data/load";
import { resolveCropRoute, resolveSeriesRoute, resolveShopRoute, resolveStateRoute } from "../../src/server/shop-route";
import { createShopFakeApi, shopCatalogState } from "./shop-catalog";

const setup = () => {
  const state = shopCatalogState();
  const api = createShopFakeApi(state);
  return { state, api: api as never, cache: createDataCache() };
};

describe("resolveShopRoute", () => {
  it("resolves page 1 with the grouped view, counts, and crops", async () => {
    const { api, cache } = setup();
    const r = await resolveShopRoute(api, cache, { slug: "blue-ridge-seeds", search: "" });
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.seller.name).toBe("Blue Ridge Seeds");
    expect(r.total).toBe(30);
    expect(r.page).toBe(1);
    expect(r.pages).toBe(2);
    expect(r.items).toHaveLength(24);
    expect(r.items[0]!.variety.varietyName).toBe("Apple Blossom");
    expect(r.items[15]!.variety.varietyName).toBe("Zelda Star");
    expect(r.stated).toBe(false);
    expect(r.crops.map((c) => c.slug).sort()).toEqual(["cosmos", "sunflower", "sweet-pea"]);
  });

  it("resolves stated views, pages, and the empty shop", async () => {
    const { api, cache } = setup();
    const filtered = await resolveShopRoute(api, cache, { slug: "blue-ridge-seeds", search: "?crop=cosmos" });
    expect(filtered.kind).toBe("ok");
    if (filtered.kind !== "ok") return;
    expect(filtered.total).toBe(14);
    expect(filtered.stated).toBe(true);
    const page2 = await resolveShopRoute(api, cache, { slug: "blue-ridge-seeds", search: "?page=2" });
    expect(page2.kind).toBe("ok");
    if (page2.kind !== "ok") return;
    expect(page2.items.map((l) => l.variety.varietyName)).toEqual([
      "Harvest Rose",
      "Ink Spot",
      "Joyful Noise",
      "Koko Loco",
      "Linen White",
      "Misty Rose",
    ]);
    const empty = await resolveShopRoute(api, cache, { slug: "quiet-hollow-farm", search: "" });
    expect(empty.kind).toBe("ok");
    if (empty.kind !== "ok") return;
    expect(empty.total).toBe(0);
    expect(empty.items).toHaveLength(0);
  });

  it("splits gone from missing from malformed", async () => {
    const { api, cache } = setup();
    expect((await resolveShopRoute(api, cache, { slug: "shuttered-seed-co", search: "" })).kind).toBe("gone");
    expect((await resolveShopRoute(api, cache, { slug: "no-such-seller", search: "" })).kind).toBe("notFound");
    expect((await resolveShopRoute(api, cache, { slug: "Bad_Slug", search: "" })).kind).toBe("notFound");
  });

  it("404s out-of-range and malformed pages", async () => {
    const { api, cache } = setup();
    expect((await resolveShopRoute(api, cache, { slug: "blue-ridge-seeds", search: "?page=3" })).kind).toBe("notFound");
    expect((await resolveShopRoute(api, cache, { slug: "blue-ridge-seeds", search: "?page=abc" })).kind).toBe("notFound");
    expect((await resolveShopRoute(api, cache, { slug: "quiet-hollow-farm", search: "?page=2" })).kind).toBe("notFound");
    expect((await resolveShopRoute(api, cache, { slug: "blue-ridge-seeds", search: "?crop=cosmos&page=2" })).kind).toBe(
      "notFound",
    );
  });
});

describe("resolveCropRoute", () => {
  it("resolves page 1 resting with counts, hues, and series", async () => {
    const { api, cache } = setup();
    const r = await resolveCropRoute(api, cache, { slug: "sunflower", search: "" });
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.data.crop.commonName).toBe("Sunflower");
    expect(r.data.total).toBe(30);
    expect(r.data.items).toHaveLength(24);
    expect(r.data.items[0]!.varietyName).toBe("Autumn Beauty");
    expect(r.data.counts.sellers).toEqual({ all: 30, has: 25, none: 5 });
    expect(r.data.hues).toEqual(["white", "pink", "orange", "yellow", "red", "unknown"]);
    expect(r.data.series.map((s) => s.slug)).toEqual(["sunbeam", "moonshadow"]);
  });

  it("filters, sorts, and pages the walked set", async () => {
    const { api, cache } = setup();
    const filtered = await resolveCropRoute(api, cache, { slug: "sunflower", search: "?has_sellers=true" });
    expect(filtered.kind).toBe("ok");
    if (filtered.kind !== "ok") return;
    expect(filtered.data.total).toBe(25);
    expect(filtered.data.pages).toBe(2);
    const pink = await resolveCropRoute(api, cache, { slug: "sunflower", search: "?color_family=pink" });
    expect(pink.kind).toBe("ok");
    if (pink.kind !== "ok") return;
    expect(pink.data.total).toBe(5);
    const page2 = await resolveCropRoute(api, cache, { slug: "sunflower", search: "?page=2" });
    expect(page2.kind).toBe("ok");
    if (page2.kind !== "ok") return;
    expect(page2.data.items.map((v) => v.varietyName)).toEqual([
      "Strawberry Blonde",
      "Sunbright",
      "Sunrich Orange",
      "Teddy Bear",
      "Valentine",
      "Velvet Queen",
    ]);
  });

  it("404s malformed filters, unknown crops, and out-of-range pages", async () => {
    const { api, cache } = setup();
    expect((await resolveCropRoute(api, cache, { slug: "sunflower", search: "?has_sellers=yes" })).kind).toBe("notFound");
    expect((await resolveCropRoute(api, cache, { slug: "sunflower", search: "?color_family=PINK!" })).kind).toBe("notFound");
    expect((await resolveCropRoute(api, cache, { slug: "no-such-crop", search: "" })).kind).toBe("notFound");
    expect((await resolveCropRoute(api, cache, { slug: "sunflower", search: "?page=3" })).kind).toBe("notFound");
  });
});

describe("resolveSeriesRoute and resolveStateRoute", () => {
  it("resolves the full series grid with honest counts", async () => {
    const { api, cache } = setup();
    const r = await resolveSeriesRoute(api, cache, { slug: "sunbeam" });
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.detail.varieties).toHaveLength(8);
    expect(r.detail.varietyCount).toBe(8);
    expect(r.detail.varietiesWithSellers).toBe(8);
    const zero = await resolveSeriesRoute(api, cache, { slug: "moonshadow" });
    expect(zero.kind).toBe("ok");
    if (zero.kind !== "ok") return;
    expect(zero.detail.varieties).toHaveLength(3);
    expect(zero.detail.varietiesWithSellers).toBe(0);
    expect((await resolveSeriesRoute(api, cache, { slug: "no-such-series" })).kind).toBe("notFound");
  });

  it("resolves states from the visible-seller set with page windows", async () => {
    const { api, cache } = setup();
    const r = await resolveStateRoute(api, cache, { slug: "oregon", search: "" });
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.data.state).toEqual({ code: "OR", name: "Oregon", slug: "oregon", sellerCount: 2 });
    expect(r.data.total).toBe(2);
    expect(r.data.items.map((s) => s.slug).sort()).toEqual(["blue-ridge-seeds", "faraway-seeds"]);
    const single = await resolveStateRoute(api, cache, { slug: "kansas", search: "" });
    expect(single.kind).toBe("ok");
    if (single.kind !== "ok") return;
    expect(single.data.total).toBe(1);
    // Real but sellerless, and unknown slugs alike: true 404.
    expect((await resolveStateRoute(api, cache, { slug: "california", search: "" })).kind).toBe("notFound");
    expect((await resolveStateRoute(api, cache, { slug: "not-a-state", search: "" })).kind).toBe("notFound");
    expect((await resolveStateRoute(api, cache, { slug: "oregon", search: "?page=2" })).kind).toBe("notFound");
  });
});

describe("detail loaders and cross-template purge routing", () => {
  it("registers related-entity paths so one tag fans out across templates", async () => {
    const { api, cache } = setup();
    await loadSellerDetail("blue-ridge-seeds", api, cache);
    await loadVarietyDetail("sweet-pea-kings-ransom", api, cache);
    await loadCropDetail("sunflower", api, cache);
    await loadSeriesDetail("sunbeam", api, cache);
    // A seller tag purges the shop entry AND the variety entries behind its sellers.
    expect(cache.invalidatePaths(["/seller/blue-ridge-seeds"])).toEqual(
      expect.arrayContaining(["seller:detail:blue-ridge-seeds", "variety:detail:sweet-pea-kings-ransom"]),
    );
  });

  it("exposes related paths for the edge purge", async () => {
    const { api, cache } = setup();
    await loadSellerDetail("blue-ridge-seeds", api, cache);
    await loadVarietyDetail("sweet-pea-kings-ransom", api, cache);
    // The variety page's edge entry must drop when the seller tag fires —
    // the tag's own paths never name it, so the entries' registrations do.
    expect(cache.relatedPaths(["/seller/blue-ridge-seeds"])).toEqual(
      expect.arrayContaining(["/seller/blue-ridge-seeds", "/variety/sweet-pea-kings-ransom"]),
    );
  });
});
