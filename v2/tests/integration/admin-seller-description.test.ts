/**
 * The key-authenticated seller-description write (audit 2026-11-21 C1 + C2) on a
 * throwaway D1 (Miniflare): POST /api/v1/admin/sellers/:id/description through the
 * real route handler, the publication guard on the shared sellerUpdate funnel (both
 * the key route and the admin UI reject flagged text), and the sibling auth shape.
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
const ADMIN = { role: "admin", decider: { userId: 102, name: "Ann Admin" } };

type Handler = (req: Request, c: { params: Promise<Record<string, string | string[] | undefined>> }) => Promise<Response>;
function call(h: Handler, path: string, init: RequestInit = {}) {
  return h(new Request(`${BASE}${path}`, init), { params: Promise.resolve({}) });
}
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  call(adminRoute.POST as Handler, path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

const stored = async (slug: string) =>
  (await t.env.DB.prepare("SELECT description, updated_at FROM sellers WHERE slug = ?").bind(slug).first<{ description: string | null; updated_at: string }>())!;

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
  it("sellers/:id/description rides the admin route table beside small-farm", () => {
    expect(ADMIN_ROUTES.find((r) => r.pattern === "sellers/:id/description")).toMatchObject({
      method: "POST",
      scope: "admin",
      bucket: null,
      idempotent: true,
    });
  });
});

describe("route: clean set + clear", () => {
  it("POST a clean description sets it; changed names description; null clears", async () => {
    const admin = await s.auth.mint("desc-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const text = "Clean About copy for the key-route probe.";

    const ok = await post("/admin/sellers/floret/description", { description: text }, auth);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { changed: string[] } }).data.changed).toContain("description");
    expect((await stored("floret")).description).toBe(text);

    // The handler returns the sellerUpdate revalidation set (a UI edit's set).
    const spec = ADMIN_ROUTES.find((r) => r.pattern === "sellers/:id/description")!;
    const out = await spec.handler({ services: s, params: { id: "floret" }, body: { description: `${text} Second save.` } } as never);
    expect((out.data as { changed: string[] }).changed).toContain("description");
    expect(out.revalidate).toContain("/seller/floret");
    expect(out.revalidate!.some((p) => p.startsWith("/variety/"))).toBe(true);
    expect((await stored("floret")).description).toBe(`${text} Second save.`);

    const cleared = await post("/admin/sellers/floret/description", { description: null }, auth);
    expect(cleared.status).toBe(200);
    expect((await stored("floret")).description).toBeNull();
  });

  it("numeric ids work; malformed refs 404 like the sibling routes", async () => {
    const admin = await s.auth.mint("desc-ref-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const id = (await t.env.DB.prepare("SELECT id FROM sellers WHERE slug = 'songbird-seed-co'").first<{ id: number }>())!.id;
    const ok = await post(`/admin/sellers/${id}/description`, { description: "Numeric-ref probe copy." }, auth);
    expect(ok.status).toBe(200);
    expect((await stored("songbird-seed-co")).description).toBe("Numeric-ref probe copy.");

    const bad = await post("/admin/sellers/BAD_SLUG!!/description", { description: "x" }, auth);
    expect(bad.status).toBe(404);
    expect(await bad.json()).toMatchObject({ code: "not_found" });

    const missing = await post("/admin/sellers/no-such-seller/description", { description: "x" }, auth);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "seller_not_found" });
  });

  it("the body is strict: missing, extra, or over-long descriptions are 400 with nothing written", async () => {
    const admin = await s.auth.mint("desc-body-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("half-moons-farm");
    for (const body of [{}, { description: "x", extra: 1 }, { description: "x".repeat(2001) }]) {
      const r = await post("/admin/sellers/half-moons-farm/description", body, auth);
      expect(r.status).toBe(400);
      expect(await r.json()).toMatchObject({ code: "validation_error" });
    }
    expect(await stored("half-moons-farm")).toEqual(before);
  });
});

describe("guard positives via the route", () => {
  it("each flagged text is 422 and leaves the stored description byte-identical", async () => {
    const admin = await s.auth.mint("desc-guard-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("dawn-creek-farm");
    const flagged = [
      "Anchor: Basil 'Cinnamon' — $4.65 packet, verified 2026-11-19",
      "Packets are $4.65 each.",
      "Badge: NO — leave OFF pending Hue review",
      "Feed: none — products.json returned 404",
    ];
    for (const description of flagged) {
      const r = await post("/admin/sellers/dawn-creek-farm/description", { description }, auth);
      expect(r.status, description).toBe(422);
      const problem = (await r.json()) as { code: string; detail: string };
      expect(problem.code).toBe("description_rejected");
      // The detail names the violation classes, never the submitted text.
      expect(problem.detail).toMatch(/price|internal_marker/);
      expect(problem.detail).not.toContain(description);
    }
    const after = await stored("dawn-creek-farm");
    expect(after.description).toBe(before.description);
    expect(after.updated_at).toBe(before.updated_at);
  });
});

describe("guard negatives via the route", () => {
  it("ordinary copy, a mid-sentence note, and dollars with no amount are accepted", async () => {
    const admin = await s.auth.mint("desc-clean-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    for (const description of [
      "Hudson Valley grows open-pollinated seed on its farm in Accord, New York.",
      "Please note our shipping schedule changes in winter.",
      "We accept dollars at the farm stand.",
    ]) {
      const r = await post("/admin/sellers/hudson-valley-seed-co/description", { description }, auth);
      expect(r.status, description).toBe(200);
      expect((await stored("hudson-valley-seed-co")).description).toBe(description);
    }
  });
});

describe("service level: the shared funnel", () => {
  it("sellerUpdate throws on flagged text and writes nothing; null and absent pass", async () => {
    const before = await stored("3-porch-farm");
    await expect(s.admin.sellerUpdate("3-porch-farm", { description: "Packets are $4.65 each." })).rejects.toMatchObject({
      status: 422,
      code: "description_rejected",
    });
    // The admin-UI path funnels through the same sellerUpdate.
    await expect(s.adminSellers.updateSeller("3-porch-farm", { description: "Badge: NO — leave OFF pending Hue review" }, ADMIN)).rejects.toMatchObject({
      status: 422,
      code: "description_rejected",
    });
    expect(await stored("3-porch-farm")).toEqual(before);

    const cleared = await s.admin.sellerUpdate("3-porch-farm", { description: null });
    expect(cleared.data.changed).toContain("description");
    expect((await stored("3-porch-farm")).description).toBeNull();
    const untouched = await s.admin.sellerUpdate("3-porch-farm", {});
    expect(untouched.data.changed).not.toContain("description");
  });
});

describe("auth", () => {
  it("401 without a key, 403 with the wrong scope, 200 with an admin key", async () => {
    const ingest = await s.auth.mint("desc-ingest", ["ingest"]);
    const admin = await s.auth.mint("desc-auth-admin", ["admin"]);
    const body = { description: "Auth probe copy." };

    const none = await post("/admin/sellers/blomma-flower-farm/description", body);
    expect(none.status).toBe(401);
    expect(none.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await none.json()).toMatchObject({ code: "unauthorized" });

    const wrong = await post("/admin/sellers/blomma-flower-farm/description", body, { Authorization: `Bearer ${ingest.token}` });
    expect(wrong.status).toBe(403);
    expect(await wrong.json()).toMatchObject({ code: "insufficient_scope" });

    const before = await stored("blomma-flower-farm");
    expect(before.description).not.toBe(body.description);

    const ok = await post("/admin/sellers/blomma-flower-farm/description", body, { Authorization: `Bearer ${admin.token}` });
    expect(ok.status).toBe(200);
    expect((await stored("blomma-flower-farm")).description).toBe(body.description);
  });
});
