/**
 * Tranche 3.1b-2 debt, folded into 3.4 — GET /api/browse/sellers: the /seller in-place
 * payload endpoint. Same query vocabulary as the seller page (?state= ?page=), same service
 * call the page renders with; totals match the service for the same state, garbage/past-end
 * pages are JSON 404s (the page's own guard rule), other methods are 405s, and the response
 * is internal (noindex, no-store).
 *
 * Non-vacuity: fails on pre-build code — no handler-level contract test covers this route.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ services: null as unknown, env: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => ctx.env }));

import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import * as route from "@/app/api/browse/sellers/route";
import { readSellerBrowseFilters } from "@/lib/seller-browse";
import { pageWindow } from "@/lib/paging";
import { BrowseSellersPayloadSchema, type BrowseSellersPayload } from "@/lib/validators";

let t: TestD1;
beforeAll(async () => {
  t = await createTestD1();
  ctx.services = createServices(t.db);
  ctx.env = { siteUrl: "https://seeds.hues.flowers", corsOrigins: [], rateLimiter: null, snapshots: null, revalidateToken: "x", clickSalt: "x" };
});
afterAll(async () => {
  await t?.dispose();
});

const get = (qs: string) => route.GET(new Request(`https://seeds.hues.flowers/api/browse/sellers${qs}`));

async function payloadOf(res: Response): Promise<BrowseSellersPayload> {
  expect(res.status).toBe(200);
  const json: unknown = await res.json();
  const parsed = BrowseSellersPayloadSchema.safeParse(json);
  expect(parsed.success, "the endpoint serves the payload contract").toBe(true);
  if (!parsed.success) throw new Error("unreachable");
  return parsed.data;
}

describe("GET /api/browse/sellers", () => {
  it("serves the identical contract the page renders with (same service, same state)", async () => {
    const services = createServices(t.db);
    const states = await services.catalog.listSellerStates();
    const code = states[0]!.code;
    const viaRoute = await payloadOf(await get(`?state=${code}`));
    const viaService = await services.catalog.browseSellers({
      state: readSellerBrowseFilters({ state: code }, states),
      page: pageWindow(1),
    });
    expect(viaRoute).toEqual({
      items: viaService.items,
      total: viaService.total,
      page: viaService.page,
      pages: viaService.pages,
      counts: viaService.counts,
    });
  });

  it("honors ?state= (totals narrow to the chosen state)", async () => {
    const all = (await payloadOf(await get(""))).total;
    expect(all).toBeGreaterThan(0);
    const states = await createServices(t.db).catalog.listSellerStates();
    const code = states[0]!.code;
    const narrowed = (await payloadOf(await get(`?state=${code}`))).total;
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThanOrEqual(all);
  });

  it("?page= past the end and garbage ?page= are JSON 404s (the page's guard rule)", async () => {
    const total = (await payloadOf(await get(""))).total;
    const lastPage = Math.max(1, Math.ceil(total / 24));
    expect((await get(`?page=${lastPage + 1}`)).status).toBe(404);
    expect((await get("?page=bogus")).status).toBe(404);
    const body = (await (await get("?page=bogus")).json()) as { error?: { code?: unknown } };
    expect(body.error?.code).toBe("not_found");
  });

  it("answers internal headers (noindex, no-store — never cached, never indexed)", async () => {
    const res = await get("?state=CA");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("is GET-only (POST/PUT/PATCH/DELETE/OPTIONS/HEAD answer 405)", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const) {
      const res = await route[method](new Request("https://seeds.hues.flowers/api/browse/sellers"));
      expect(res.status, method).toBe(405);
    }
  });

  it("carries no price key anywhere in the served bytes", async () => {
    const text = await (await get("?state=CA")).text();
    expect(text).not.toMatch(/"[^"]*price[^"]*"\s*:/i);
  });
});
