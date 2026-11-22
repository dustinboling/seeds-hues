/**
 * Direct tests for lib/api/write-route.ts (refactor R2 §5): parseBody, intParam and
 * writeRouter dispatch semantics at the level the module exposes. Pins current behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { RuntimeEnv } from "@/lib/api/runtime-env";

const store = vi.hoisted(() => ({ services: null as unknown, env: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => store.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => store.env }));

import { intParam, parseBody, writeRouter, type RouteSpec } from "@/lib/api/write-route";
import { Problem } from "@/lib/api/problem";
import { fakeServices } from "../helpers/services-context";

const ENV = {
  siteUrl: "https://seeds.hues.flowers",
  corsOrigins: ["https://seeds.hues.flowers"],
  rateLimiter: null,
  limiters: { search: null, reports: null, ingest: null },
  snapshots: null,
  revalidateToken: null,
} satisfies RuntimeEnv;

beforeEach(() => {
  store.services = fakeServices({});
  store.env = ENV;
});

describe("parseBody", () => {
  const schema = z.object({ name: z.string().min(1) });

  it("a valid body passes through", () => {
    expect(parseBody(schema, { name: "Floret" })).toEqual({ name: "Floret" });
  });

  it("a schema failure raises a 400 validation_error problem", () => {
    let err: unknown;
    try {
      parseBody(schema, {});
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Problem);
    const p = err as Problem;
    expect(p.status).toBe(400);
    expect(p.code).toBe("validation_error");
    expect(p.detail).toContain("name:");
  });
});

describe("intParam", () => {
  it("a valid integer passes through as a number", () => {
    expect(intParam("7", "id")).toBe(7);
    expect(intParam("007", "id")).toBe(7);
  });

  it("missing, empty or non-numeric values are 404 not_found problems", () => {
    for (const v of [undefined, "", "abc", "12x", "1.5", "-3"]) {
      let err: unknown;
      try {
        intParam(v, "id");
      } catch (e) {
        err = e;
      }
      expect(err, JSON.stringify(v)).toBeInstanceOf(Problem);
      expect((err as Problem).status).toBe(404);
      expect((err as Problem).code).toBe("not_found");
      expect((err as Problem).detail).toBe("id not found");
    }
  });
});

describe("writeRouter dispatch", () => {
  const seen: { params?: Record<string, string>; body?: unknown } = {};
  const routes: RouteSpec[] = [
    { method: "GET", pattern: "ping", scope: null, bucket: null, handler: async () => ({ data: { pong: true } }) },
    {
      method: "POST",
      pattern: "echo/:id",
      scope: null,
      bucket: null,
      handler: async (ctx) => {
        seen.params = ctx.params;
        seen.body = ctx.body;
        return { data: { id: ctx.params.id } };
      },
    },
  ];
  const router = writeRouter("/api/v1/test", routes);
  const ctx = { params: Promise.resolve({}) };

  it("a matched GET returns the data envelope, no-store", async () => {
    const res = await router.GET(new Request("https://x/api/v1/test/ping"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-API-Version")).toBe("1");
    expect(await res.json()).toEqual({ data: { pong: true }, meta: { generated_at: expect.any(String) } });
  });

  it("a matched POST receives decoded path params and the parsed JSON body", async () => {
    const res = await router.POST(
      new Request("https://x/api/v1/test/echo/hello%20world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: 1 }),
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "hello world" }, meta: { generated_at: expect.any(String) } });
    expect(seen.params).toEqual({ id: "hello world" });
    expect(seen.body).toEqual({ a: 1 });
  });

  it("an unknown path is a 404 not_found problem", async () => {
    const res = await router.GET(new Request("https://x/api/v1/test/nope"), ctx);
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await res.json()).toMatchObject({ code: "not_found", detail: "no endpoint /api/v1/test/nope" });
  });

  it("a known path with the wrong method is a 405 with an Allow header", async () => {
    const res = await router.POST(new Request("https://x/api/v1/test/ping", { method: "POST" }), ctx);
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET");
    expect(await res.json()).toMatchObject({ code: "method_not_allowed", detail: "use GET" });
  });

  it("a POST with a non-JSON body is a 400 invalid_json problem", async () => {
    const res = await router.POST(new Request("https://x/api/v1/test/echo/1", { method: "POST", body: "{nope" }), ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_json" });
  });

  it("HEAD dispatches as GET and answers with an empty body", async () => {
    const res = await router.HEAD(new Request("https://x/api/v1/test/ping", { method: "HEAD" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });
});
