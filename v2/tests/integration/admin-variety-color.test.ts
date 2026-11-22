/**
 * The key-authenticated variety color write (Tranche 1.8) on a throwaway D1 (Miniflare):
 * POST /api/v1/admin/varieties/:id/color through the real route handler — partial updates
 * that never clobber the sibling field, uppercase-normalized hex storage, strict body
 * validation with nothing written on failure, and the sibling auth shape.
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
import { ADMIN_ROUTES } from "@/lib/api/ingest-admin-routes";
import * as adminRoute from "@/app/api/v1/admin/[...path]/route";

let t: TestD1;
let s: Services;
const BASE = "https://seeds.hues.flowers/api/v1";

type Handler = (req: Request, c: { params: Promise<Record<string, string | string[] | undefined>> }) => Promise<Response>;
function call(h: Handler, path: string, init: RequestInit = {}) {
  return h(new Request(`${BASE}${path}`, init), { params: Promise.resolve({}) });
}
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  call(adminRoute.POST as Handler, path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

type StoredColor = { color_family: string; color_swatch: string | null; updated_at: string; updated_seq: number };
const stored = async (slug: string) =>
  (await t.env.DB.prepare("SELECT color_family, color_swatch, updated_at, updated_seq FROM varieties WHERE slug = ?").bind(slug).first<StoredColor>())!;
const plantOf = async (slug: string) =>
  (await t.env.DB.prepare("SELECT p.slug AS slug FROM varieties v JOIN plants p ON p.id = v.plant_id WHERE v.slug = ?").bind(slug).first<{ slug: string }>())!.slug;

beforeAll(async () => {
  t = await createTestD1();
  s = createServices(t.db, { snapshots: t.env.SNAPSHOTS });
  ctx.services = s;
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
}, 180_000);

afterAll(async () => {
  await t?.dispose();
});
beforeEach(() => resetTokenBuckets());

describe("registration", () => {
  it("varieties/:id/color rides the admin route table beside the variety remove route", () => {
    expect(ADMIN_ROUTES.find((r) => r.pattern === "varieties/:id/color")).toMatchObject({
      method: "POST",
      scope: "admin",
      bucket: null,
      idempotent: true,
    });
  });
});

describe("route: family set, swatch set and clear", () => {
  it("POST a family sets it without touching the swatch; changed names it; the catalog sequence advances", async () => {
    const admin = await s.auth.mint("color-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("sweet-pea-clementine-kiss");
    expect(before.color_family).toBe("orange");
    expect(before.color_swatch).toBeNull();
    const seqBefore = await s.catalog.catalogSeq();

    const r = await post("/admin/varieties/sweet-pea-clementine-kiss/color", { color_family: "mix" }, auth);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { data: { variety: string; id: number; changed: string[] } };
    expect(body.data.variety).toBe("sweet-pea-clementine-kiss");
    expect(body.data.changed).toContain("color_family");
    expect(body.data.changed).not.toContain("color_swatch");

    const after = await stored("sweet-pea-clementine-kiss");
    expect(after.color_family).toBe("mix");
    expect(after.color_swatch).toBe(before.color_swatch);
    expect(await s.catalog.catalogSeq()).toBeGreaterThan(seqBefore);

    // Read-back through the public service agrees.
    const v = (await s.catalog.getVariety("sweet-pea-clementine-kiss"))!;
    expect(v.colorFamily).toBe("mix");
    expect(v.colorSwatch).toBeNull();
    expect(v.facts.color_family).toBe("mix");
  });

  it("a sourced swatch survives a family-only update", async () => {
    const admin = await s.auth.mint("color-sibling-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("stock-katz-mix");
    expect(before.color_swatch).toBe("#E8A0BF");

    const r = await post("/admin/varieties/stock-katz-mix/color", { color_family: "pink" }, auth);
    expect(r.status).toBe(200);
    const after = await stored("stock-katz-mix");
    expect(after.color_family).toBe("pink");
    expect(after.color_swatch).toBe("#E8A0BF");
  });

  it("POST a null swatch clears it without touching the family", async () => {
    const admin = await s.auth.mint("color-clear-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("snapdragon-rocket-mix");
    expect(before.color_swatch).toBe("#F4A460");

    const r = await post("/admin/varieties/snapdragon-rocket-mix/color", { color_swatch: null }, auth);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { changed: string[] } }).data.changed).toEqual(["color_swatch"]);
    const after = await stored("snapdragon-rocket-mix");
    expect(after.color_swatch).toBeNull();
    expect(after.color_family).toBe(before.color_family);
  });

  it("a submitted hex is stored uppercase-normalized, like the importer writes", async () => {
    const admin = await s.auth.mint("color-hex-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };

    const r = await post("/admin/varieties/sweet-pea-wild-swan/color", { color_swatch: "#ff69b4" }, auth);
    expect(r.status).toBe(200);
    const after = await stored("sweet-pea-wild-swan");
    expect(after.color_swatch).toBe("#FF69B4");
    expect(after.color_family).toBe("white");
  });

  it('"unknown" files the family back to unfiled', async () => {
    const admin = await s.auth.mint("color-unknown-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    expect((await stored("sweet-pea-bix")).color_family).toBe("white");

    const r = await post("/admin/varieties/sweet-pea-bix/color", { color_family: "unknown" }, auth);
    expect(r.status).toBe(200);
    expect((await stored("sweet-pea-bix")).color_family).toBe("unknown");
  });

  it("the revalidate set covers the variety page, its crop page, and the directory", async () => {
    const slug = "sweet-pea-blue-shift";
    const spec = ADMIN_ROUTES.find((r) => r.pattern === "varieties/:id/color")!;
    const out = await spec.handler({ services: s, params: { id: slug }, body: { color_family: "blue" } } as never);
    expect((out.data as { changed: string[] }).changed).toContain("color_family");
    expect(out.revalidate).toContain(`/variety/${slug}`);
    expect(out.revalidate).toContain(`/crop/${await plantOf(slug)}`);
    expect(out.revalidate).toContain("/variety");
  });

  it("numeric ids work; malformed refs 404 like the sibling routes", async () => {
    const admin = await s.auth.mint("color-ref-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const id = (await t.env.DB.prepare("SELECT id FROM varieties WHERE slug = 'sweet-pea-raspberry-flake'").first<{ id: number }>())!.id;
    const ok = await post(`/admin/varieties/${id}/color`, { color_family: "blush" }, auth);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { id: number; changed: string[] } }).data.id).toBe(id);
    expect((await stored("sweet-pea-raspberry-flake")).color_family).toBe("blush");

    const bad = await post("/admin/varieties/BAD_SLUG!!/color", { color_family: "pink" }, auth);
    expect(bad.status).toBe(404);
    expect(await bad.json()).toMatchObject({ code: "not_found" });

    const missing = await post("/admin/varieties/no-such-variety/color", { color_family: "pink" }, auth);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "variety_not_found" });
  });
});

describe("route validation", () => {
  it("an out-of-vocabulary family is 400 and leaves the stored row byte-identical", async () => {
    const admin = await s.auth.mint("color-taupe-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("sweet-pea-oban-bay");

    const r = await post("/admin/varieties/sweet-pea-oban-bay/color", { color_family: "taupe" }, auth);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: "validation_error" });
    expect(await stored("sweet-pea-oban-bay")).toEqual(before);
  });

  it("a malformed swatch is 400 with nothing written", async () => {
    const admin = await s.auth.mint("color-badhex-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("sweet-pea-emma");
    for (const color_swatch of ["FF69B4", "#FFF", "#GGGGGG", "hot pink", 42]) {
      const r = await post("/admin/varieties/sweet-pea-emma/color", { color_swatch }, auth);
      expect(r.status, JSON.stringify(color_swatch)).toBe(400);
      expect(await r.json()).toMatchObject({ code: "validation_error" });
    }
    expect(await stored("sweet-pea-emma")).toEqual(before);
  });

  it("an empty body and unknown keys are 400 with nothing written", async () => {
    const admin = await s.auth.mint("color-empty-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("sweet-pea-mollie-rilstone");
    for (const body of [{}, { color_family: "pink", variety_name: "Sneaky" }, { description: "not a color field" }]) {
      const r = await post("/admin/varieties/sweet-pea-mollie-rilstone/color", body, auth);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(await r.json()).toMatchObject({ code: "validation_error" });
    }
    expect(await stored("sweet-pea-mollie-rilstone")).toEqual(before);
  });
});

describe("service level: the shared funnel", () => {
  it("varietyColorUpdate resolves slugs and ids, and 404s unknown refs", async () => {
    const bySlug = await s.admin.varietyColorUpdate("sweet-pea-oban-bay", { color_family: "white" });
    expect(bySlug.data.changed).toContain("color_family");
    expect(bySlug.revalidate).toContain("/variety/sweet-pea-oban-bay");
    const id = (await t.env.DB.prepare("SELECT id FROM varieties WHERE slug = 'sweet-pea-oban-bay'").first<{ id: number }>())!.id;
    const byId = await s.admin.varietyColorUpdate(String(id), { color_swatch: "#FFFFFF" });
    expect(byId.data.changed).toContain("color_swatch");
    expect((await stored("sweet-pea-oban-bay")).color_swatch).toBe("#FFFFFF");
    await expect(s.admin.varietyColorUpdate("no-such-variety", { color_family: "pink" })).rejects.toMatchObject({
      status: 404,
      code: "variety_not_found",
    });
  });
});

describe("auth", () => {
  it("401 without a key, 403 with the wrong scope, 200 with an admin key", async () => {
    const ingest = await s.auth.mint("color-ingest", ["ingest"]);
    const admin = await s.auth.mint("color-auth-admin", ["admin"]);
    const body = { color_family: "pink" };

    const none = await post("/admin/varieties/sweet-pea-nimbus/color", body);
    expect(none.status).toBe(401);
    expect(none.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await none.json()).toMatchObject({ code: "unauthorized" });

    const wrong = await post("/admin/varieties/sweet-pea-nimbus/color", body, { Authorization: `Bearer ${ingest.token}` });
    expect(wrong.status).toBe(403);
    expect(await wrong.json()).toMatchObject({ code: "insufficient_scope" });

    const before = await stored("sweet-pea-nimbus");
    expect(before.color_family).not.toBe("pink");

    const ok = await post("/admin/varieties/sweet-pea-nimbus/color", body, { Authorization: `Bearer ${admin.token}` });
    expect(ok.status).toBe(200);
    expect((await stored("sweet-pea-nimbus")).color_family).toBe("pink");
  });
});
