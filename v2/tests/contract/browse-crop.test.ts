/**
 * Tranche 3.1b-2 debt, folded into 3.4 — GET /api/browse/crops/[slug]: the crop-detail
 * in-place payload endpoint. Same query vocabulary as the crop page (incl. ?sort= — the
 * payload carries the new sort state in this build), same service call the page renders
 * with; totals and order match the service for the same state, garbage/past-end pages and
 * unknown slugs are JSON 404s (the page's own guard rule), other methods are 405s, and the
 * response is internal (noindex, no-store).
 *
 * Non-vacuity: fails on pre-build code — no handler-level contract test covers this route
 * (and ?sort= is unparsed there).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ services: null as unknown, env: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => ctx.env }));

import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import * as route from "@/app/api/browse/crops/[slug]/route";
import { readCropDetailFilters } from "@/lib/crop-detail";
import { pageWindow } from "@/lib/paging";
import { BrowseCropPayloadSchema, type BrowseCropPayload } from "@/lib/validators";

let t: TestD1;
beforeAll(async () => {
  t = await createTestD1();
  ctx.services = createServices(t.db);
  ctx.env = { siteUrl: "https://seeds.hues.flowers", corsOrigins: [], rateLimiter: null, snapshots: null, revalidateToken: "x", clickSalt: "x" };
});
afterAll(async () => {
  await t?.dispose();
});

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const get = (slug: string, qs: string) =>
  route.GET(new Request(`https://seeds.hues.flowers/api/browse/crops/${slug}${qs}`), params(slug));

async function payloadOf(res: Response): Promise<BrowseCropPayload> {
  expect(res.status).toBe(200);
  const json: unknown = await res.json();
  const parsed = BrowseCropPayloadSchema.safeParse(json);
  expect(parsed.success, "the endpoint serves the payload contract").toBe(true);
  if (!parsed.success) throw new Error("unreachable");
  return parsed.data;
}

describe("GET /api/browse/crops/[slug]", () => {
  it("serves the identical contract the page renders with (same service, same state, incl. sort)", async () => {
    const qs = "?color_family=pink&has_sellers=true&sort=availability";
    const viaRoute = await payloadOf(await get("sweet-pea", qs));
    const url = new URL(`https://seeds.hues.flowers/${qs}`);
    const sp: Record<string, string | string[] | undefined> = {};
    for (const k of ["color_family", "series", "has_sellers", "sort"]) {
      const all = url.searchParams.getAll(k);
      if (all.length === 1) sp[k] = all[0];
      else if (all.length > 1) sp[k] = all;
    }
    const viaService = (await createServices(t.db).catalog.browseCrop("sweet-pea", {
      state: readCropDetailFilters(sp),
      page: pageWindow(1),
    }))!;
    expect(viaRoute).toEqual({
      items: viaService.crop.varieties,
      total: viaService.total,
      page: viaService.page,
      pages: viaService.pages,
      counts: viaService.counts,
    });
  });

  it("honors ?sort=: availability leads with in-stock varieties, name stays A–Z", async () => {
    const avail = await payloadOf(await get("sweet-pea", "?sort=availability"));
    expect(avail.total).toBeGreaterThan(0);
    expect(avail.items[0]!.inStockCount).toBeGreaterThan(0);
    const names = (await payloadOf(await get("sweet-pea", "?sort=name"))).items.map((v) => v.varietyName.toLowerCase());
    expect([...names].sort()).toEqual(names);
  });

  it("unknown slugs, ?page= past the end and garbage ?page= are JSON 404s (the page's guard rule)", async () => {
    expect((await get("no-such-crop", "")).status).toBe(404);
    const total = (await payloadOf(await get("sweet-pea", ""))).total;
    const lastPage = Math.max(1, Math.ceil(total / 24));
    expect((await get("sweet-pea", `?page=${lastPage + 1}`)).status).toBe(404);
    expect((await get("sweet-pea", "?page=bogus")).status).toBe(404);
    const body = (await (await get("sweet-pea", "?page=bogus")).json()) as { error?: { code?: unknown } };
    expect(body.error?.code).toBe("not_found");
  });

  it("answers internal headers (noindex, no-store — never cached, never indexed)", async () => {
    const res = await get("sweet-pea", "?has_sellers=true");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("is GET-only (POST/PUT/PATCH/DELETE/OPTIONS/HEAD answer 405)", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const) {
      const res = await route[method](new Request("https://seeds.hues.flowers/api/browse/crops/sweet-pea"));
      expect(res.status, method).toBe(405);
    }
  });

  it("carries no price key anywhere in the served bytes", async () => {
    const text = await (await get("sweet-pea", "?sort=recent")).text();
    expect(text).not.toMatch(/"[^"]*price[^"]*"\s*:/i);
  });
});
