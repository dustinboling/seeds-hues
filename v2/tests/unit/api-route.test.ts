/**
 * Direct tests for lib/api/route.ts (refactor R2 §5): the apiRoute wrapper's success
 * envelope, error mapping (Problem / ApiError → response) and the method/auth plumbing
 * the wrapper itself owns (405s, OPTIONS, rate limits). Pins current behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "@/lib/api/runtime-env";

const store = vi.hoisted(() => ({ services: null as unknown, env: null as unknown, envThrows: false }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => store.services }));
vi.mock("@/lib/api/runtime-env", () => ({
  getRuntimeEnv: async () => {
    if (store.envThrows) throw new Error("boom");
    return store.env;
  },
}));

import { apiRoute } from "@/lib/api/route";
import { ApiError } from "@/lib/api/errors";
import { Problem } from "@/lib/api/problem";
import { resetTokenBuckets, tokenBucketAllow } from "@/lib/api/rate-limit";
import { fakeServices } from "../helpers/services-context";

const ENV = {
  siteUrl: "https://seeds.hues.flowers",
  corsOrigins: ["https://seeds.hues.flowers"],
  rateLimiter: null,
  limiters: { search: null, reports: null, ingest: null },
  snapshots: null,
  revalidateToken: null,
} satisfies RuntimeEnv;

const CTX = { params: Promise.resolve({}) };
const get = (url: string, init?: RequestInit) => new Request(url, init);

beforeEach(() => {
  resetTokenBuckets();
  store.envThrows = false;
  store.env = ENV;
  store.services = fakeServices({ catalog: { catalogSeq: async () => 42 } });
});

describe("success envelope", () => {
  it("wraps data with the default single page, catalog_seq and generated_at", async () => {
    const { GET } = apiRoute(async () => ({ data: { hello: "world" } }));
    const res = await GET(get("https://seeds.hues.flowers/api/v1/ping"), CTX);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-API-Version")).toBe("1");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300, stale-while-revalidate=86400");
    expect(res.headers.get("ETag")).toMatch(/^"[0-9a-f]{32}"$/);
    expect(await res.json()).toEqual({
      data: { hello: "world" },
      page: { next_cursor: null, has_more: false },
      meta: { catalog_seq: 42, generated_at: expect.any(String) },
      error: null,
    });
  });

  it("keeps the handler's page, meta and cacheControl", async () => {
    const { GET } = apiRoute(async () => ({
      data: [],
      page: { next_cursor: "abc", has_more: true },
      meta: { count: 0 },
      cacheControl: "public, max-age=60",
    }));
    const res = await GET(get("https://seeds.hues.flowers/api/v1/ping"), CTX);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(await res.json()).toEqual({
      data: [],
      page: { next_cursor: "abc", has_more: true },
      meta: { count: 0, catalog_seq: 42, generated_at: expect.any(String) },
      error: null,
    });
  });

  it("answers 304 when If-None-Match matches the envelope ETag", async () => {
    const { GET } = apiRoute(async () => ({ data: { hello: "world" } }));
    const first = await GET(get("https://seeds.hues.flowers/api/v1/ping"), CTX);
    const etag = first.headers.get("ETag")!;
    const second = await GET(get("https://seeds.hues.flowers/api/v1/ping", { headers: { "If-None-Match": etag } }), CTX);
    expect(second.status).toBe(304);
  });

  it("a handler Response passes through with the CORS headers set", async () => {
    const { GET } = apiRoute(async () => new Response("raw", { status: 201, headers: { "Content-Type": "text/plain" } }));
    const res = await GET(
      get("https://seeds.hues.flowers/api/v1/ping", { headers: { Origin: "https://seeds.hues.flowers" } }),
      CTX,
    );
    expect(res.status).toBe(201);
    expect(await res.text()).toBe("raw");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://seeds.hues.flowers");
  });
});

describe("error mapping", () => {
  it("a Problem always answers application/problem+json", async () => {
    const { GET } = apiRoute(async () => {
      throw new Problem(404, "not_found", "nope", { "Retry-After": "60" });
    });
    const res = await GET(get("https://seeds.hues.flowers/api/v1/ping"), CTX);
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(await res.json()).toMatchObject({ status: 404, code: "not_found", detail: "nope" });
  });

  it("an ApiError answers the legacy envelope by default", async () => {
    const { GET } = apiRoute(async () => {
      throw new ApiError(400, "validation_error", "bad");
    });
    const res = await GET(get("https://seeds.hues.flowers/api/v1/ping"), CTX);
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(await res.json()).toEqual({ data: null, meta: null, error: { code: "validation_error", message: "bad" } });
  });

  it("an ApiError answers a problem with problemErrors", async () => {
    const { GET } = apiRoute(
      async () => {
        throw new ApiError(400, "validation_error", "bad");
      },
      { problemErrors: true },
    );
    const res = await GET(get("https://seeds.hues.flowers/api/v1/ping"), CTX);
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await res.json()).toMatchObject({ code: "validation_error", detail: "bad" });
  });

  it("an unexpected error is a 500 internal", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { GET } = apiRoute(async () => {
        throw new Error("kaboom");
      });
      const res = await GET(get("https://seeds.hues.flowers/api/v1/ping"), CTX);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ data: null, meta: null, error: { code: "internal", message: "Internal error" } });
      expect(err).toHaveBeenCalled();
    } finally {
      err.mockRestore();
    }
  });

  it("an unavailable runtime env is a 500 internal", async () => {
    store.envThrows = true;
    const { GET } = apiRoute(async () => ({ data: 1 }));
    const res = await GET(get("https://seeds.hues.flowers/api/v1/ping"), CTX);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      data: null,
      meta: null,
      error: { code: "internal", message: "runtime environment unavailable" },
    });
  });
});

describe("method + rate-limit plumbing", () => {
  it("writes are 405 with an Allow header", async () => {
    const route = apiRoute(async () => ({ data: 1 }));
    for (const m of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const res = await route[m](get("https://seeds.hues.flowers/api/v1/ping", { method: m }));
      expect(res.status, m).toBe(405);
      expect(res.headers.get("Allow"), m).toBe("GET, HEAD, OPTIONS");
      expect(await res.json(), m).toEqual({
        data: null,
        meta: null,
        error: { code: "method_not_allowed", message: "The public API is read-only (GET, HEAD, OPTIONS)." },
      });
    }
  });

  it("OPTIONS is a 204 preflight with Allow and the API headers", async () => {
    const { OPTIONS } = apiRoute(async () => ({ data: 1 }));
    const res = await OPTIONS(
      get("https://seeds.hues.flowers/api/v1/ping", { method: "OPTIONS", headers: { Origin: "https://seeds.hues.flowers" } }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
    expect(res.headers.get("X-API-Version")).toBe("1");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://seeds.hues.flowers");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, HEAD, OPTIONS");
  });

  it("an exhausted rate-limit bucket is a 429 with Retry-After", async () => {
    const ip = "9.9.9.9";
    for (let i = 0; i < 120; i++) expect(tokenBucketAllow(ip)).toBe(true);
    const { GET } = apiRoute(async () => ({ data: 1 }));
    const res = await GET(get("https://seeds.hues.flowers/api/v1/ping", { headers: { "cf-connecting-ip": ip } }), CTX);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(await res.json()).toEqual({
      data: null,
      meta: null,
      error: { code: "rate_limited", message: "Too many requests — limit is 120 per minute." },
    });
  });
});
