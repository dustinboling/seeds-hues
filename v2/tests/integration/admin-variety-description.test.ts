/**
 * The key-authenticated variety description write (decision 28) on a throwaway D1
 * (Miniflare): POST /api/v1/admin/varieties/:id/description through the real route
 * handler — set with read-back verification (the Tranche 1.1 pattern), idempotent
 * re-set, null clears to NULL, empty string rejected, and the sibling auth shape.
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

type StoredDescription = { description: string | null; updated_at: string; updated_seq: number };
const stored = async (slug: string) =>
  (await t.env.DB.prepare("SELECT description, updated_at, updated_seq FROM varieties WHERE slug = ?").bind(slug).first<StoredDescription>())!;
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
  it("varieties/:id/description rides the admin route table beside the color route", () => {
    expect(ADMIN_ROUTES.find((r) => r.pattern === "varieties/:id/description")).toMatchObject({
      method: "POST",
      scope: "admin",
      bucket: null,
      idempotent: true,
    });
  });
});

describe("route: set, re-set, and clear", () => {
  it("POST a description sets it; changed names description; the catalog sequence advances", async () => {
    const admin = await s.auth.mint("desc-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const text = "Key-route probe copy for the variety description write.";
    expect((await stored("sweet-pea-emma")).description).toBeNull();
    const seqBefore = await s.catalog.catalogSeq();

    const r = await post("/admin/varieties/sweet-pea-emma/description", { description: text }, auth);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { data: { variety: string; id: number; changed: string[] } };
    expect(body.data.variety).toBe("sweet-pea-emma");
    expect(body.data.changed).toEqual(["description"]);
    expect((await stored("sweet-pea-emma")).description).toBe(text);
    expect(await s.catalog.catalogSeq()).toBeGreaterThan(seqBefore);

    // Read-back through the public service agrees.
    const v = (await s.catalog.getVariety("sweet-pea-emma"))!;
    expect(v.description).toBe(text);
  });

  it("setting the same value again reports no change and writes nothing", async () => {
    const admin = await s.auth.mint("desc-idempotent-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const text = "Idempotent re-set probe copy.";

    const first = await post("/admin/varieties/sweet-pea-oban-bay/description", { description: text }, auth);
    expect(first.status).toBe(200);
    expect(((await first.json()) as { data: { changed: string[] } }).data.changed).toEqual(["description"]);
    const afterFirst = await stored("sweet-pea-oban-bay");

    const second = await post("/admin/varieties/sweet-pea-oban-bay/description", { description: text }, auth);
    expect(second.status).toBe(200);
    expect(((await second.json()) as { data: { changed: string[] } }).data.changed).toEqual([]);
    expect(await stored("sweet-pea-oban-bay")).toEqual(afterFirst);
  });

  it("POST null clears the description to NULL", async () => {
    const admin = await s.auth.mint("desc-clear-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    expect((await stored("stock-katz-mix")).description).not.toBeNull();

    const r = await post("/admin/varieties/stock-katz-mix/description", { description: null }, auth);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { changed: string[] } }).data.changed).toEqual(["description"]);
    expect((await stored("stock-katz-mix")).description).toBeNull();

    // Read-back through the public service agrees.
    const v = (await s.catalog.getVariety("stock-katz-mix"))!;
    expect(v.description).toBeNull();
  });

  it("the revalidate set is exactly the color funnel's three paths", async () => {
    const slug = "sweet-pea-blue-shift";
    const spec = ADMIN_ROUTES.find((r) => r.pattern === "varieties/:id/description")!;
    const out = await spec.handler({ services: s, params: { id: slug }, body: { description: "Revalidation-set probe copy." } } as never);
    expect((out.data as { changed: string[] }).changed).toEqual(["description"]);
    expect(out.revalidate).toEqual([`/variety/${slug}`, `/crop/${await plantOf(slug)}`, "/variety"]);
  });

  it("numeric ids work; malformed refs 404 like the sibling routes", async () => {
    const admin = await s.auth.mint("desc-ref-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const id = (await t.env.DB.prepare("SELECT id FROM varieties WHERE slug = 'sweet-pea-raspberry-flake'").first<{ id: number }>())!.id;
    const ok = await post(`/admin/varieties/${id}/description`, { description: "Numeric-ref probe copy." }, auth);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { id: number; changed: string[] } }).data.id).toBe(id);
    expect((await stored("sweet-pea-raspberry-flake")).description).toBe("Numeric-ref probe copy.");

    const bad = await post("/admin/varieties/BAD_SLUG!!/description", { description: "x" }, auth);
    expect(bad.status).toBe(404);
    expect(await bad.json()).toMatchObject({ code: "not_found" });

    const missing = await post("/admin/varieties/no-such-variety/description", { description: "x" }, auth);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "variety_not_found" });
  });
});

describe("route validation", () => {
  it("an empty string is a validation error, never a clear — clearing is null's job", async () => {
    const admin = await s.auth.mint("desc-empty-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("snapdragon-rocket-mix");
    expect(before.description).not.toBeNull();

    const r = await post("/admin/varieties/snapdragon-rocket-mix/description", { description: "" }, auth);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: "validation_error" });
    expect(await stored("snapdragon-rocket-mix")).toEqual(before);
  });

  it("the body is strict: missing, extra, over-long, or mistyped descriptions are 400 with nothing written", async () => {
    const admin = await s.auth.mint("desc-body-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("sweet-pea-mollie-rilstone");
    for (const body of [{}, { description: "x", extra: 1 }, { description: "x".repeat(2001) }, { description: 42 }, { description: { text: "x" } }]) {
      const r = await post("/admin/varieties/sweet-pea-mollie-rilstone/description", body, auth);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(await r.json()).toMatchObject({ code: "validation_error" });
    }
    expect(await stored("sweet-pea-mollie-rilstone")).toEqual(before);
  });
});

describe("service level: the shared funnel", () => {
  it("varietyDescriptionUpdate resolves slugs and ids, and 404s unknown refs", async () => {
    const bySlug = await s.admin.varietyDescriptionUpdate("sweet-pea-spring-sunshine-burgundy", { description: "Funnel probe copy." });
    expect(bySlug.data.changed).toEqual(["description"]);
    expect(bySlug.revalidate).toEqual(["/variety/sweet-pea-spring-sunshine-burgundy", `/crop/${await plantOf("sweet-pea-spring-sunshine-burgundy")}`, "/variety"]);
    const id = (await t.env.DB.prepare("SELECT id FROM varieties WHERE slug = 'sweet-pea-spring-sunshine-burgundy'").first<{ id: number }>())!.id;
    const byId = await s.admin.varietyDescriptionUpdate(String(id), { description: null });
    expect(byId.data.changed).toEqual(["description"]);
    expect((await stored("sweet-pea-spring-sunshine-burgundy")).description).toBeNull();
    await expect(s.admin.varietyDescriptionUpdate("no-such-variety", { description: "x" })).rejects.toMatchObject({
      status: 404,
      code: "variety_not_found",
    });
  });
});

describe("auth", () => {
  it("401 without a key, 403 with the wrong scope, 200 with an admin key", async () => {
    const ingest = await s.auth.mint("desc-ingest", ["ingest"]);
    const admin = await s.auth.mint("desc-auth-admin", ["admin"]);
    const body = { description: "Auth probe copy." };

    const none = await post("/admin/varieties/sweet-pea-nimbus/description", body);
    expect(none.status).toBe(401);
    expect(none.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await none.json()).toMatchObject({ code: "unauthorized" });

    const wrong = await post("/admin/varieties/sweet-pea-nimbus/description", body, { Authorization: `Bearer ${ingest.token}` });
    expect(wrong.status).toBe(403);
    expect(await wrong.json()).toMatchObject({ code: "insufficient_scope" });

    const before = await stored("sweet-pea-nimbus");
    expect(before.description).not.toBe(body.description);

    const ok = await post("/admin/varieties/sweet-pea-nimbus/description", body, { Authorization: `Bearer ${admin.token}` });
    expect(ok.status).toBe(200);
    expect((await stored("sweet-pea-nimbus")).description).toBe(body.description);
  });
});
