/**
 * /api/v1 contract tests: the real route handlers, the real service layer and a real local D1 +
 * R2. Only the request-context accessors are swapped for the test database.
 * Includes service↔API parity (FINAL X2): API `data` must deep-equal the in-process service output.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Services } from "@/lib/services";
import type { RuntimeEnv } from "@/lib/api/runtime-env";

const ctx = vi.hoisted(() => ({ services: null as unknown, env: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => ctx.env }));

import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import { resetTokenBuckets } from "@/lib/api/rate-limit";
import { COMPANY_NAME_EXCLUSION_PATTERN } from "@/lib/catalog/assertions";
import { DOCUMENTED_PATHS } from "@/lib/api/openapi";
import * as V from "@/lib/validators";
import * as varietiesRoute from "@/app/api/v1/varieties/route";
import * as varietyRoute from "@/app/api/v1/varieties/[slug]/route";
import * as varietyListingsRoute from "@/app/api/v1/varieties/[slug]/listings/route";
import * as sellersRoute from "@/app/api/v1/sellers/route";
import * as sellerRoute from "@/app/api/v1/sellers/[slug]/route";
import * as sellerListingsRoute from "@/app/api/v1/sellers/[slug]/listings/route";
import * as categoriesRoute from "@/app/api/v1/categories/route";
import * as categoryRoute from "@/app/api/v1/categories/[slug]/route";
import * as cropsRoute from "@/app/api/v1/crops/route";
import * as cropRoute from "@/app/api/v1/crops/[slug]/route";
import * as seriesRoute from "@/app/api/v1/series/[slug]/route";
import * as coverageRoute from "@/app/api/v1/coverage/route";
import * as recentRoute from "@/app/api/v1/recent/route";
import * as searchRoute from "@/app/api/v1/search/route";
import * as syncSnapshotRoute from "@/app/api/v1/sync/snapshot/route";
import * as syncChangesRoute from "@/app/api/v1/sync/changes/route";
import * as reportsRoute from "@/app/api/v1/reports/route";
import * as ingestRoute from "@/app/api/v1/ingest/[...path]/route";
import * as adminRoute from "@/app/api/v1/admin/[...path]/route";
import * as versionRoute from "@/app/api/v1/catalog/version/route";
import * as snapshotRoute from "@/app/api/v1/catalog/snapshot/[file]/route";
import * as openapiRoute from "@/app/api/v1/openapi.json/route";
import * as unknownRoute from "@/app/api/v1/[...rest]/route";

let t: TestD1;
let services: Services;
const BASE = "https://seeds.hues.flowers/api/v1";

beforeAll(async () => {
  t = await createTestD1();
  services = createServices(t.db, { snapshots: t.env.SNAPSHOTS });
  ctx.services = services;
  ctx.env = {
    siteUrl: "https://seeds.hues.flowers",
    corsOrigins: ["https://seeds.hues.flowers"],
    rateLimiter: null,
    limiters: { search: null, reports: null, ingest: null },
    snapshots: t.env.SNAPSHOTS,
    revalidateToken: null,
    turnstileSecret: null,
    clickSalt: "test",
  } satisfies RuntimeEnv;
  await t.env.DB.prepare(
    "INSERT INTO catalog_publish (version, batch_id, snapshot_key, published_at) VALUES (1, 1, 'snapshots/catalog-v1.sqlite', '2026-11-16T00:00:00.000Z')",
  ).run();
  await t.env.SNAPSHOTS.put("snapshots/catalog-v1.sqlite", new Uint8Array([83, 81, 76, 105, 116, 101]));
});
afterAll(async () => {
  await t?.env.SNAPSHOTS.delete("snapshots/catalog-v1.sqlite");
  await t?.dispose();
});
beforeEach(() => resetTokenBuckets());

type Handler = (req: Request, ctx: { params: Promise<Record<string, string | string[] | undefined>> }) => Promise<Response>;
function call(h: Handler, path: string, params: Record<string, string> = {}, init: RequestInit = {}) {
  return h(new Request(`${BASE}${path}`, init), { params: Promise.resolve(params) });
}
type Envelope = {
  data: unknown;
  page?: { next_cursor: string | null; has_more: boolean };
  meta: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
};
async function json(res: Response) {
  return (await res.json()) as Envelope;
}
const post = (h: Handler, path: string, body: unknown, headers: Record<string, string> = {}) =>
  call(h, path, {}, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("envelope + headers (R13)", () => {
  it("list responses use { data, page, meta, error }; meta carries catalog_seq + generated_at", async () => {
    const res = await call(varietiesRoute.GET, "/varieties?limit=5");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-API-Version")).toBe("1");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300, stale-while-revalidate=86400");
    expect(res.headers.get("ETag")).toMatch(/^"[0-9a-f]+"$/);
    const body = await json(res);
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toMatchObject({ count: 5, total: 778, catalog_seq: await services.catalog.catalogSeq() });
    expect(typeof body.meta?.generated_at).toBe("string");
    expect(body.page).toEqual({ next_cursor: body.meta?.nextCursor, has_more: true });
  });

  it("unknown slug → 404 not_found envelope (existing public reads keep their error envelope)", async () => {
    for (const [h, path] of [
      [varietyRoute.GET, "/varieties/does-not-exist"],
      [sellerRoute.GET, "/sellers/does-not-exist"],
      [cropRoute.GET, "/crops/does-not-exist"],
      [seriesRoute.GET, "/series/does-not-exist"],
      [categoryRoute.GET, "/categories/does-not-exist"],
      [varietyListingsRoute.GET, "/varieties/does-not-exist/listings"],
    ] as const) {
      const res = await call(h, path, { slug: "does-not-exist" });
      expect(res.status).toBe(404);
      expect(await json(res)).toEqual({ data: null, meta: null, error: { code: "not_found", message: expect.any(String) } });
    }
    expect((await call(unknownRoute.GET, "/plants", { rest: "plants" })).status).toBe(404); // renamed to /crops, no shim
  });

  it("non-GET methods on reads → 405 with Allow header", async () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const res = await (varietiesRoute[m] as unknown as (r: Request) => Promise<Response>)(new Request(`${BASE}/varieties`, { method: m }));
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
    }
  });

  it("malformed limit → 400; limit cap is 100; price sorts are gone", async () => {
    expect((await call(varietiesRoute.GET, "/varieties?limit=abc")).status).toBe(400);
    const capped = await json(await call(varietiesRoute.GET, "/varieties?limit=1000"));
    expect(capped.meta?.count).toBe(100);
    expect(capped.meta?.total).toBe(778);
    for (const sort of ["random", "price-asc", "price-desc"]) expect((await call(varietiesRoute.GET, `/varieties?sort=${sort}`)).status).toBe(400);
    expect((await call(varietiesRoute.GET, "/varieties?cursor=garbage")).status).toBe(400);
  });

  it("ETag → 304 on repeat (generated_at does not defeat it)", async () => {
    const first = await call(sellersRoute.GET, "/sellers");
    const etag = first.headers.get("ETag")!;
    const second = await call(sellersRoute.GET, "/sellers", {}, { headers: { "If-None-Match": etag } });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  it("CORS: allowlisted origin reflected, others not, never *", async () => {
    const ok = await call(varietiesRoute.GET, "/varieties", {}, { headers: { Origin: "https://seeds.hues.flowers" } });
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("https://seeds.hues.flowers");
    const bad = await call(varietiesRoute.GET, "/varieties", {}, { headers: { Origin: "https://random.example" } });
    expect(bad.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rate limits: public 120/min, search 60/min, reports 3/min (per IP) → 429 + Retry-After", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      let last: Response | undefined;
      for (let i = 0; i < 121; i++) last = await call(categoriesRoute.GET, "/categories", {}, { headers: { "cf-connecting-ip": "203.0.113.9" } });
      expect(last!.status).toBe(429);
      expect(last!.headers.get("Retry-After")).toBe("60");
      for (let i = 0; i < 61; i++) last = await call(searchRoute.GET, "/search?q=zinnia", {}, { headers: { "cf-connecting-ip": "203.0.113.20" } });
      expect(last!.status).toBe(429);
      const body = { type: "correct", target_type: "seller", target_ref: "floret", message: "hello there", contact: "a@b.example" };
      for (let i = 0; i < 4; i++) last = await post(reportsRoute.POST, "/reports", body, { "cf-connecting-ip": "203.0.113.30" });
      expect(last!.status).toBe(429);
      expect(last!.headers.get("Content-Type")).toBe("application/problem+json");
    } finally {
      vi.useRealTimers();
    }
    expect((await call(categoriesRoute.GET, "/categories", {}, { headers: { "cf-connecting-ip": "203.0.113.10" } })).status).toBe(200);
  });
});

describe("pagination", () => {
  it("limit=5 cursor-walks all 778 varieties exactly once via page.next_cursor", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      // 156 pages exceed the 120/min public bucket; this test is about pagination, not rate limits.
      resetTokenBuckets();
      const qs: string = cursor ? `?limit=5&cursor=${encodeURIComponent(cursor)}` : "?limit=5";
      const body = await json(await call(varietiesRoute.GET, `/varieties${qs}`));
      seen.push(...(body.data as { slug: string }[]).map((v) => v.slug));
      cursor = body.page!.next_cursor;
      expect(body.page!.has_more).toBe(cursor !== null);
      pages++;
    } while (cursor && pages < 200);
    expect(new Set(seen).size).toBe(778);
    expect(pages).toBe(156);
    const first = await services.catalog.listVarieties({ page: { offset: 0, limit: 100 } });
    const allSlugs = [...first.items];
    for (let offset = 100; offset < first.total; offset += 100) {
      allSlugs.push(...(await services.catalog.listVarieties({ page: { offset, limit: 100 } })).items);
    }
    expect(seen).toEqual(allSlugs.map((v) => v.slug));
  });

  it("cursors cannot be replayed against a different filter", async () => {
    const body = await json(await call(varietiesRoute.GET, "/varieties?limit=5"));
    expect((await call(varietiesRoute.GET, `/varieties?limit=5&crop=sweet-pea&cursor=${body.page!.next_cursor}`)).status).toBe(400);
  });

  it("canonical filters: crop, series, color_family, has_listings, in_stock, seller (comma lists)", async () => {
    const data = async (qs: string) => (await json(await call(varietiesRoute.GET, `/varieties?limit=100&${qs}`))).data as V.VarietySummary[];
    expect((await data("crop=sweet-pea")).every((v) => v.plant.slug === "sweet-pea")).toBe(true);
    expect((await data("crop=sweet-pea,zinnia")).some((v) => v.plant.slug === "zinnia")).toBe(true);
    expect((await data("series=zinnia-dearest")).every((v) => v.series?.slug === "zinnia-dearest")).toBe(true);
    expect(await data("has_listings=true")).toHaveLength(17);
    expect((await json(await call(varietiesRoute.GET, "/varieties?limit=100&has_listings=false"))).meta?.total).toBe(761);
    expect((await data("in_stock=true")).every((v) => v.inStockCount > 0)).toBe(true);
    expect(await data("seller=songbird-seed-co")).toHaveLength(9);
    expect((await call(varietiesRoute.GET, "/varieties?pollination=maybe")).status).toBe(400);
    expect((await call(varietiesRoute.GET, "/varieties?has_listings=perhaps")).status).toBe(400);
  });

  it("spec sorts: listing_count, recently_checked (± direction)", async () => {
    const data = async (sort: string) => (await json(await call(varietiesRoute.GET, `/varieties?limit=100&sort=${sort}`))).data as V.VarietySummary[];
    const desc = await data("-listing_count");
    expect(desc.slice(0, 17).every((v) => v.listingCount > 0)).toBe(true);
    const asc = await data("listing_count");
    expect(asc[0]!.listingCount).toBe(0);
    const recent = await data("-recently_checked");
    expect(recent[0]!.lastCheckedAt).not.toBeNull();
    expect((await data("-name"))[0]!.varietyName.localeCompare((await data("name"))[0]!.varietyName)).toBeGreaterThan(0);
  });
});

describe("service ↔ API parity (FINAL X2)", () => {
  it("variety detail + listings sub-resource", async () => {
    for (const slug of ["sweet-pea-kings-ransom", "stock-katz-mix", "zinnia-dawn-creek-pastels"]) {
      const api = await json(await call(varietyRoute.GET, `/varieties/${slug}`, { slug }));
      expect(api.data).toEqual(await services.catalog.getVariety(slug));
      expect(V.VarietyDetailSchema.safeParse(api.data).success).toBe(true);
      const ls = await json(await call(varietyListingsRoute.GET, `/varieties/${slug}/listings`, { slug }));
      expect(ls.data).toEqual((api.data as V.VarietyDetail).listings);
    }
    const filtered = await json(await call(varietyListingsRoute.GET, "/varieties/sweet-pea-kings-ransom/listings?availability=sold_out", { slug: "sweet-pea-kings-ransom" }));
    expect(filtered.data).toEqual([]);
  });

  it("variety objects carry rating + explicit unknowns; listings carry provenance + go_url, never prices", async () => {
    const v = (await json(await call(varietyRoute.GET, "/varieties/sweet-pea-kings-ransom", { slug: "sweet-pea-kings-ransom" }))).data as V.VarietyDetail;
    expect(v.rating).toEqual({ state: "not_yet_rated", average: null, review_count: 0 });
    expect(v.facts).toMatchObject({ color_family: "unknown", pollination: "unknown" });
    expect(v.listings[0]!.provenance.method).toBe("human");
    expect(v.listings[0]!.goUrl).toMatch(/^https:\/\/seeds\.hues\.flowers\/go\/\d+$/);
    expect(JSON.stringify(v)).not.toMatch(/"price\w*":/i);
  });

  it("sellers + seller listings", async () => {
    const list = await json(await call(sellersRoute.GET, "/sellers?limit=100"));
    expect(list.data).toEqual((await services.catalog.listSellers({ offset: 0, limit: 100 })).items);
    expect((list.data as unknown[]).length).toBe(25);
    expect(((await json(await call(sellersRoute.GET, "/sellers?region=WA"))).data as unknown[]).length).toBe(4); // + Three Brothers Blooms (Camano Island, WA) since the 2026-11-17 seller-location update
    expect(((await json(await call(sellersRoute.GET, "/sellers?q=flor"))).data as { slug: string }[]).map((s) => s.slug)).toEqual(["floret"]);
    const one = await json(await call(sellerRoute.GET, "/sellers/floret", { slug: "floret" }));
    expect(one.data).toEqual(await services.catalog.getSeller("floret"));
    expect(V.SellerDetailSchema.safeParse(one.data).success).toBe(true);
    const ls = await json(await call(sellerListingsRoute.GET, "/sellers/songbird-seed-co/listings?availability=sold_out", { slug: "songbird-seed-co" }));
    expect((ls.data as V.PublicListing[]).map((l) => l.variety.slug).sort()).toEqual(["sweet-pea-emma", "sweet-pea-wild-swan"]);
  });

  it("crops (renamed from plants), series, categories, coverage, recent", async () => {
    const crops = await json(await call(cropsRoute.GET, "/crops?limit=100"));
    expect(crops.data).toEqual((await services.catalog.listCrops({ offset: 0, limit: 100 })).items);
    expect((crops.data as unknown[]).length).toBe(100); // 124 crops; one capped page
    expect(crops.meta).toMatchObject({ count: 100, total: 124 });
    const crop = await json(await call(cropRoute.GET, "/crops/zinnia", { slug: "zinnia" }));
    expect(crop.data).toEqual((await services.catalog.getCrop("zinnia", { page: { offset: 0, limit: 24 } }))!.crop);
    expect((crop.data as V.CropDetail).series.map((s) => s.slug)).toEqual(["zinnia-dearest"]);
    expect((crop.data as V.CropDetail).grower_guide?.seed_saving?.difficulty).toBe("easy");
    expect((crop.data as V.CropDetail).life_cycle).toBe("Annual");
    const series = await json(await call(seriesRoute.GET, "/series/zinnia-dearest", { slug: "zinnia-dearest" }));
    expect(series.data).toEqual(await services.catalog.getSeries("zinnia-dearest"));
    const cats = await json(await call(categoriesRoute.GET, "/categories"));
    expect(cats.data).toEqual(await services.catalog.listCategories());
    const cov = await json(await call(coverageRoute.GET, "/coverage"));
    expect(cov.data).toEqual(await services.catalog.coverage());
    expect((cov.data as V.CoverageItem[]).reduce((n, c) => n + c.varieties_with_sellers, 0)).toBe(17);
    const recent = await json(await call(recentRoute.GET, "/recent?crop=sweet-pea"));
    expect((recent.data as V.RecentItem[]).every((r) => r.listing.variety.plant.slug === "sweet-pea" && r.event === "first_seen")).toBe(true);
    expect((await call(recentRoute.GET, "/recent?since=yesterday")).status).toBe(400);
  });

  it("search: mixed results, type + limit params, logged to search_events", async () => {
    const before = (await t.env.DB.prepare("SELECT count(*) n FROM search_events").first<{ n: number }>())!.n;
    const api = await json(await call(searchRoute.GET, "/search?q=zinnia&limit=10", {}, { headers: { "X-Client": "ios/1.2.0" } }));
    const r = api.data as V.SearchResponse;
    expect(r.crops.map((c) => c.href)).toEqual(["/crop/zinnia"]);
    expect(r.varieties.length).toBeGreaterThan(0);
    expect(r.varieties.every((v) => v.href.startsWith("/variety/"))).toBe(true);
    const typed = (await json(await call(searchRoute.GET, "/search?q=zinnia&type=series"))).data as V.SearchResponse;
    expect(typed.varieties).toHaveLength(0);
    expect((await call(searchRoute.GET, "/search?q=")).status).toBe(400);
    expect((await call(searchRoute.GET, "/search?q=x&type=plant")).status).toBe(400);
    // "ka" is a prefix-tier query: hits rank by variety name (no ka-variety has a listing), so the
    // default 10 are the Flowering Kale "Crane …" varieties and the other names sorting before "Katz".
    const short = (await json(await call(searchRoute.GET, "/search?q=ka"))).data as V.SearchResponse;
    expect(short.varieties.map((v) => v.slug)).toEqual([
      "flowering-kale-crane-early-red", "flowering-kale-crane-early-white", "flowering-kale-crane-pink", "flowering-kale-crane-red",
      "flowering-kale-crane-rose", "flowering-kale-crane-white", "zinnia-dearest-kaleidoscope", "sweet-pea-frances-kate",
      "sweet-pea-karen-louise", "zinnia-karens-fave-color-mix",
    ]);
    const wider = (await json(await call(searchRoute.GET, "/search?q=ka&limit=50"))).data as V.SearchResponse;
    expect(wider.varieties.map((v) => v.slug)).toContain("stock-katz-mix");
    const zero = (await json(await call(searchRoute.GET, "/search?q=qqqzzz"))).data as V.SearchResponse;
    expect(zero.results).toEqual([]);
    const row = await t.env.DB.prepare("SELECT client FROM search_events ORDER BY id LIMIT 1 OFFSET ?").bind(before).first<{ client: string }>();
    expect(row!.client).toBe("ios/1.2.0");
    expect((await t.env.DB.prepare("SELECT count(*) n FROM search_events").first<{ n: number }>())!.n).toBeGreaterThanOrEqual(before + 4);
  });
});

describe("season filter (seeds-v2-season)", () => {
  it("GET /crops?season=cool|warm filters; bogus → 400; parity with the service", async () => {
    const cool = await json(await call(cropsRoute.GET, "/crops?season=cool&limit=100"));
    expect(cool.meta).toMatchObject({ total: 52, count: 52 });
    expect(cool.data).toEqual((await services.catalog.listCrops({ offset: 0, limit: 100 }, { season: "cool_season_hardy_annual" })).items);
    expect((cool.data as V.CropListItem[]).every((c) => c.season_class === "cool_season_hardy_annual")).toBe(true);
    const warm = await json(await call(cropsRoute.GET, "/crops?season=warm&limit=100"));
    expect(warm.meta).toMatchObject({ total: 36 });
    const bad = await call(cropsRoute.GET, "/crops?season=bogus");
    expect(bad.status).toBe(400);
    expect((await json(bad)).error).toMatchObject({ code: "validation_error" });
    expect((await call(cropsRoute.GET, "/crops?season=cool_season_hardy_annual")).status).toBe(400);
  });

  it("GET /varieties?season=warm filters, cursors stay bound to the filter; /search takes season", async () => {
    const warm = await json(await call(varietiesRoute.GET, "/varieties?season=warm&limit=5"));
    expect(warm.meta).toMatchObject({ total: 286, count: 5 });
    expect((warm.data as V.VarietySummary[]).every((v) => v.plant.season_class === "warm_season_tender_annual")).toBe(true);
    const cursor = warm.page!.next_cursor!;
    expect((await call(varietiesRoute.GET, `/varieties?season=cool&limit=5&cursor=${cursor}`)).status).toBe(400);
    expect((await call(varietiesRoute.GET, "/varieties?season=summer")).status).toBe(400);
    const s = (await json(await call(searchRoute.GET, "/search?q=zinnia&season=cool"))).data as V.SearchResponse;
    expect([s.crops, s.series, s.varieties]).toEqual([[], [], []]);
    expect((await call(searchRoute.GET, "/search?q=zinnia&season=x")).status).toBe(400);
  });

  it("OpenAPI documents season on listCrops, listVarieties and search", async () => {
    const doc = (await (await call(openapiRoute.GET, "/openapi.json")).json()) as {
      paths: Record<string, { get: { parameters: { name: string; schema?: { enum?: string[] } }[] } }>;
    };
    for (const path of ["/crops", "/varieties", "/search"]) {
      const season = doc.paths[path]!.get.parameters.find((p) => p.name === "season");
      expect(season?.schema?.enum).toEqual(["cool", "warm"]);
    }
  });
});

describe("sowing-method + hue filters (seeds-v2 brief #2)", () => {
  it("GET /crops?method=trays|direct filters (repeatable / comma list = ANY); bogus → 400; parity", async () => {
    const trays = await json(await call(cropsRoute.GET, "/crops?method=trays&limit=100"));
    expect(trays.meta).toMatchObject({ total: 114, count: 100 }); // 114 crops; one capped page
    expect(trays.data).toEqual((await services.catalog.listCrops({ offset: 0, limit: 100 }, { methods: ["transplant"] })).items);
    expect((trays.data as V.CropListItem[]).every((c) => c.sowing_methods.includes("transplant"))).toBe(true);
    expect((await json(await call(cropsRoute.GET, "/crops?method=direct&limit=100"))).meta).toMatchObject({ total: 50 });
    expect((await json(await call(cropsRoute.GET, "/crops?method=direct,trays"))).meta).toMatchObject({ total: 120 });
    expect((await json(await call(cropsRoute.GET, "/crops?method=direct&method=trays"))).meta).toMatchObject({ total: 120 });
    expect((await json(await call(cropsRoute.GET, "/crops?method=direct&season=cool"))).meta).toMatchObject({ total: 21 });
    const bad = await call(cropsRoute.GET, "/crops?method=bogus");
    expect(bad.status).toBe(400);
    expect((await json(bad)).error).toMatchObject({ code: "validation_error" });
    expect((await call(cropsRoute.GET, "/crops?method=direct_sow")).status).toBe(400);
    expect((await call(cropsRoute.GET, "/crops?method=direct,bogus")).status).toBe(400);
  });

  it("GET /varieties takes method + color_family; /search takes both; bogus method → 400", async () => {
    const direct = await json(await call(varietiesRoute.GET, "/varieties?method=direct&limit=5"));
    expect(direct.meta).toMatchObject({ total: 347, count: 5 });
    expect((direct.data as V.VarietySummary[]).every((v) => v.plant.sowing_methods.includes("direct_sow"))).toBe(true);
    const cursor = direct.page!.next_cursor!;
    expect((await call(varietiesRoute.GET, `/varieties?method=trays&limit=5&cursor=${cursor}`)).status).toBe(400);
    expect((await call(varietiesRoute.GET, "/varieties?method=bogus")).status).toBe(400);
    const blush = await json(await call(varietiesRoute.GET, "/varieties?color_family=blush&limit=100"));
    expect(blush.meta).toMatchObject({ total: 19 });
    expect((blush.data as V.VarietySummary[]).every((v) => v.colorFamily === "blush")).toBe(true);
    expect((await json(await call(varietiesRoute.GET, "/varieties?season=cool&method=direct"))).meta).toMatchObject({ total: 75 });

    const s = (await json(await call(searchRoute.GET, "/search?q=dahlia&method=direct"))).data as V.SearchResponse;
    expect([s.crops, s.series, s.varieties]).toEqual([[], [], []]);
    const c = (await json(await call(searchRoute.GET, "/search?q=cosmos&color_family=blush&limit=50"))).data as V.SearchResponse;
    expect(c.varieties.map((v) => v.slug)).toContain("cosmos-cupcakes-blush");
    expect(c.varieties.length).toBeLessThan(((await json(await call(searchRoute.GET, "/search?q=cosmos&limit=50"))).data as V.SearchResponse).varieties.length);
    expect((await call(searchRoute.GET, "/search?q=zinnia&method=x")).status).toBe(400);
  });

  it("OpenAPI documents method on listCrops, listVarieties and search, color_family on search", async () => {
    const doc = (await (await call(openapiRoute.GET, "/openapi.json")).json()) as {
      paths: Record<string, { get: { parameters: { name: string; schema?: { items?: { enum?: string[] } } }[] } }>;
    };
    for (const path of ["/crops", "/varieties", "/search"]) {
      const method = doc.paths[path]!.get.parameters.find((p) => p.name === "method");
      expect(method?.schema?.items?.enum).toEqual(["direct", "trays"]);
    }
    expect(doc.paths["/search"]!.get.parameters.map((p) => p.name)).toContain("color_family");
  });
});

describe("life-cycle filter (life-cycle filter task)", () => {
  const slugsOf = (e: Envelope) => (e.data as V.CropListItem[]).map((c) => c.slug);

  it("GET /crops?life_cycle=perennial|annual filters by bucket (repeatable / comma = ANY); parity with the service", async () => {
    const perennial = await json(await call(cropsRoute.GET, "/crops?life_cycle=perennial&limit=100"));
    expect(perennial.meta).toMatchObject({ total: 27, count: 27 });
    expect(slugsOf(perennial)).toContain("yarrow");
    expect(slugsOf(perennial)).not.toContain("cosmos");
    expect(perennial.data).toEqual((await services.catalog.listCrops({ offset: 0, limit: 100 }, { lifeCycle: ["perennial"] })).items);
    const annual = await json(await call(cropsRoute.GET, "/crops?life_cycle=annual&limit=100"));
    expect(annual.meta).toMatchObject({ total: 90 });
    expect(slugsOf(annual)).toContain("cosmos");
    expect(slugsOf(annual)).not.toContain("yarrow");
    expect((await json(await call(cropsRoute.GET, "/crops?life_cycle=biennial"))).meta).toMatchObject({ total: 8 });
    expect((await json(await call(cropsRoute.GET, "/crops?life_cycle=biennial,perennial"))).meta).toMatchObject({ total: 34 });
    expect((await json(await call(cropsRoute.GET, "/crops?life_cycle=biennial&life_cycle=perennial"))).meta).toMatchObject({ total: 34 });
  });

  it("invalid life_cycle values → 400 validation_error", async () => {
    for (const q of ["life_cycle=bogus", "life_cycle=Perennial", "life_cycle=annual,bogus", "life_cycle=tender_perennial"]) {
      const crops = await call(cropsRoute.GET, `/crops?${q}`);
      expect(crops.status, q).toBe(400);
      expect((await json(crops)).error).toMatchObject({ code: "validation_error" });
      expect((await call(varietiesRoute.GET, `/varieties?${q}`)).status, q).toBe(400);
    }
  });

  it("combines with season and method (AND across groups) on /crops and /varieties", async () => {
    const coolPerennial = await json(await call(cropsRoute.GET, "/crops?life_cycle=perennial&season=cool&limit=100"));
    expect(coolPerennial.meta).toMatchObject({ total: 5 });
    expect((coolPerennial.data as V.CropListItem[]).every((c) => c.season_class === "cool_season_hardy_annual")).toBe(true);
    expect((await json(await call(cropsRoute.GET, "/crops?life_cycle=annual&method=direct"))).meta).toMatchObject({ total: 34 });
    const v = await json(await call(varietiesRoute.GET, "/varieties?life_cycle=perennial&limit=100"));
    expect(v.meta).toMatchObject({ total: 91 });
    expect((v.data as V.VarietySummary[]).some((x) => x.plant.slug === "yarrow")).toBe(true);
    expect((v.data as V.VarietySummary[]).some((x) => x.plant.slug === "cosmos")).toBe(false);
    const vc = await call(varietiesRoute.GET, "/varieties?life_cycle=perennial&season=cool");
    expect(vc.status).toBe(200);
    expect((await json(vc)).meta).toMatchObject({ total: 10 });
    // 14 of the 2026-11-18 new perennial crops are direct-sown (before them, no perennial was).
    expect((await json(await call(varietiesRoute.GET, "/varieties?life_cycle=perennial&method=direct"))).meta).toMatchObject({ total: 54 });
    const page1 = await json(await call(varietiesRoute.GET, "/varieties?life_cycle=annual&limit=5"));
    expect((await call(varietiesRoute.GET, `/varieties?life_cycle=perennial&limit=5&cursor=${page1.page!.next_cursor!}`)).status).toBe(400);
  });

  it("OpenAPI documents life_cycle on listCrops and listVarieties", async () => {
    const doc = (await (await call(openapiRoute.GET, "/openapi.json")).json()) as {
      paths: Record<string, { get: { parameters: { name: string; description?: string; schema?: { items?: { enum?: string[] } } }[] } }>;
    };
    for (const path of ["/crops", "/varieties"]) {
      const lc = doc.paths[path]!.get.parameters.find((p) => p.name === "life_cycle");
      expect(lc?.schema?.items?.enum, path).toEqual(["annual", "biennial", "perennial"]);
      expect(lc?.description, path).toMatch(/returns 400/);
    }
  });
});

describe("seller states + imported ratings (brief #4)", () => {
  it("GET /sellers?region=VT returns only Vermont sellers; region is case-insensitive; parity with the service", async () => {
    const vt = await json(await call(sellersRoute.GET, "/sellers?region=VT&limit=100"));
    const slugs = (vt.data as V.SellerListItem[]).map((s) => s.slug).sort();
    expect(slugs).toEqual(["american-meadows", "high-mowing-organic-seeds", "jig-bee-flower-farm"]);
    expect((vt.data as V.SellerListItem[]).every((s) => s.region === "VT")).toBe(true);
    expect(vt.data).toEqual((await services.catalog.listSellers({ offset: 0, limit: 100 }, { region: ["VT"] })).items);
    expect((await json(await call(sellersRoute.GET, "/sellers?region=vt&limit=100"))).data).toEqual(vt.data);
    expect(((await json(await call(sellersRoute.GET, "/sellers?region=TX"))).data as unknown[]).length).toBe(0);
  });

  it("seller payloads include importedRating: an object for the 7 imported, null otherwise; our rating stays not_yet_rated", async () => {
    const list = (await json(await call(sellersRoute.GET, "/sellers?limit=100"))).data as V.SellerListItem[];
    expect(list.every((s) => "importedRating" in s)).toBe(true);
    expect(list.filter((s) => s.importedRating !== null)).toHaveLength(7);
    const one = (await json(await call(sellerRoute.GET, "/sellers/seed-savers-exchange", { slug: "seed-savers-exchange" }))).data as V.SellerDetail;
    expect(one.importedRating).toMatchObject({ source: "Google", rating: 4.8, reviewCount: 1035, fetchedDate: "2026-11-16" });
    expect(one.rating).toEqual({ state: "not_yet_rated", average: null, review_count: 0 });
    expect(one.ratingAverage).toBeNull();
    const floret = (await json(await call(sellerRoute.GET, "/sellers/floret", { slug: "floret" }))).data as V.SellerDetail;
    expect(floret.importedRating).toBeNull();
  });

  it("sync snapshot sellers carry imported_rating; OpenAPI documents ImportedRating on SellerSummary", async () => {
    const snap = (await (await call(syncSnapshotRoute.GET, "/sync/snapshot")).json()) as V.SyncSnapshot;
    expect(snap.sellers.filter((s) => s.imported_rating !== null)).toHaveLength(7);
    expect(snap.sellers.find((s) => s.slug === "floret")!.imported_rating).toBeNull();
    const doc = (await (await call(openapiRoute.GET, "/openapi.json")).json()) as {
      components: { schemas: Record<string, { properties?: Record<string, unknown>; required?: string[] }> };
    };
    expect(doc.components.schemas).toHaveProperty("ImportedRating");
    expect(doc.components.schemas.SellerSummary!.properties).toHaveProperty("importedRating");
    expect(doc.components.schemas.SellerSummary!.required).toContain("importedRating");
  });
});

describe("sync (R9)", () => {
  it("snapshot: spec shape; ETag derives from catalog_seq; 304 on match", async () => {
    const res = await call(syncSnapshotRoute.GET, "/sync/snapshot");
    const seq = await services.catalog.catalogSeq();
    expect(res.headers.get("ETag")).toBe(`"seq-${seq}"`);
    const body = (await res.json()) as V.SyncSnapshot;
    expect(V.SyncSnapshotSchema.safeParse(body).success).toBe(true);
    expect(Object.keys(body)).toEqual(["catalog_seq", "schema_version", "generated_at", "crops", "series", "varieties", "names", "sellers", "listings"]);
    expect(JSON.stringify(body)).not.toMatch(/"price\w*":/i);
    expect((await call(syncSnapshotRoute.GET, "/sync/snapshot", {}, { headers: { "If-None-Match": `"seq-${seq}"` } })).status).toBe(304);
  });

  it("changes: shape; future since → 400; negative → 410 resync_required (problem+json)", async () => {
    const ok = await json(await call(syncChangesRoute.GET, "/sync/changes?since=0&limit=50"));
    const c = ok.data as V.SyncChanges;
    expect(V.SyncChangesSchema.safeParse(c).success).toBe(true);
    expect(c.has_more).toBe(true);
    const future = await call(syncChangesRoute.GET, "/sync/changes?since=999999");
    expect(future.status).toBe(400);
    expect(future.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await future.json()).toMatchObject({ status: 400, code: "invalid_since", title: "Bad Request" });
    const gone = await call(syncChangesRoute.GET, "/sync/changes?since=-1");
    expect(gone.status).toBe(410);
    expect(await gone.json()).toMatchObject({ status: 410, code: "resync_required" });
    expect((await call(syncChangesRoute.GET, "/sync/changes")).status).toBe(400);
  });
});

describe("reports + key-gated trees (problem+json)", () => {
  it("POST /reports creates a report and a review queue item", async () => {
    const res = await post(reportsRoute.POST, "/reports", {
      type: "claim",
      target_type: "seller",
      target_ref: "floret",
      message: "We run Floret and want to manage this page.",
      contact: "owner@floret.example",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { review_item_id: number; turnstile: string } };
    expect(body.data.turnstile).toBe("not_configured");
    const item = await t.env.DB.prepare("SELECT type FROM review_items WHERE id = ?").bind(body.data.review_item_id).first<{ type: string }>();
    expect(item!.type).toBe("seller_correction");
    const bad = await post(reportsRoute.POST, "/reports", { type: "nope" });
    expect(bad.status).toBe(400);
    expect(bad.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await bad.json()).toMatchObject({ code: "validation_error" });
  });

  it("ingest/admin: 401 without a key, 403 with the wrong scope, 200 with the right one", async () => {
    const ingest = await services.auth.mint("contract-ingest", ["ingest"]);
    const admin = await services.auth.mint("contract-admin", ["admin"]);
    const health = (token?: string) =>
      call(adminRoute.GET as Handler, "/admin/health", {}, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
    const none = await health();
    expect(none.status).toBe(401);
    expect(none.headers.get("Content-Type")).toBe("application/problem+json");
    expect(none.headers.get("Cache-Control")).toBe("no-store");
    expect((await health(ingest.token)).status).toBe(403);
    const ok = await health(admin.token);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { ok: boolean } }).data.ok).toBe(true);
    const ctxRes = await call(ingestRoute.GET as Handler, "/ingest/match-context?crop=zinnia", {}, { headers: { Authorization: `Bearer ${ingest.token}` } });
    expect(ctxRes.status).toBe(200);
    expect((await call(ingestRoute.GET as Handler, "/ingest/nope", {}, { headers: { Authorization: `Bearer ${ingest.token}` } })).status).toBe(404);
    const wrongMethod = await call(ingestRoute.GET as Handler, "/ingest/observations", {}, { headers: { Authorization: `Bearer ${ingest.token}` } });
    expect(wrongMethod.status).toBe(405);
  });

  it("Idempotency-Key replays the stored response", async () => {
    const admin = await services.auth.mint("idem-admin", ["admin"]);
    const headers = { Authorization: `Bearer ${admin.token}`, "Idempotency-Key": "job-1" };
    const a = await post(adminRoute.POST as Handler, "/admin/jobs", { type: "seller_shop", target: "floret" }, headers);
    const b = await post(adminRoute.POST as Handler, "/admin/jobs", { type: "seller_shop", target: "floret" }, headers);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.headers.get("Idempotency-Replayed")).toBe("true");
    expect(((await b.json()) as { data: { id: number } }).data.id).toBe(((await a.json()) as { data: { id: number } }).data.id);
    expect((await t.env.DB.prepare("SELECT count(*) n FROM crawl_jobs").first<{ n: number }>())!.n).toBe(1);
  });

  it("removed seller: the API answers a true 410", async () => {
    const admin = await services.auth.mint("removal-admin", ["admin"]);
    const r = await post(adminRoute.POST as Handler, "/admin/sellers/wild-west-seed/remove", { reason: "contract test" }, { Authorization: `Bearer ${admin.token}` });
    expect(r.status).toBe(200);
    const gone = await call(sellerRoute.GET, "/sellers/wild-west-seed", { slug: "wild-west-seed" });
    expect(gone.status).toBe(410);
    expect((await json(gone)).error?.code).toBe("gone");
    expect((await call(sellerListingsRoute.GET, "/sellers/wild-west-seed/listings", { slug: "wild-west-seed" })).status).toBe(410);
  });
});

describe("catalog endpoints (kept untouched)", () => {
  it("version → ≥ 1, Cache-Control no-store", async () => {
    const res = await call(versionRoute.GET, "/catalog/version");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await json(res)).data).toEqual({
      version: 1,
      publishedAt: "2026-11-16T00:00:00.000Z",
      snapshotUrl: "https://seeds.hues.flowers/api/v1/catalog/snapshot/1.sqlite",
    });
  });
  it("snapshot streams from R2; unknown version → 404 envelope", async () => {
    const ok = await call(snapshotRoute.GET, "/catalog/snapshot/1.sqlite", { file: "1.sqlite" });
    expect(ok.status).toBe(200);
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(new Uint8Array([83, 81, 76, 105, 116, 101]));
    const missing = await call(snapshotRoute.GET, "/catalog/snapshot/7.sqlite", { file: "7.sqlite" });
    expect(missing.status).toBe(404);
  });
});

describe("crop media in the API (plant-media delta R5)", () => {
  it("GET /crops and /crops/{slug} carry media: rows when present (with thumbUrl), [] when absent", async () => {
    const getOne = async (s: string) => (await json(await call(cropRoute.GET, `/crops/${s}`, { slug: s }))).data as V.CropDetail;
    // Every crop: 124 is more than one 100-row page, so walk the cursor (zinnia + yarrow sort last).
    const getAll = async () => {
      const out: V.CropListItem[] = [];
      let cursor: string | null = null;
      do {
        const body = await json(await call(cropsRoute.GET, `/crops?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`));
        out.push(...(body.data as V.CropListItem[]));
        cursor = body.page!.next_cursor;
      } while (cursor);
      expect(out).toHaveLength(124);
      return out;
    };
    expect((await getOne("zinnia")).media).toEqual([]);
    expect((await getAll()).every((c) => Array.isArray(c.media) && c.media.length === 0)).toBe(true);
    await t.env.DB.prepare(
      "INSERT INTO media (plant_id, r2_key, licence, credit, created_at) SELECT id, '/artwork/crops/zinnia.webp', 'Own work', 'Illustration by Hues Floral Park', '2026-11-16T00:00:00.000Z' FROM plants WHERE slug = 'zinnia'",
    ).run();
    try {
      const row = { url: "/artwork/crops/zinnia.webp", thumbUrl: "/artwork/crops/thumbs/zinnia.webp", licence: "Own work", credit: "Illustration by Hues Floral Park" };
      const one = await getOne("zinnia");
      expect(one.media).toEqual([row]);
      expect(V.CropDetailSchema.safeParse(one).success).toBe(true);
      expect(one).toEqual((await services.catalog.getCrop("zinnia", { page: { offset: 0, limit: 24 } }))!.crop); // service ↔ API parity
      const all = await getAll();
      expect(all.find((c) => c.slug === "zinnia")!.media).toEqual([row]);
      expect(all.find((c) => c.slug === "yarrow")!.media).toEqual([]);
      expect(all.every((c) => V.CropListItemSchema.safeParse(c).success)).toBe(true);
      expect((await getOne("yarrow")).media).toEqual([]);
    } finally {
      await t.env.DB.prepare("DELETE FROM media WHERE plant_id = (SELECT id FROM plants WHERE slug = 'zinnia')").run();
    }
    expect((await getOne("zinnia")).media).toEqual([]);
  });

  it("the OpenAPI contract documents media (with optional thumbUrl) on CropListItem and CropDetail", async () => {
    const doc = (await (await call(openapiRoute.GET, "/openapi.json")).json()) as { components: { schemas: Record<string, { properties?: Record<string, unknown>; required?: string[] }> } };
    for (const name of ["CropListItem", "CropDetail", "VarietyDetail"]) {
      const s = doc.components.schemas[name]!;
      expect(s.properties, name).toHaveProperty("media");
      expect(s.required, name).toContain("media");
      expect(s.properties!.media, name).toEqual({ type: "array", items: { $ref: "#/components/schemas/Media" } });
    }
    const detail = doc.components.schemas.CropDetail!;
    for (const k of ["life_cycle", "hardiness", "grower_guide"]) expect(detail.required, k).toContain(k);
    expect(Object.keys(doc.components.schemas.GrowerGuide!.properties!).sort()).toEqual(["growing", "seed_saving"]);
    const media = doc.components.schemas.Media!;
    expect(Object.keys(media.properties!).sort()).toEqual(["credit", "licence", "thumbUrl", "url"]);
    expect([...media.required!].sort()).toEqual(["credit", "licence", "url"]); // thumbUrl optional
  });
});

describe("variety media in the API (media delta R7)", () => {
  it("GET /varieties/{slug} carries media: rows when present, [] when absent", async () => {
    const slug = "zinnia-queen-lime-blush";
    const get = async (s: string) => (await json(await call(varietyRoute.GET, `/varieties/${s}`, { slug: s }))).data as V.VarietyDetail;
    expect((await get(slug)).media).toEqual([]);
    await t.env.DB.prepare(
      "INSERT INTO media (variety_id, r2_key, licence, credit, created_at) SELECT id, '/artwork/zinnia-queen-lime-blush.webp', 'Own work', 'Illustration by Hues Floral Park', '2026-11-16T00:00:00.000Z' FROM varieties WHERE slug = ?",
    )
      .bind(slug)
      .run();
    try {
      const v = await get(slug);
      expect(v.media).toEqual([{ url: "/artwork/zinnia-queen-lime-blush.webp", licence: "Own work", credit: "Illustration by Hues Floral Park" }]);
      expect(V.VarietyDetailSchema.safeParse(v).success).toBe(true);
      expect(v).toEqual(await services.catalog.getVariety(slug)); // service ↔ API parity
      const none = await get("sweet-pea-albutt-blue");
      expect(none.media).toEqual([]);
    } finally {
      await t.env.DB.prepare("DELETE FROM media WHERE variety_id = (SELECT id FROM varieties WHERE slug = ?)").bind(slug).run();
    }
  });

  it("the OpenAPI contract documents media on VarietyDetail (generated from Zod)", async () => {
    const doc = (await (await call(openapiRoute.GET, "/openapi.json")).json()) as { components: { schemas: Record<string, { properties?: Record<string, unknown>; required?: string[] }> } };
    const detail = doc.components.schemas.VarietyDetail!;
    expect(detail.properties).toHaveProperty("media");
    expect(detail.required).toContain("media");
    // Shared with crops since the plant-media delta: a $ref to the Media component.
    expect(JSON.stringify(detail.properties!.media)).toMatch(/\/Media"|VarietyMedia|"url"/);
  });
});

describe("OpenAPI 3.1", () => {
  it("documents exactly the public endpoints and every $ref resolves", async () => {
    const res = await call(openapiRoute.GET, "/openapi.json");
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown>; components: { schemas: Record<string, unknown> } };
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths).sort()).toEqual([...DOCUMENTED_PATHS].sort());
    const text = JSON.stringify(doc);
    expect(text).not.toMatch(/\/api\/(track|revalidate|internal)|\/ingest\/|\/admin\//);
    expect(text).not.toMatch(/priceCents|price-asc/);
    for (const ref of text.match(/#\/components\/schemas\/[A-Za-z]+/g) ?? []) {
      expect(doc.components.schemas).toHaveProperty(ref.split("/").pop()!);
    }
  });
});

describe("data policy in API payloads", () => {
  it("no excluded company names, no prices and no AggregateRating anywhere in payloads", async () => {
    const bodies: string[] = [];
    bodies.push(await (await call(varietiesRoute.GET, "/varieties?limit=100")).text());
    bodies.push(await (await call(sellersRoute.GET, "/sellers?limit=100")).text());
    bodies.push(await (await call(syncSnapshotRoute.GET, "/sync/snapshot")).text());
    for (const s of (await services.catalog.listSellers({ offset: 0, limit: 100 })).items) {
      bodies.push(await (await call(sellerRoute.GET, `/sellers/${s.slug}`, { slug: s.slug })).text());
    }
    for (const b of bodies) {
      expect(COMPANY_NAME_EXCLUSION_PATTERN.test(b)).toBe(false);
      expect(b).not.toMatch(/AggregateRating|priceCents|"price/);
    }
  });
});
