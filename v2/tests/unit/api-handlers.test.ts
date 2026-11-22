/**
 * Direct tests for lib/api/handlers.ts (refactor R2 §5): the read handlers against a
 * fake Services object from the §3 factory (no mocking — handlers take Services via
 * ApiContext). Happy paths plus the not-found error for a missing slug. Pins current
 * behavior.
 */
import { describe, expect, it } from "vitest";
import type { RuntimeEnv } from "@/lib/api/runtime-env";
import type { ApiContext } from "@/lib/api/route";
import type { Services } from "@/lib/services";
import { ApiError } from "@/lib/api/errors";
import { getSeller, getVariety, listSellerListings, listSellers, listVarieties } from "@/lib/api/handlers";
import { fakeServices } from "../helpers/services-context";

const ENV: RuntimeEnv = {
  siteUrl: "https://seeds.hues.flowers",
  corsOrigins: [],
  rateLimiter: null,
  snapshots: null,
  revalidateToken: null,
};

function ctxOf(url: string, services: Services, params: Record<string, string> = {}): ApiContext {
  const req = new Request(url);
  return { req, url: new URL(url), params, services, env: ENV };
}

/** Await a handler, returning the thrown error (or null when it resolves). */
async function catchErr(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error("expected the handler to throw");
}

describe("listVarieties", () => {
  it("pages the catalog output with next_cursor + has_more", async () => {
    const items = [{ slug: "a" }, { slug: "b" }];
    const services = fakeServices({ catalog: { listVarieties: async () => ({ items, total: 2 }) } });
    const out = await listVarieties(ctxOf("https://x/varieties?limit=10", services));
    expect(out).not.toBeInstanceOf(Response);
    if (out instanceof Response) throw new Error("unreachable");
    expect(out.data).toEqual(items);
    expect(out.meta).toEqual({ nextCursor: null, count: 2, total: 2 });
    expect(out.page).toEqual({ next_cursor: null, has_more: false });
  });

  it("passes sort, filters and the cursor page to the catalog", async () => {
    let seen: unknown;
    const services = fakeServices({
      catalog: {
        listVarieties: async (opts: unknown) => {
          seen = opts;
          return { items: [], total: 0 };
        },
      },
    });
    await listVarieties(ctxOf("https://x/varieties?sort=name&crop=zinnia&limit=5", services));
    expect(seen).toMatchObject({ sort: "name", page: { offset: 0, limit: 5 } });
    expect((seen as { filters: { plant: string[] } }).filters.plant).toEqual(["zinnia"]);
  });

  it("rejects an unknown sort with a 400 validation_error", async () => {
    const services = fakeServices({ catalog: { listVarieties: async () => ({ items: [], total: 0 }) } });
    const err = await catchErr(listVarieties(ctxOf("https://x/varieties?sort=bogus", services)));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe("validation_error");
  });
});

describe("getVariety", () => {
  it("returns the detail as a single-item envelope", async () => {
    const v = { slug: "zinnia-x", varietyName: "X" };
    const services = fakeServices({ catalog: { getVariety: async () => v } });
    const out = await getVariety(ctxOf("https://x/varieties/zinnia-x", services, { slug: "zinnia-x" }));
    if (out instanceof Response) throw new Error("unreachable");
    expect(out.data).toEqual(v);
    expect(out.meta).toEqual({ nextCursor: null, count: 1 });
  });

  it("a missing slug is a 404 not_found", async () => {
    const services = fakeServices({ catalog: { getVariety: async () => null } });
    const err = await catchErr(getVariety(ctxOf("https://x/varieties/nope", services, { slug: "nope" })));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.code).toBe("not_found");
  });

  it("a malformed slug 404s without reaching the catalog", async () => {
    let called = false;
    const services = fakeServices({
      catalog: {
        getVariety: async () => {
          called = true;
          return null;
        },
      },
    });
    const err = await catchErr(getVariety(ctxOf("https://x/varieties/x", services, { slug: "Not A Slug!!" })));
    expect(err.status).toBe(404);
    expect(called).toBe(false);
  });
});

describe("listSellerListings", () => {
  it("returns the seller's listings with counts", async () => {
    const ls = [{ id: 1 }, { id: 2 }];
    const services = fakeServices({ catalog: { sellerListings: async () => ls } });
    const out = await listSellerListings(ctxOf("https://x/sellers/floret/listings", services, { slug: "floret" }));
    if (out instanceof Response) throw new Error("unreachable");
    expect(out.data).toEqual(ls);
    expect(out.meta).toEqual({ nextCursor: null, count: 2, total: 2 });
  });

  it("a missing seller is a 404 not_found", async () => {
    const services = fakeServices({ catalog: { sellerListings: async () => null, sellerStatus: async () => "missing" } });
    const err = await catchErr(listSellerListings(ctxOf("https://x/sellers/nope/listings", services, { slug: "nope" })));
    expect(err.status).toBe(404);
    expect(err.code).toBe("not_found");
  });

  it("a removed seller is a 410 gone", async () => {
    const services = fakeServices({ catalog: { sellerListings: async () => null, sellerStatus: async () => "gone" } });
    const err = await catchErr(listSellerListings(ctxOf("https://x/sellers/old/listings", services, { slug: "old" })));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(410);
    expect(err.code).toBe("gone");
  });
});

describe("getSeller", () => {
  it("returns the detail; a missing seller 404s; a removed seller is 410", async () => {
    const s = { slug: "floret", name: "Floret" };
    const ok = fakeServices({ catalog: { getSeller: async () => s } });
    const out = await getSeller(ctxOf("https://x/sellers/floret", ok, { slug: "floret" }));
    if (out instanceof Response) throw new Error("unreachable");
    expect(out.data).toEqual(s);

    const missing = fakeServices({ catalog: { getSeller: async () => null, sellerStatus: async () => "missing" } });
    expect((await catchErr(getSeller(ctxOf("https://x/sellers/nope", missing, { slug: "nope" })))).status).toBe(404);

    const gone = fakeServices({ catalog: { getSeller: async () => null, sellerStatus: async () => "gone" } });
    const err = await catchErr(getSeller(ctxOf("https://x/sellers/old", gone, { slug: "old" })));
    expect(err.status).toBe(410);
    expect(err.code).toBe("gone");
  });
});

describe("listSellers", () => {
  it("pages with has_more past the first page and uppercases regions", async () => {
    let seenFilters: unknown;
    const items = [{ slug: "a" }, { slug: "b" }, { slug: "c" }, { slug: "d" }, { slug: "e" }];
    const services = fakeServices({
      catalog: {
        listSellers: async (_page: unknown, filters: unknown) => {
          seenFilters = filters;
          return { items, total: 12 };
        },
      },
    });
    const out = await listSellers(ctxOf("https://x/sellers?limit=5&region=or", services));
    if (out instanceof Response) throw new Error("unreachable");
    expect(out.data).toEqual(items);
    expect(out.meta).toMatchObject({ count: 5, total: 12 });
    expect(out.page?.has_more).toBe(true);
    expect(typeof out.page?.next_cursor).toBe("string");
    expect(seenFilters).toMatchObject({ region: ["OR"] });
  });
});
