/**
 * The key-authenticated seller-location write (seller sweep 2026-11-22) on a
 * throwaway D1 (Miniflare): POST /api/v1/admin/sellers/:id/location through the
 * real route handler, location plus its derived region through the shared
 * sellerUpdate funnel (the changed list and revalidation match a UI edit exactly),
 * and the sibling auth shape.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Services } from "@/lib/services";
import type { RuntimeEnv } from "@/lib/api/runtime-env";

const ctx = vi.hoisted(() => ({ services: null as unknown, env: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => ctx.env }));

import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import { regionForLocation } from "@/lib/services/admin";
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

type StoredLocation = { location: string | null; region: string | null; updated_at: string; updated_seq: number };
const stored = async (slug: string) =>
  (await t.env.DB.prepare("SELECT location, region, updated_at, updated_seq FROM sellers WHERE slug = ?").bind(slug).first<StoredLocation>())!;
const fullRow = async (slug: string) =>
  (await t.env.DB.prepare("SELECT * FROM sellers WHERE slug = ?").bind(slug).first<Record<string, unknown>>())!;
const visibleListingCount = async (slug: string) =>
  (
    await t.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM listings l JOIN sellers s ON s.id = l.seller_id WHERE s.slug = ? AND l.status IN ('active', 'published') AND l.deleted_at IS NULL",
    )
      .bind(slug)
      .first<{ n: number }>()
  )!.n;
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
  it("sellers/:id/location rides the admin route table beside description", () => {
    expect(ADMIN_ROUTES.find((r) => r.pattern === "sellers/:id/location")).toMatchObject({
      method: "POST",
      scope: "admin",
      bucket: null,
      idempotent: true,
    });
  });
});

describe("route: location set + derived region", () => {
  it("POST a location sets it and derives the region; changed names both fields", async () => {
    const admin = await s.auth.mint("loc-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };

    const ok = await post("/admin/sellers/songbird-seed-co/location", { location: "Poteet, TX" }, auth);
    expect(ok.status).toBe(200);
    const changed = ((await ok.json()) as { data: { changed: string[] } }).data.changed;
    expect(changed).toContain("location");
    expect(changed).toContain("region");
    expect(changed).toHaveLength(2);
    expect(await stored("songbird-seed-co")).toMatchObject({ location: "Poteet, TX", region: "TX" });

    // The handler returns the sellerUpdate revalidation set (a UI edit's set).
    expect(await visibleListingCount("songbird-seed-co")).toBeGreaterThan(0);
    const spec = ADMIN_ROUTES.find((r) => r.pattern === "sellers/:id/location")!;
    const out = await spec.handler({ services: s, params: { id: "songbird-seed-co" }, body: { location: "Nashville, TN" } } as never);
    expect((out.data as { changed: string[] }).changed).toContain("location");
    expect(out.revalidate).toContain("/seller/songbird-seed-co");
    expect(out.revalidate!.some((p) => p.startsWith("/variety/"))).toBe(true);
    expect(await stored("songbird-seed-co")).toMatchObject({ location: "Nashville, TN", region: "TN" });
  });

  it("the stored location is trimmed", async () => {
    const admin = await s.auth.mint("loc-trim-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };

    const ok = await post("/admin/sellers/summertime-seed-co/location", { location: "  Poteet, TX  " }, auth);
    expect(ok.status).toBe(200);
    expect(await stored("summertime-seed-co")).toMatchObject({ location: "Poteet, TX", region: "TX" });
  });

  it("numeric ids work; malformed refs 404 like the sibling routes", async () => {
    const admin = await s.auth.mint("loc-ref-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const id = (await t.env.DB.prepare("SELECT id FROM sellers WHERE slug = 'wild-west-seed'").first<{ id: number }>())!.id;
    const ok = await post(`/admin/sellers/${id}/location`, { location: "Independence, OR" }, auth);
    expect(ok.status).toBe(200);
    const changed = ((await ok.json()) as { data: { changed: string[] } }).data.changed;
    expect(changed).toContain("location");
    expect(changed).not.toContain("region"); // already OR: the funnel diffs, so nothing to change
    expect(await stored("wild-west-seed")).toMatchObject({ location: "Independence, OR", region: "OR" });

    const bad = await post("/admin/sellers/BAD_SLUG!!/location", { location: "Poteet, TX" }, auth);
    expect(bad.status).toBe(404);
    expect(await bad.json()).toMatchObject({ code: "not_found" });

    const missing = await post("/admin/sellers/no-such-seller/location", { location: "Poteet, TX" }, auth);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "seller_not_found" });
  });

  it("a location naming no state updates location alone; the region is never invented", async () => {
    const admin = await s.auth.mint("loc-nostate-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    expect((await stored("blomma-flower-farm")).region).toBe("NV");

    const ok = await post("/admin/sellers/blomma-flower-farm/location", { location: "United States" }, auth);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { changed: string[] } }).data.changed).toEqual(["location"]);
    expect(await stored("blomma-flower-farm")).toMatchObject({ location: "United States", region: "NV" });
  });
});

describe("route validation", () => {
  it("missing, extra, non-string, blank, and over-length locations are 400 with nothing written", async () => {
    const admin = await s.auth.mint("loc-body-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await fullRow("half-moons-farm");
    for (const body of [{}, { location: "Poteet, TX", extra: 1 }, { location: 42 }, { location: null }, { location: "" }, { location: "   " }, { location: "x".repeat(201) }]) {
      const r = await post("/admin/sellers/half-moons-farm/location", body, auth);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(await r.json()).toMatchObject({ code: "validation_error" });
    }
    expect(await fullRow("half-moons-farm")).toEqual(before);
  });

  it("the length cap admits exactly 200 characters", async () => {
    const admin = await s.auth.mint("loc-cap-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const ok = await post("/admin/sellers/half-moons-farm/location", { location: "y".repeat(200) }, auth);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { changed: string[] } }).data.changed).toEqual(["location"]);
    expect(await stored("half-moons-farm")).toMatchObject({ location: "y".repeat(200), region: "WA" });
  });
});

describe("single-purpose proof", () => {
  it("only location, region, and the funnel's own audit fields differ", async () => {
    const admin = await s.auth.mint("loc-purpose-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await fullRow("dawn-creek-farm");

    const ok = await post("/admin/sellers/dawn-creek-farm/location", { location: "Alburgh, VT" }, auth);
    expect(ok.status).toBe(200);

    const after = await fullRow("dawn-creek-farm");
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    expect(diffKeys(before, after).sort()).toEqual(["location", "region", "updated_at", "updated_seq"]);
    expect(after.location).toBe("Alburgh, VT");
    expect(after.region).toBe("VT");
    expect(after.updated_seq as number).toBeGreaterThan(before.updated_seq as number);
    // The named bystanders, byte-identical.
    for (const k of ["name", "homepage", "contact_email", "description", "is_small_farm", "status"]) expect(after[k]).toBe(before[k]);
  });

  it("a stateless location leaves the region byte-identical in the full row", async () => {
    const admin = await s.auth.mint("loc-purpose2-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await fullRow("sunflower-selections");

    const ok = await post("/admin/sellers/sunflower-selections/location", { location: "United States" }, auth);
    expect(ok.status).toBe(200);

    const after = await fullRow("sunflower-selections");
    expect(diffKeys(before, after).sort()).toEqual(["location", "updated_at", "updated_seq"]);
    expect(after.region).toBe(before.region);
  });
});

describe("idempotency", () => {
  it("the same call twice leaves the record in the same state as once", async () => {
    const admin = await s.auth.mint("loc-idem-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const body = { location: "Independence, OR" };

    const first = await post("/admin/sellers/jig-bee-flower-farm/location", body, auth);
    expect(first.status).toBe(200);
    expect(((await first.json()) as { data: { changed: string[] } }).data.changed).toHaveLength(2);
    const once = await fullRow("jig-bee-flower-farm");
    const seq = await s.catalog.catalogSeq();

    const second = await post("/admin/sellers/jig-bee-flower-farm/location", body, auth);
    expect(second.status).toBe(200);
    expect(((await second.json()) as { data: { changed: string[] } }).data.changed).toEqual([]);
    expect(await fullRow("jig-bee-flower-farm")).toEqual(once);
    expect(await s.catalog.catalogSeq()).toBe(seq); // the repeat writes nothing at all
  });
});

describe("region derivation", () => {
  it("maps trailing codes, trailing names, and whole values — and nothing else", () => {
    const cases: [string, string | null][] = [
      ["Mount Vernon, WA", "WA"],
      ["Poteet, TX", "TX"],
      ["Nashville, TN", "TN"],
      ["Alburgh, VT", "VT"],
      ["Independence, OR", "OR"],
      ["Vermont", "VT"],
      ["Willamette Valley, OR", "OR"],
      ["United States", null],
      ["WA", "WA"],
      ["Washington", "WA"],
      ["Burlington, Vermont", "VT"],
      ["Mount Vernon, wa", "WA"],
      ["  Vermont  ", "VT"],
      ["Northern Georgia", null],
      ["Washington, DC", null],
      ["Austin, TX 78701", null],
    ];
    for (const [input, expected] of cases) expect(regionForLocation(input), input).toBe(expected);
  });

  it("a seller filed under the wrong state is refiled by one call", async () => {
    const admin = await s.auth.mint("loc-refile-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    await t.env.DB.prepare("UPDATE sellers SET location = 'Salt Lake City, UT', region = 'UT' WHERE slug = 'great-basin-seed'").run();
    expect(await stored("great-basin-seed")).toMatchObject({ location: "Salt Lake City, UT", region: "UT" });

    const ok = await post("/admin/sellers/great-basin-seed/location", { location: "Mount Vernon, WA" }, auth);
    expect(ok.status).toBe(200);
    expect(await stored("great-basin-seed")).toMatchObject({ location: "Mount Vernon, WA", region: "WA" });
  });
});

describe("auth", () => {
  it("401 without a key, 403 with the wrong scope, 401 with a malformed key, 200 with an admin key", async () => {
    const ingest = await s.auth.mint("loc-ingest", ["ingest"]);
    const admin = await s.auth.mint("loc-auth-admin", ["admin"]);
    const body = { location: "Poteet, TX" };
    const before = await fullRow("peace-seedlings");

    const none = await post("/admin/sellers/peace-seedlings/location", body);
    expect(none.status).toBe(401);
    expect(none.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await none.json()).toMatchObject({ code: "unauthorized" });

    const wrong = await post("/admin/sellers/peace-seedlings/location", body, { Authorization: `Bearer ${ingest.token}` });
    expect(wrong.status).toBe(403);
    expect(await wrong.json()).toMatchObject({ code: "insufficient_scope" });

    for (const malformed of ["bogus", "!!!not-a-key!!!"]) {
      const r = await post("/admin/sellers/peace-seedlings/location", body, { Authorization: `Bearer ${malformed}` });
      expect(r.status, malformed).toBe(401);
      expect(await r.json()).toMatchObject({ code: "unauthorized" });
    }
    expect(await fullRow("peace-seedlings")).toEqual(before); // every refusal writes nothing

    const ok = await post("/admin/sellers/peace-seedlings/location", body, { Authorization: `Bearer ${admin.token}` });
    expect(ok.status).toBe(200);
    expect(await stored("peace-seedlings")).toMatchObject({ location: "Poteet, TX", region: "TX" });
  });
});
