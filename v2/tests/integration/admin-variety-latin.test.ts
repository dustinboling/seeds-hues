/**
 * The key-authenticated variety Latin override write (migration 0017) on a throwaway D1
 * (Miniflare): POST /api/v1/admin/varieties/:id/latin through the real route handler —
 * set with read-back verification (the Tranche 1.1 pattern) through the stored row AND the
 * public catalog service, the read-preference trio (variety wins / plant fallback / neither
 * → absent), idempotent re-set, null clears, empty clears (the brief's divergence from the
 * description rule), and the sibling auth shape.
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

type StoredLatin = { latin_name: string | null; updated_at: string; updated_seq: number };
const stored = async (slug: string) =>
  (await t.env.DB.prepare("SELECT latin_name, updated_at, updated_seq FROM varieties WHERE slug = ?").bind(slug).first<StoredLatin>())!;
const plantOf = async (slug: string) =>
  (await t.env.DB.prepare("SELECT p.slug AS slug FROM varieties v JOIN plants p ON p.id = v.plant_id WHERE v.slug = ?").bind(slug).first<{ slug: string }>())!.slug;
const plantLatin = async (plantSlug: string) =>
  (await t.env.DB.prepare("SELECT latin_name FROM plants WHERE slug = ?").bind(plantSlug).first<{ latin_name: string | null }>())!.latin_name;

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
  it("varieties/:id/latin rides the admin route table beside the description route", () => {
    expect(ADMIN_ROUTES.find((r) => r.pattern === "varieties/:id/latin")).toMatchObject({
      method: "POST",
      scope: "admin",
      bucket: null,
      idempotent: true,
    });
  });
});

describe("route: set with read-back", () => {
  it("POST a Latin name sets the override; changed names latin_name; the catalog sequence advances", async () => {
    const admin = await s.auth.mint("latin-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const latin = "Lathyrus odoratus var. probe";
    expect((await stored("sweet-pea-emma")).latin_name).toBeNull();
    const seqBefore = await s.catalog.catalogSeq();

    const r = await post("/admin/varieties/sweet-pea-emma/latin", { latin_name: latin }, auth);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { data: { variety: string; id: number; changed: string[] } };
    expect(body.data.variety).toBe("sweet-pea-emma");
    expect(body.data.changed).toEqual(["latin_name"]);
    expect((await stored("sweet-pea-emma")).latin_name).toBe(latin);
    expect(await s.catalog.catalogSeq()).toBeGreaterThan(seqBefore);

    // Read-back through the public service agrees on every variety-context surface: the
    // detail row (variety page facts + header), the summary row (browse cards), the
    // listing rows (shop product cards), and the templated description.
    const v = (await s.catalog.getVariety("sweet-pea-emma"))!;
    expect(v.plant.latinName).toBe(latin);
    expect(v.templateDescription).toContain(`(${latin})`);
    const { items } = await s.catalog.listVarieties({ filters: { ids: [body.data.id] }, page: { offset: 0, limit: 1 } });
    expect(items[0]!.plant.latinName).toBe(latin);
    expect(v.listings.length).toBeGreaterThan(0);
    for (const l of v.listings) expect(l.variety.plant.latinName).toBe(latin);
  });

  it("the variety wins while its siblings and the plant row keep the plant Latin", async () => {
    const admin = await s.auth.mint("latin-wins-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    expect(await plantLatin("nigella")).toBe("Nigella damascena");

    const r = await post("/admin/varieties/nigella-delft-blue/latin", { latin_name: "Nigella probe-species" }, auth);
    expect(r.status).toBe(200);
    expect((await s.catalog.getVariety("nigella-delft-blue"))!.plant.latinName).toBe("Nigella probe-species");
    // A sibling variety still reads the plant fallback, and the plant row is untouched.
    expect((await s.catalog.getVariety("nigella-african-bride"))!.plant.latinName).toBe("Nigella damascena");
    expect(await plantLatin("nigella")).toBe("Nigella damascena");
  });

  it("setting the same value again reports no change and writes nothing", async () => {
    const admin = await s.auth.mint("latin-idempotent-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const latin = "Lathyrus odoratus var. reset";

    const first = await post("/admin/varieties/sweet-pea-oban-bay/latin", { latin_name: latin }, auth);
    expect(first.status).toBe(200);
    expect(((await first.json()) as { data: { changed: string[] } }).data.changed).toEqual(["latin_name"]);
    const afterFirst = await stored("sweet-pea-oban-bay");

    const second = await post("/admin/varieties/sweet-pea-oban-bay/latin", { latin_name: latin }, auth);
    expect(second.status).toBe(200);
    expect(((await second.json()) as { data: { changed: string[] } }).data.changed).toEqual([]);
    expect(await stored("sweet-pea-oban-bay")).toEqual(afterFirst);
  });

  it("POST null clears the override to NULL and the plant fallback reads back", async () => {
    const admin = await s.auth.mint("latin-clear-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const set = await post("/admin/varieties/sweet-pea-mollie-rilstone/latin", { latin_name: "Lathyrus odoratus var. clear" }, auth);
    expect(set.status).toBe(200);

    const r = await post("/admin/varieties/sweet-pea-mollie-rilstone/latin", { latin_name: null }, auth);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { changed: string[] } }).data.changed).toEqual(["latin_name"]);
    expect((await stored("sweet-pea-mollie-rilstone")).latin_name).toBeNull();

    // Read-back through the public service agrees: the plant fallback, not the override.
    const v = (await s.catalog.getVariety("sweet-pea-mollie-rilstone"))!;
    expect(v.plant.latinName).toBe("Lathyrus odoratus");
  });

  it("an empty or blank string clears too — never stored, never a validation error", async () => {
    const admin = await s.auth.mint("latin-empty-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    expect(await post("/admin/varieties/sweet-pea-nimbus/latin", { latin_name: "Lathyrus odoratus var. empty" }, auth)).toMatchObject({ status: 200 });

    const empty = await post("/admin/varieties/sweet-pea-nimbus/latin", { latin_name: "" }, auth);
    expect(empty.status).toBe(200);
    expect(((await empty.json()) as { data: { changed: string[] } }).data.changed).toEqual(["latin_name"]);
    expect((await stored("sweet-pea-nimbus")).latin_name).toBeNull();

    expect(await post("/admin/varieties/sweet-pea-nimbus/latin", { latin_name: "Lathyrus odoratus var. blank" }, auth)).toMatchObject({ status: 200 });
    const blank = await post("/admin/varieties/sweet-pea-nimbus/latin", { latin_name: "   " }, auth);
    expect(blank.status).toBe(200);
    expect((await stored("sweet-pea-nimbus")).latin_name).toBeNull();
    expect((await s.catalog.getVariety("sweet-pea-nimbus"))!.plant.latinName).toBe("Lathyrus odoratus");
  });

  it("neither set → absent: a NULL-Latin crop with no override reads null, never a placeholder", async () => {
    const admin = await s.auth.mint("latin-absent-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    expect(await plantLatin("cress")).toBeNull();
    // A pristine Cress variety carries no Latin anywhere.
    expect((await s.catalog.getVariety("cress-emerald-beads"))!.plant.latinName).toBeNull();

    // Through the mechanism: set the override, then clear it — absent again, not the plant's
    // (there is none) and not a placeholder.
    expect(await post("/admin/varieties/cress-green-dragon/latin", { latin_name: "Lepidium probe-species" }, auth)).toMatchObject({ status: 200 });
    expect((await s.catalog.getVariety("cress-green-dragon"))!.plant.latinName).toBe("Lepidium probe-species");
    expect(await post("/admin/varieties/cress-green-dragon/latin", { latin_name: null }, auth)).toMatchObject({ status: 200 });
    const v = (await s.catalog.getVariety("cress-green-dragon"))!;
    expect(v.plant.latinName).toBeNull();
    expect(v.templateDescription).not.toContain("(");
  });

  it("the revalidate set is exactly the description funnel's three paths", async () => {
    const slug = "sweet-pea-blue-shift";
    const spec = ADMIN_ROUTES.find((r) => r.pattern === "varieties/:id/latin")!;
    const out = await spec.handler({ services: s, params: { id: slug }, body: { latin_name: "Lathyrus odoratus var. revalidate" } } as never);
    expect((out.data as { changed: string[] }).changed).toEqual(["latin_name"]);
    expect(out.revalidate).toEqual([`/variety/${slug}`, `/crop/${await plantOf(slug)}`, "/variety"]);
  });

  it("numeric ids work; malformed refs 404 like the sibling routes", async () => {
    const admin = await s.auth.mint("latin-ref-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const id = (await t.env.DB.prepare("SELECT id FROM varieties WHERE slug = 'sweet-pea-raspberry-flake'").first<{ id: number }>())!.id;
    const ok = await post(`/admin/varieties/${id}/latin`, { latin_name: "Lathyrus odoratus var. numeric" }, auth);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { id: number; changed: string[] } }).data.id).toBe(id);
    expect((await stored("sweet-pea-raspberry-flake")).latin_name).toBe("Lathyrus odoratus var. numeric");

    const bad = await post("/admin/varieties/BAD_SLUG!!/latin", { latin_name: "x" }, auth);
    expect(bad.status).toBe(404);
    expect(await bad.json()).toMatchObject({ code: "not_found" });

    const missing = await post("/admin/varieties/no-such-variety/latin", { latin_name: "x" }, auth);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "variety_not_found" });
  });
});

describe("route validation", () => {
  it("the body is strict: missing, extra, over-long, or mistyped latin_names are 400 with nothing written", async () => {
    const admin = await s.auth.mint("latin-body-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("sweet-pea-spring-sunshine-burgundy");
    for (const body of [{}, { latin_name: "x", extra: 1 }, { latin_name: "x".repeat(201) }, { latin_name: 42 }, { latin_name: { text: "x" } }]) {
      const r = await post("/admin/varieties/sweet-pea-spring-sunshine-burgundy/latin", body, auth);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(await r.json()).toMatchObject({ code: "validation_error" });
    }
    expect(await stored("sweet-pea-spring-sunshine-burgundy")).toEqual(before);
  });
});

describe("service level: the shared funnel", () => {
  it("varietyLatinUpdate resolves slugs and ids, and 404s unknown refs", async () => {
    const bySlug = await s.admin.varietyLatinUpdate("sweet-pea-juliet", { latin_name: "Lathyrus odoratus var. funnel" });
    expect(bySlug.data.changed).toEqual(["latin_name"]);
    expect(bySlug.revalidate).toEqual(["/variety/sweet-pea-juliet", `/crop/${await plantOf("sweet-pea-juliet")}`, "/variety"]);
    const id = (await t.env.DB.prepare("SELECT id FROM varieties WHERE slug = 'sweet-pea-juliet'").first<{ id: number }>())!.id;
    const byId = await s.admin.varietyLatinUpdate(String(id), { latin_name: null });
    expect(byId.data.changed).toEqual(["latin_name"]);
    expect((await stored("sweet-pea-juliet")).latin_name).toBeNull();
    await expect(s.admin.varietyLatinUpdate("no-such-variety", { latin_name: "x" })).rejects.toMatchObject({
      status: 404,
      code: "variety_not_found",
    });
  });
});

describe("auth", () => {
  it("401 without a key, 403 with the wrong scope, 200 with an admin key", async () => {
    const ingest = await s.auth.mint("latin-ingest", ["ingest"]);
    const admin = await s.auth.mint("latin-auth-admin", ["admin"]);
    const body = { latin_name: "Lathyrus odoratus var. auth" };

    const none = await post("/admin/varieties/sweet-pea-kings-ransom/latin", body);
    expect(none.status).toBe(401);
    expect(none.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await none.json()).toMatchObject({ code: "unauthorized" });

    const wrong = await post("/admin/varieties/sweet-pea-kings-ransom/latin", body, { Authorization: `Bearer ${ingest.token}` });
    expect(wrong.status).toBe(403);
    expect(await wrong.json()).toMatchObject({ code: "insufficient_scope" });

    const before = await stored("sweet-pea-kings-ransom");
    expect(before.latin_name).not.toBe(body.latin_name);

    const ok = await post("/admin/varieties/sweet-pea-kings-ransom/latin", body, { Authorization: `Bearer ${admin.token}` });
    expect(ok.status).toBe(200);
    expect((await stored("sweet-pea-kings-ransom")).latin_name).toBe(body.latin_name);
  });
});
