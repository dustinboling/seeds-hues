/**
 * Browse/search route-resolution unit tests: strict paging (true 404s),
 * forgiving filters, and the search empty state — driven directly against
 * the in-memory browse fake (the HTTP suite proves the wire behavior).
 */
import { describe, expect, it } from "vitest";
import { createDataCache } from "../../src/data/cache";
import { resolveSearch, resolveSellerBrowse, resolveVarietyBrowse } from "../../src/server/browse-route";
import { browseCatalogState, createBrowseFakeApi } from "./browse-catalog";

const setup = () => ({ api: createBrowseFakeApi(browseCatalogState()) as never, cache: createDataCache() });

describe("resolveVarietyBrowse", () => {
  it("resolves the resting pages with totals and windows", async () => {
    const { api, cache } = setup();
    const p1 = await resolveVarietyBrowse(api, cache, { search: "" });
    expect(p1.kind).toBe("ok");
    if (p1.kind !== "ok") return;
    expect(p1.data.total).toBe(55);
    expect(p1.data.page).toBe(1);
    expect(p1.data.items).toHaveLength(24);
    const p2 = await resolveVarietyBrowse(api, cache, { search: "?page=2" });
    expect(p2.kind).toBe("ok");
    if (p2.kind !== "ok") return;
    expect(p2.data.items[0]!.varietyName).toBe("Testbloom 21");
  });

  it("treats ?page=1 as page 1 (the 301 lives in +onBeforeRoute, before routing)", async () => {
    const { api, cache } = setup();
    const res = await resolveVarietyBrowse(api, cache, { search: "?page=1" });
    expect(res.kind).toBe("ok");
    if (res.kind !== "ok") return;
    expect(res.data.page).toBe(1);
  });

  it("404s malformed and out-of-range pages (no empty 200, no clamp)", async () => {
    const { api, cache } = setup();
    for (const search of ["?page=99", "?page=0", "?page=-1", "?page=abc", "?color_family=yellow&page=2"]) {
      expect((await resolveVarietyBrowse(api, cache, { search })).kind, search).toBe("notFound");
    }
  });

  it("resolves filtered views with their narrowed totals", async () => {
    const { api, cache } = setup();
    const yellow = await resolveVarietyBrowse(api, cache, { search: "?color_family=yellow" });
    expect(yellow.kind).toBe("ok");
    if (yellow.kind !== "ok") return;
    expect(yellow.data.total).toBe(16);
    const empty = await resolveVarietyBrowse(api, cache, { search: "?life_cycle=biennial" });
    expect(empty.kind).toBe("ok");
    if (empty.kind !== "ok") return;
    expect(empty.data.total).toBe(0);
    expect(empty.data.items).toEqual([]);
  });
});

describe("resolveSellerBrowse", () => {
  it("resolves the resting pages and the OR view", async () => {
    const { api, cache } = setup();
    const p1 = await resolveSellerBrowse(api, cache, { search: "" });
    expect(p1.kind).toBe("ok");
    if (p1.kind !== "ok") return;
    expect(p1.data.total).toBe(26);
    expect(p1.data.states.map((s) => s.code)).toEqual(["CA", "KS", "OR"]);
    const or = await resolveSellerBrowse(api, cache, { search: "?state=OR" });
    expect(or.kind).toBe("ok");
    if (or.kind !== "ok") return;
    expect(or.data.total).toBe(9);
  });

  it("forgives unknown state codes (All states) and 404s bad pages", async () => {
    const { api, cache } = setup();
    const forgiving = await resolveSellerBrowse(api, cache, { search: "?state=XX" });
    expect(forgiving.kind).toBe("ok");
    if (forgiving.kind !== "ok") return;
    expect(forgiving.data.total).toBe(26);
    for (const search of ["?page=99", "?page=abc"]) {
      expect((await resolveSellerBrowse(api, cache, { search })).kind, search).toBe("notFound");
    }
  });
});

describe("resolveSearch", () => {
  it("resolves bare /search as the empty state (no query, no results)", async () => {
    const { api, cache } = setup();
    const res = await resolveSearch(api, cache, { search: "" });
    expect(res).toMatchObject({ kind: "empty", q: "" });
  });

  it("resolves queries with grouped totals", async () => {
    const { api, cache } = setup();
    const res = await resolveSearch(api, cache, { search: "?q=testbloom" });
    expect(res.kind).toBe("ok");
    if (res.kind !== "ok") return;
    expect(res.data.total).toBe(57);
    expect(res.data.q).toBe("testbloom");
  });

  it("truncates over-long queries at 100 chars and resolves zero-results as ok", async () => {
    const { api, cache } = setup();
    const long = await resolveSearch(api, cache, { search: `?q=${"a".repeat(150)}` });
    expect(long.kind).toBe("ok");
    if (long.kind !== "ok") return;
    expect(long.data.q).toBe("a".repeat(100));
    const zero = await resolveSearch(api, cache, { search: "?q=zxqv" });
    expect(zero.kind).toBe("ok");
    if (zero.kind !== "ok") return;
    expect(zero.data.total).toBe(0);
  });
});
