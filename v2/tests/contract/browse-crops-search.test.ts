/**
 * Tranche 3.1b — GET /api/browse/crops and GET /api/browse/search: the home + /crop and
 * /search in-place payload endpoints. Same query vocabulary as their pages, same service
 * calls those pages render with; totals match the service for the same filters, garbage
 * and past-end pages are JSON 404s on the paged endpoint (the page's own guard rule),
 * other methods are 405s, and the responses are internal (noindex, no-store).
 *
 * Non-vacuity: fails on pre-build code — neither route exists there.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ services: null as unknown, env: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => ctx.env }));

import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import * as cropsRoute from "@/app/api/browse/crops/route";
import * as searchRoute from "@/app/api/browse/search/route";
import { parseSearchQueryParam, readBrowseFiltersForGroups } from "@/lib/browse";
import { CROP_BROWSE_LIMIT } from "@/lib/config";
import { pageWindow } from "@/lib/paging";
import {
  BrowseCropsPayloadSchema,
  BrowseSearchPayloadSchema,
  type BrowseCropsPayload,
  type BrowseSearchPayload,
} from "@/lib/validators";

let t: TestD1;
beforeAll(async () => {
  t = await createTestD1();
  ctx.services = createServices(t.db);
  ctx.env = { siteUrl: "https://seeds.hues.flowers", corsOrigins: [], rateLimiter: null, snapshots: null, revalidateToken: "x", clickSalt: "x" };
});
afterAll(async () => {
  await t?.dispose();
});

/** A request query string as a Next-searchParams-shaped record over the harvested keys. */
function spRecord(qs: string, keys: string[]): Record<string, string | string[] | undefined> {
  const url = new URL(`https://seeds.hues.flowers/${qs}`);
  const sp: Record<string, string | string[] | undefined> = {};
  for (const k of keys) {
    const all = url.searchParams.getAll(k);
    if (all.length === 1) sp[k] = all[0];
    else if (all.length > 1) sp[k] = all;
  }
  return sp;
}

const getCrops = (qs: string) => cropsRoute.GET(new Request(`https://seeds.hues.flowers/api/browse/crops${qs}`));
const getSearch = (qs: string) => searchRoute.GET(new Request(`https://seeds.hues.flowers/api/browse/search${qs}`));

async function cropsPayloadOf(res: Response): Promise<BrowseCropsPayload> {
  expect(res.status).toBe(200);
  const json: unknown = await res.json();
  const parsed = BrowseCropsPayloadSchema.safeParse(json);
  expect(parsed.success, "the endpoint serves the payload contract").toBe(true);
  if (!parsed.success) throw new Error("unreachable");
  return parsed.data;
}

async function searchPayloadOf(res: Response): Promise<BrowseSearchPayload> {
  expect(res.status).toBe(200);
  const json: unknown = await res.json();
  const parsed = BrowseSearchPayloadSchema.safeParse(json);
  expect(parsed.success, "the endpoint serves the payload contract").toBe(true);
  if (!parsed.success) throw new Error("unreachable");
  return parsed.data;
}

const CROP_KEYS = ["season", "method"];
const SEARCH_KEYS = ["season", "method", "life_cycle", "color_family"];

