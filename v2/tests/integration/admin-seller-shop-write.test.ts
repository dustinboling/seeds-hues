/**
 * The seller-as-shop admin writes (migration 0018) on a throwaway D1 (Miniflare):
 * POST /api/v1/admin/sellers/:id/contact and POST /api/v1/admin/sellers/:id/locations
 * through the real route handler, each through its dedicated services.admin funnel with
 * the family's seller-write revalidation set, plus the sibling auth shape.
 *
 * Non-vacuity (T-A): fails on pre-build code — neither route, funnel, schema column,
 * nor table exists there.
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

type StoredContact = { customer_service_phone: string | null; customer_service_email: string | null };
const storedContact = async (slug: string) =>
  (await t.env.DB.prepare("SELECT customer_service_phone, customer_service_email FROM sellers WHERE slug = ?").bind(slug).first<StoredContact>())!;
const fullRow = async (slug: string) =>
  (await t.env.DB.prepare("SELECT * FROM sellers WHERE slug = ?").bind(slug).first<Record<string, unknown>>())!;
const storedLocations = async (slug: string) =>
  (
    await t.env.DB.prepare(
      "SELECT l.kind, l.street, l.city, l.state, l.zip, l.is_primary, l.source_url, l.checked_date FROM seller_locations l JOIN sellers s ON s.id = l.seller_id WHERE s.slug = ? ORDER BY l.id",
    )
      .bind(slug)
      .all<Record<string, unknown>>()
  ).results;
const diffKeys = (a: Record<string, unknown>, b: Record<string, unknown>) => Object.keys(a).filter((k) => a[k] !== b[k]);

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
  it("sellers/:id/contact and sellers/:id/locations ride the admin route table beside location", () => {
    for (const pattern of ["sellers/:id/contact", "sellers/:id/locations"]) {
      expect(ADMIN_ROUTES.find((r) => r.pattern === pattern)).toMatchObject({
        method: "POST",
        scope: "admin",
        bucket: null,
        idempotent: true,
      });
    }
  });
});

describe("migration 0018", () => {
  it("adds the two nullable contact columns and the seller_locations table — additive only", async () => {
    const cols = (await t.env.DB.prepare("PRAGMA table_info(sellers)").all<{ name: string; notnull: number }>());
    const byName = new Map(cols.results.map((c) => [c.name, c]));
    expect(byName.get("customer_service_phone")).toMatchObject({ notnull: 0 });
    expect(byName.get("customer_service_email")).toMatchObject({ notnull: 0 });
    // The private field the build must never touch is still there, untouched.
    expect(byName.get("contact_email")).toBeDefined();

    const loc = (await t.env.DB.prepare("PRAGMA table_info(seller_locations)").all<{ name: string; notnull: number }>());
    expect(loc.results.map((c) => c.name)).toEqual([
      "id",
      "seller_id",
      "kind",
      "street",
      "city",
      "state",
      "zip",
      "is_primary",
      "source_url",
      "checked_date",
      "created_at",
      "updated_at",
    ]);
    const required = new Map(loc.results.map((c) => [c.name, c.notnull]));
    expect(required.get("kind")).toBe(0);
    expect(required.get("street")).toBe(0);
    expect(required.get("zip")).toBe(0);
    expect(required.get("city")).toBe(1);
    expect(required.get("state")).toBe(1);
    expect(required.get("is_primary")).toBe(1);
  });
});

describe("route: contact set, partial update, clear", () => {
  it("POST phone + email stores both verbatim; changed names both fields", async () => {
    const admin = await s.auth.mint("shop-contact-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };

    const ok = await post(
      "/admin/sellers/songbird-seed-co/contact",
      { customer_service_phone: "(800) 555-0147", customer_service_email: "service@songbird.example" },
      auth,
    );
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { changed: string[] } }).data.changed).toEqual(["customerServicePhone", "customerServiceEmail"]);
    expect(await storedContact("songbird-seed-co")).toEqual({
      customer_service_phone: "(800) 555-0147",
      customer_service_email: "service@songbird.example",
    });

    // The handler returns the family's seller-write revalidation set.
    const spec = ADMIN_ROUTES.find((r) => r.pattern === "sellers/:id/contact")!;
    const out = await spec.handler({
      services: s,
      params: { id: "songbird-seed-co" },
      body: { customer_service_phone: "800-555-0100" },
    } as never);
    expect(out.revalidate).toContain("/seller/songbird-seed-co");
    expect(out.revalidate).toContain("/seller");
    expect(out.revalidate).toContain("/sitemap.xml");
    expect(out.revalidate!.some((p) => p.startsWith("/variety/"))).toBe(true);
  });

  it("absent leaves unchanged; present-and-null clears (the variety-color convention)", async () => {
    const admin = await s.auth.mint("shop-contact-partial-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };

    const seed = await post(
      "/admin/sellers/summertime-seed-co/contact",
      { customer_service_phone: "800-555-0111", customer_service_email: "help@summertime.example" },
      auth,
    );
    expect(seed.status).toBe(200);

    // Phone only: email stands.
    const phone = await post("/admin/sellers/summertime-seed-co/contact", { customer_service_phone: "800-555-0122" }, auth);
    expect(phone.status).toBe(200);
    expect(((await phone.json()) as { data: { changed: string[] } }).data.changed).toEqual(["customerServicePhone"]);
    expect(await storedContact("summertime-seed-co")).toEqual({
      customer_service_phone: "800-555-0122",
      customer_service_email: "help@summertime.example",
    });

    // Null clears one field; the other stands.
    const clear = await post("/admin/sellers/summertime-seed-co/contact", { customer_service_email: null }, auth);
    expect(clear.status).toBe(200);
    expect(((await clear.json()) as { data: { changed: string[] } }).data.changed).toEqual(["customerServiceEmail"]);
    expect(await storedContact("summertime-seed-co")).toEqual({ customer_service_phone: "800-555-0122", customer_service_email: null });
  });

  it("numeric ids work; malformed refs 404 like the sibling routes", async () => {
    const admin = await s.auth.mint("shop-contact-ref-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const id = (await t.env.DB.prepare("SELECT id FROM sellers WHERE slug = 'wild-west-seed'").first<{ id: number }>())!.id;

    const ok = await post(`/admin/sellers/${id}/contact`, { customer_service_phone: "800-555-0133" }, auth);
    expect(ok.status).toBe(200);
    expect(await storedContact("wild-west-seed")).toMatchObject({ customer_service_phone: "800-555-0133" });

    const bad = await post("/admin/sellers/BAD_SLUG!!/contact", { customer_service_phone: "800-555-0133" }, auth);
    expect(bad.status).toBe(404);
    expect(await bad.json()).toMatchObject({ code: "not_found" });

    const missing = await post("/admin/sellers/no-such-seller/contact", { customer_service_phone: "800-555-0133" }, auth);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "seller_not_found" });
  });
});

describe("route: contact validation", () => {
  it("missing keys, extra keys, blank/over-long phones, and bad emails are 400 with nothing written", async () => {
    const admin = await s.auth.mint("shop-contact-body-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await fullRow("half-moons-farm");
    const bodies: unknown[] = [
      {},
      { customer_service_phone: "800-555-0100", extra: 1 },
      { customer_service_phone: "" },
      { customer_service_phone: "   " },
      { customer_service_phone: "x".repeat(41) },
      { customer_service_phone: 42 },
      { customer_service_email: "not-an-email" },
      { customer_service_email: "" },
      { customer_service_email: 42 },
      { customer_service_phone: null, customer_service_email: 42 },
    ];
    for (const body of bodies) {
      const r = await post("/admin/sellers/half-moons-farm/contact", body, auth);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(await r.json()).toMatchObject({ code: "validation_error" });
    }
    expect(await fullRow("half-moons-farm")).toEqual(before);
  });

  it("the phone cap admits exactly 40 characters", async () => {
    const admin = await s.auth.mint("shop-contact-cap-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const ok = await post("/admin/sellers/half-moons-farm/contact", { customer_service_phone: "1".repeat(40) }, auth);
    expect(ok.status).toBe(200);
    expect(await storedContact("half-moons-farm")).toMatchObject({ customer_service_phone: "1".repeat(40) });
  });
});

describe("contact single-purpose proof", () => {
  it("only the two contact columns and the funnel's own audit fields differ — contact_email byte-identical", async () => {
    const admin = await s.auth.mint("shop-contact-purpose-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    await t.env.DB.prepare("UPDATE sellers SET contact_email = 'private@dawn-creek.example' WHERE slug = 'dawn-creek-farm'").run();
    const before = await fullRow("dawn-creek-farm");

    const ok = await post(
      "/admin/sellers/dawn-creek-farm/contact",
      { customer_service_phone: "800-555-0144", customer_service_email: "hello@dawn-creek.example" },
      auth,
    );
    expect(ok.status).toBe(200);

    const after = await fullRow("dawn-creek-farm");
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    expect(diffKeys(before, after).sort()).toEqual(["customer_service_email", "customer_service_phone", "updated_at", "updated_seq"]);
    expect(after.updated_seq as number).toBeGreaterThan(before.updated_seq as number);
    // The named bystanders, byte-identical — the private address above all.
    for (const k of ["name", "homepage", "contact_email", "description", "location", "region", "is_small_farm", "status"]) {
      expect(after[k], k).toBe(before[k]);
    }
    expect(after.contact_email).toBe("private@dawn-creek.example");
  });

  it("the same call twice leaves the record in the same state as once", async () => {
    const admin = await s.auth.mint("shop-contact-idem-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const body = { customer_service_phone: "800-555-0155", customer_service_email: "hello@jig-bee.example" };

    const first = await post("/admin/sellers/jig-bee-flower-farm/contact", body, auth);
    expect(first.status).toBe(200);
    expect(((await first.json()) as { data: { changed: string[] } }).data.changed).toHaveLength(2);
    const once = await fullRow("jig-bee-flower-farm");
    const seq = await s.catalog.catalogSeq();

    const second = await post("/admin/sellers/jig-bee-flower-farm/contact", body, auth);
    expect(second.status).toBe(200);
    expect(((await second.json()) as { data: { changed: string[] } }).data.changed).toEqual([]);
    expect(await fullRow("jig-bee-flower-farm")).toEqual(once);
    expect(await s.catalog.catalogSeq()).toBe(seq); // the repeat writes nothing at all
  });
});

const LOC = (overrides: Record<string, unknown> = {}) => ({
  kind: "physical",
  street: null,
  city: "Chimacum",
  state: "WA",
  zip: null,
  is_primary: true,
  source_url: "https://plantgoodseed.example/contact",
  checked_date: "2026-11-22",
  ...overrides,
});

describe("route: locations replace, clear, exactly-one-primary", () => {
  it("POST a set stores it; the response counts it; revalidation matches the family", async () => {
    const admin = await s.auth.mint("shop-loc-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };

    const ok = await post(
      "/admin/sellers/songbird-seed-co/locations",
      {
        locations: [
          LOC({ kind: "physical", city: "Chimacum", state: "WA", is_primary: true }),
          LOC({ kind: "mailing", street: "226 West Ojai Ave Ste 101-539", city: "Ojai", state: "CA", zip: "93023", is_primary: false }),
        ],
      },
      auth,
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ data: { seller: "songbird-seed-co", locations: 2, replaced: true } });
    expect(await storedLocations("songbird-seed-co")).toEqual([
      { kind: "physical", street: null, city: "Chimacum", state: "WA", zip: null, is_primary: 1, source_url: "https://plantgoodseed.example/contact", checked_date: "2026-11-22" },
      { kind: "mailing", street: "226 West Ojai Ave Ste 101-539", city: "Ojai", state: "CA", zip: "93023", is_primary: 0, source_url: "https://plantgoodseed.example/contact", checked_date: "2026-11-22" },
    ]);

    const spec = ADMIN_ROUTES.find((r) => r.pattern === "sellers/:id/locations")!;
    const out = await spec.handler({ services: s, params: { id: "songbird-seed-co" }, body: { locations: [] } } as never);
    expect(out.revalidate).toContain("/seller/songbird-seed-co");
    expect(out.revalidate).toContain("/seller");
    expect(out.revalidate).toContain("/sitemap.xml");
    expect(out.revalidate!.some((p) => p.startsWith("/variety/"))).toBe(true);
    expect(await storedLocations("songbird-seed-co")).toEqual([]); // the empty set clears
  });

  it("a second POST replaces the whole set (no orphan rows)", async () => {
    const admin = await s.auth.mint("shop-loc-replace-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const first = await post(
      "/admin/sellers/summertime-seed-co/locations",
      { locations: [LOC({ city: "Poteet", state: "TX" }), LOC({ kind: "warehouse", city: "Ojai", state: "CA", is_primary: false })] },
      auth,
    );
    expect(first.status).toBe(200);

    const second = await post("/admin/sellers/summertime-seed-co/locations", { locations: [LOC({ city: "Alburgh", state: "VT" })] }, auth);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ data: { locations: 1, replaced: true } });
    expect(await storedLocations("summertime-seed-co")).toEqual([
      { kind: "physical", street: null, city: "Alburgh", state: "VT", zip: null, is_primary: 1, source_url: "https://plantgoodseed.example/contact", checked_date: "2026-11-22" },
    ]);
  });

  it("zero or two primaries in a non-empty set is a 400 with nothing written", async () => {
    const admin = await s.auth.mint("shop-loc-primary-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const seed = await post("/admin/sellers/blomma-flower-farm/locations", { locations: [LOC({ city: "Reno", state: "NV" })] }, auth);
    expect(seed.status).toBe(200);
    const before = await storedLocations("blomma-flower-farm");

    for (const locations of [
      [LOC({ is_primary: false })],
      [LOC({}), LOC({ city: "Ojai", state: "CA" })],
      [LOC({ is_primary: false }), LOC({ city: "Ojai", state: "CA", is_primary: false })],
    ]) {
      const r = await post("/admin/sellers/blomma-flower-farm/locations", { locations }, auth);
      expect(r.status, JSON.stringify(locations)).toBe(400);
      expect(await r.json()).toMatchObject({ code: "validation_error" });
    }
    expect(await storedLocations("blomma-flower-farm")).toEqual(before);
  });

  it("a null kind stores (undetermined) but a null-kind-only additional still counts as a set row", async () => {
    const admin = await s.auth.mint("shop-loc-nullkind-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const ok = await post(
      "/admin/sellers/peace-seedlings/locations",
      { locations: [LOC({ city: "Portland", state: "OR" }), LOC({ kind: null, city: "Seattle", state: "WA", is_primary: false })] },
      auth,
    );
    expect(ok.status).toBe(200);
    expect(await storedLocations("peace-seedlings")).toHaveLength(2);
    expect((await storedLocations("peace-seedlings"))[1]).toMatchObject({ kind: null, city: "Seattle" });
  });

  it("unknown sellers 404; malformed refs 404", async () => {
    const admin = await s.auth.mint("shop-loc-ref-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const missing = await post("/admin/sellers/no-such-seller/locations", { locations: [] }, auth);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "seller_not_found" });
    const bad = await post("/admin/sellers/BAD_SLUG!!/locations", { locations: [] }, auth);
    expect(bad.status).toBe(404);
    expect(await bad.json()).toMatchObject({ code: "not_found" });
  });
});

describe("route: locations validation", () => {
  it("bad kinds, missing city/state, non-USPS states, and missing provenance are 400 with nothing written", async () => {
    const admin = await s.auth.mint("shop-loc-body-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await storedLocations("half-moons-farm");
    const bad: unknown[] = [
      { locations: [{ ...LOC(), kind: "sister-store" }] },
      { locations: [{ ...LOC(), kind: undefined }] },
      { locations: [{ ...LOC(), city: "" }] },
      { locations: [{ ...LOC(), city: "   " }] },
      { locations: [{ ...LOC(), state: "XX" }] },
      { locations: [{ ...LOC(), state: "ca" }] },
      { locations: [{ ...LOC(), state: "California" }] },
      { locations: [{ ...LOC(), street: "" }] },
      { locations: [{ ...LOC(), source_url: "not-a-url" }] },
      { locations: [{ ...LOC(), checked_date: "11/22/2026" }] },
      { locations: [{ ...LOC(), is_primary: "yes" }] },
      { locations: [{ ...LOC(), extra: 1 }] },
      {},
      { locations: "Chimacum, WA" },
    ];
    for (const body of bad) {
      const r = await post("/admin/sellers/half-moons-farm/locations", body, auth);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(await r.json()).toMatchObject({ code: "validation_error" });
    }
    expect(await storedLocations("half-moons-farm")).toEqual(before);
  });

  it("re-applying the stored set writes nothing (replaced: false, seq unchanged)", async () => {
    const admin = await s.auth.mint("shop-loc-idem-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const body = { locations: [LOC({ city: "Independence", state: "OR" }), LOC({ kind: "mailing", city: "Ojai", state: "CA", zip: "93023", is_primary: false })] };

    const first = await post("/admin/sellers/jig-bee-flower-farm/locations", body, auth);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ data: { replaced: true } });
    const once = await storedLocations("jig-bee-flower-farm");
    const seq = await s.catalog.catalogSeq();

    const second = await post("/admin/sellers/jig-bee-flower-farm/locations", body, auth);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ data: { replaced: false } });
    expect(await storedLocations("jig-bee-flower-farm")).toEqual(once);
    expect(await s.catalog.catalogSeq()).toBe(seq);
  });
});

describe("auth", () => {
  it("401 without a key, 403 with the wrong scope, 200 with an admin key — on both routes", async () => {
    const ingest = await s.auth.mint("shop-ingest", ["ingest"]);
    const admin = await s.auth.mint("shop-auth-admin", ["admin"]);
    const cases: [string, unknown][] = [
      ["/admin/sellers/peace-seedlings/contact", { customer_service_phone: "800-555-0100" }],
      ["/admin/sellers/peace-seedlings/locations", { locations: [] }],
    ];
    for (const [path, body] of cases) {
      const none = await post(path, body);
      expect(none.status, path).toBe(401);
      expect(await none.json()).toMatchObject({ code: "unauthorized" });

      const wrong = await post(path, body, { Authorization: `Bearer ${ingest.token}` });
      expect(wrong.status, path).toBe(403);
      expect(await wrong.json()).toMatchObject({ code: "insufficient_scope" });

      const ok = await post(path, body, { Authorization: `Bearer ${admin.token}` });
      expect(ok.status, path).toBe(200);
    }
    expect(await storedContact("peace-seedlings")).toMatchObject({ customer_service_phone: "800-555-0100" });
  });
});
