/**
 * Stub search/fidelity tests: the browse stub's ranking, caps, and
 * validation mirror the live v1 service closely enough to discriminate the
 * app — exact → prefix → substring tiers with the has-listings tiebreak,
 * the autocomplete's class-then-type rank, the 50/5/5/5 group caps, and
 * the live 400s (bad sort incl. availability, bad season/method/life_cycle,
 * bad type, non-integer limit).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { browseCatalogState } from "../unit/browse-catalog";
import type { FakeCatalogState } from "../unit/fake-catalog";
import { startStubApi, type StubApi } from "./api-server";
import { stubSearch } from "./catalog-filter";

const corpusOf = (state: FakeCatalogState) => ({
  varieties: state.listItems,
  smallFarmSlugs: new Set(state.smallFarmVarieties),
  crops: state.crops,
  series: state.seriesCatalog,
  sellers: state.sellers,
});

describe("stubSearch ranking", () => {
  const state = browseCatalogState();
  const corpus = corpusOf(state);

  it("tiers testbloom matches (prefix) with has-listings first, all 50 kept", () => {
    const res = stubSearch(corpus, "testbloom", { limit: 50 });
    expect(res.varieties).toHaveLength(50);
    // Has-listings first (38 with sellers), then the 12 zero-seller, name order within.
    expect(res.varieties.slice(0, 38).every((v) => !v.subtitle.includes("no seller listing yet"))).toBe(true);
    expect(res.varieties.slice(38).every((v) => v.subtitle.includes("no seller listing yet"))).toBe(true);
    expect(res.varieties[0]!.title).toBe("Testbloom 01");
    expect(res.crops.map((r) => r.slug)).toEqual(["testbloom"]);
    expect(res.series.map((r) => r.slug)).toEqual(["testbloom-cascade"]);
    expect(res.sellers).toHaveLength(5);
  });

  it("ranks the flat autocomplete by class then type (exact crop first)", () => {
    const res = stubSearch(corpus, "testbloom", { limit: 10 });
    expect(res.results).toHaveLength(10);
    expect(res.results[0]).toMatchObject({ type: "crop", slug: "testbloom" });
    expect(res.results.slice(1).every((r) => r.type === "variety")).toBe(true);
  });

  it("matches nothing for testbloomx and zxqv (the zero-results queries)", () => {
    for (const q of ["testbloomx", "zxqv"]) {
      const res = stubSearch(corpus, q, { limit: 50 });
      expect(res.varieties, q).toHaveLength(0);
      expect(res.crops, q).toHaveLength(0);
      expect(res.series, q).toEqual([]);
      expect(res.sellers, q).toHaveLength(0);
      expect(res.results, q).toHaveLength(0);
    }
  });

  it("needs two characters (one-char queries match nothing)", () => {
    const res = stubSearch(corpus, "t", { limit: 50 });
    expect(res.varieties).toHaveLength(0);
    expect(res.results).toHaveLength(0);
  });

  it("filters server-side by season/methods/colorFamily (sellers unaffected)", () => {
    const warm = stubSearch(corpus, "testbloom", { limit: 50, season: "warm_season_tender_annual" });
    expect(warm.varieties).toHaveLength(25);
    expect(warm.crops).toHaveLength(0);
    expect(warm.sellers).toHaveLength(5);
    const yellow = stubSearch(corpus, "testbloom", { limit: 50, colorFamily: ["yellow"] });
    expect(yellow.varieties).toHaveLength(16);
    expect(yellow.crops).toHaveLength(1);
  });

  it("honors the type filter", () => {
    const res = stubSearch(corpus, "testbloom", { limit: 50, types: ["seller"] });
    expect(res.varieties).toHaveLength(0);
    expect(res.sellers).toHaveLength(5);
  });
});

describe("stub HTTP validation (live-faithful 400s)", () => {
  let stub: StubApi;

  beforeAll(async () => {
    stub = await startStubApi(browseCatalogState());
  });

  afterAll(async () => {
    await stub.close();
  });

  const status = async (path: string): Promise<number> => (await fetch(`${stub.url}${path}`)).status;

  it("400s unknown variety sorts — including availability (v1 keeps its shipped vocabulary)", async () => {
    expect(await status("/api/v1/varieties?sort=availability")).toBe(400);
    expect(await status("/api/v1/varieties?sort=price")).toBe(400);
    expect(await status("/api/v1/varieties?sort=-recently_checked&limit=1")).toBe(200);
  });

  it("400s invalid season/method/life_cycle/small_farm on /varieties", async () => {
    expect(await status("/api/v1/varieties?season=hot")).toBe(400);
    expect(await status("/api/v1/varieties?method=seed")).toBe(400);
    expect(await status("/api/v1/varieties?life_cycle=ephemeral")).toBe(400);
    expect(await status("/api/v1/varieties?small_farm=yes")).toBe(400);
    expect(await status("/api/v1/varieties?season=cool&method=trays&life_cycle=annual&small_farm=true&limit=1")).toBe(200);
  });

  it("400s invalid search params (type, limit, season)", async () => {
    expect(await status("/api/v1/search?q=test&type=nope")).toBe(400);
    expect(await status("/api/v1/search?q=test&limit=many")).toBe(400);
    expect(await status("/api/v1/search?q=test&season=hot")).toBe(400);
    expect(await status("/api/v1/search?q=testbloom&limit=50")).toBe(200);
  });

  it("serves series detail for fixtures and 404s unknown series", async () => {
    const res = await fetch(`${stub.url}/api/v1/series/testbloom-cascade`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { slug: string; varietyCount: number; crop: { slug: string } } };
    expect(body.data.slug).toBe("testbloom-cascade");
    expect(body.data.varietyCount).toBe(50);
    expect(body.data.crop.slug).toBe("testbloom");
    expect(await status("/api/v1/series/no-such-series")).toBe(404);
  });

  it("filters and sorts over HTTP exactly as the loaders read them", async () => {
    const url = (p: string) => fetch(`${stub.url}${p}`).then((r) => r.json()) as Promise<{
      data: { slug: string; varietyName?: string; name?: string }[];
      meta: { total: number };
    }>;
    const yellow = await url("/api/v1/varieties?color_family=yellow&limit=100");
    expect(yellow.meta.total).toBe(16);
    const small = await url("/api/v1/varieties?small_farm=true&limit=100");
    expect(small.meta.total).toBe(7);
    const recent = await url("/api/v1/varieties?sort=-recently_checked&limit=1");
    expect(recent.meta.total).toBe(55);
    const oregon = await url("/api/v1/sellers?region=OR&limit=100");
    expect(oregon.meta.total).toBe(9);
    const search = await fetch(`${stub.url}/api/v1/search?q=testbloom&limit=50`).then(
      (r) => r.json() as Promise<{ data: { varieties: unknown[]; crops: unknown[]; series: unknown[]; sellers: unknown[] } }>,
    );
    expect(search.data.varieties).toHaveLength(50);
    expect(search.data.crops).toHaveLength(1);
    expect(search.data.series).toHaveLength(1);
    expect(search.data.sellers).toHaveLength(5);
  });
});
