/**
 * Tranche 3.1a — GET /api/browse/varieties: the in-place payload endpoint. Same query
 * vocabulary as the /variety page, same service call the page renders with; totals match the
 * service for the same filters, garbage/past-end pages are JSON 404s (the page's own guard
 * rule), other methods are 405s, and the response is internal (noindex, no-store).
 *
 * Non-vacuity: fails on pre-build code — the route does not exist there.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ services: null as unknown, env: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => ctx.env }));

import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import * as route from "@/app/api/browse/varieties/route";
import { readBrowseFilters } from "@/lib/browse";
import { pageWindow } from "@/lib/paging";
import { BrowseVarietiesPayloadSchema, type BrowseVarietiesPayload } from "@/lib/validators";

let t: TestD1;
beforeAll(async () => {
  t = await createTestD1();
  ctx.services = createServices(t.db);
  ctx.env = { siteUrl: "https://seeds.hues.flowers", corsOrigins: [], rateLimiter: null, snapshots: null, revalidateToken: "x", clickSalt: "x" };
});
afterAll(async () => {
  await t?.dispose();
});

const get = (qs: string) => route.GET(new Request(`https://seeds.hues.flowers/api/browse/varieties${qs}`));

async function payloadOf(res: Response): Promise<BrowseVarietiesPayload> {
  expect(res.status).toBe(200);
  const json: unknown = await res.json();
  const parsed = BrowseVarietiesPayloadSchema.safeParse(json);
  expect(parsed.success, "the endpoint serves the payload contract").toBe(true);
  if (!parsed.success) throw new Error("unreachable");
  return parsed.data;
}

describe("GET /api/browse/varieties", () => {
  it("serves the identical contract the page renders with (same service, same filters)", async () => {
    const qs = "?season=cool&color_family=pink,peach&small_farm=true";
    const viaRoute = await payloadOf(await get(qs));
    const url = new URL(`https://seeds.hues.flowers/${qs}`);
    const sp: Record<string, string | string[] | undefined> = {};
    for (const k of ["season", "method", "life_cycle", "color_family", "small_farm"]) {
      const all = url.searchParams.getAll(k);
      if (all.length === 1) sp[k] = all[0];
      else if (all.length > 1) sp[k] = all;
    }
    const viaService = await createServices(t.db).catalog.browseVarieties({
      filters: readBrowseFilters(sp, "multi"),
      page: pageWindow(1),
    });
    expect(viaRoute).toEqual(viaService);
  });

  it("honors every filter group (totals narrow with each added group)", async () => {
    const total = async (qs: string) => (await payloadOf(await get(qs))).total;
    const all = await total("");
    expect(all).toBeGreaterThan(0);
    const cool = await total("?season=cool");
    const coolPink = await total("?season=cool&color_family=pink");
    expect(cool).toBeLessThanOrEqual(all);
    expect(coolPink).toBeLessThanOrEqual(cool);
    const twoHues = await total("?color_family=pink,peach");
    const oneHue = await total("?color_family=pink");
    expect(twoHues).toBeGreaterThanOrEqual(oneHue);
  });

  it("?page= past the end and garbage ?page= are JSON 404s (the page's guard rule)", async () => {
    const total = (await payloadOf(await get(""))).total;
    const lastPage = Math.max(1, Math.ceil(total / 24));
    expect((await get(`?page=${lastPage + 1}`)).status).toBe(404);
    expect((await get("?page=bogus")).status).toBe(404);
    expect((await get("?page=0")).status).toBe(404);
    const body = (await (await get("?page=bogus")).json()) as { error?: { code?: unknown } };
    expect(body.error?.code).toBe("not_found");
  });

  it("answers internal headers (noindex, no-store — never cached, never indexed)", async () => {
    const res = await get("?season=warm");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("is GET-only (POST/PUT/PATCH/DELETE/OPTIONS/HEAD answer 405)", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const) {
      const res = await route[method](new Request("https://seeds.hues.flowers/api/browse/varieties"));
      expect(res.status, method).toBe(405);
    }
  });

  it("carries no price key anywhere in the served bytes", async () => {
    const text = await (await get("?hue=x&color_family=mix")).text();
    expect(text).not.toMatch(/"[^"]*price[^"]*"\s*:/i);
  });
});