describe("GET /api/browse/crops", () => {
  it("serves the identical contract the pages render with (same service, same filters)", async () => {
    const qs = "?season=cool&method=direct";
    const viaRoute = await cropsPayloadOf(await getCrops(qs));
    const viaService = await createServices(t.db).catalog.browseCrops({
      filters: readBrowseFiltersForGroups(spRecord(qs, CROP_KEYS), ["season", "method"], "single"),
      page: pageWindow(1, CROP_BROWSE_LIMIT),
    });
    expect(viaRoute).toEqual(viaService);
  });

  it("honors every filter group (totals narrow with each added group)", async () => {
    const total = async (qs: string) => (await cropsPayloadOf(await getCrops(qs))).total;
    const all = await total("");
    expect(all).toBeGreaterThan(0);
    const cool = await total("?season=cool");
    const coolDirect = await total("?season=cool&method=direct");
    expect(cool).toBeLessThanOrEqual(all);
    expect(coolDirect).toBeLessThanOrEqual(cool);
  });

  it("?page= past the end and garbage ?page= are JSON 404s (the page's guard rule)", async () => {
    const total = (await cropsPayloadOf(await getCrops(""))).total;
    const lastPage = Math.max(1, Math.ceil(total / CROP_BROWSE_LIMIT));
    expect((await getCrops(`?page=${lastPage + 1}`)).status).toBe(404);
    expect((await getCrops("?page=bogus")).status).toBe(404);
    expect((await getCrops("?page=0")).status).toBe(404);
    const body = (await (await getCrops("?page=bogus")).json()) as { error?: { code?: unknown } };
    expect(body.error?.code).toBe("not_found");
  });

  it("answers internal headers (noindex, no-store — never cached, never indexed)", async () => {
    const res = await getCrops("?season=warm");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("is GET-only (POST/PUT/PATCH/DELETE/OPTIONS/HEAD answer 405)", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const) {
      const res = await cropsRoute[method](new Request("https://seeds.hues.flowers/api/browse/crops"));
      expect(res.status, method).toBe(405);
    }
  });

  it("carries no price key anywhere in the served bytes", async () => {
    const text = await (await getCrops("?season=cool")).text();
    expect(text).not.toMatch(/"[^"]*price[^"]*"\s*:/i);
  });
});

describe("GET /api/browse/search", () => {
  it("serves the identical contract the page renders with (same service, same filters)", async () => {
    const qs = "?q=zinnia&season=cool&color_family=pink";
    const viaRoute = await searchPayloadOf(await getSearch(qs));
    const url = new URL(`https://seeds.hues.flowers/${qs}`);
    const viaService = await createServices(t.db).catalog.browseSearch(parseSearchQueryParam(url.searchParams.get("q") ?? undefined), {
      filters: readBrowseFiltersForGroups(spRecord(qs, SEARCH_KEYS), ["season", "method", "lifeCycle", "hue"], "single"),
    });
    expect(viaRoute).toEqual(viaService);
  });

  it("honors every filter group (totals narrow with each added group)", async () => {
    const total = async (qs: string) => (await searchPayloadOf(await getSearch(qs))).total;
    const all = await total("?q=zinnia");
    expect(all).toBeGreaterThan(0);
    const cool = await total("?q=zinnia&season=cool");
    const coolDirect = await total("?q=zinnia&season=cool&method=direct");
    expect(cool).toBeLessThanOrEqual(all);
    expect(coolDirect).toBeLessThanOrEqual(cool);
    const pink = await total("?q=zinnia&color_family=pink");
    expect(pink).toBeLessThanOrEqual(all);
    const annual = await total("?q=zinnia&life_cycle=annual");
    expect(annual).toBeLessThanOrEqual(all);
  });

  it("an empty query answers the empty payload (total 0, groups empty, counts present)", async () => {
    const payload = await searchPayloadOf(await getSearch(""));
    expect(payload.total).toBe(0);
    expect(payload.crops).toEqual([]);
    expect(payload.series).toEqual([]);
    expect(payload.varieties).toEqual([]);
    expect(payload.sellers).toEqual([]);
  });

  it("answers internal headers (noindex, no-store — never cached, never indexed)", async () => {
    const res = await getSearch("?q=zinnia");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("is GET-only (POST/PUT/PATCH/DELETE/OPTIONS/HEAD answer 405)", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const) {
      const res = await searchRoute[method](new Request("https://seeds.hues.flowers/api/browse/search"));
      expect(res.status, method).toBe(405);
    }
  });

  it("carries no price key anywhere in the served bytes", async () => {
    const text = await (await getSearch("?q=zinnia&season=cool")).text();
    expect(text).not.toMatch(/"[^"]*price[^"]*"\s*:/i);
  });
});
