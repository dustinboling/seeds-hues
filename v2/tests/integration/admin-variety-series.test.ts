/**
 * The key-authenticated variety series write on a throwaway D1 (Miniflare):
 * POST /api/v1/admin/varieties/:id/series through the real route handler — the Chantilly
 * snapdragon assignment with its scope fence (only the Chantilly records change, exactly
 * one series row is created, a non-Chantilly snapdragon carries none), /search's Series
 * group and the series detail page reading back, idempotent re-set, null clears, blank
 * rejected (the description rule), slug-conflict 409, and the sibling auth shape.
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

type StoredSeries = { series_id: number | null; updated_at: string; updated_seq: number };
const stored = async (slug: string) =>
  (await t.env.DB.prepare("SELECT series_id, updated_at, updated_seq FROM varieties WHERE slug = ?").bind(slug).first<StoredSeries>())!;
const seriesCount = async () => (await t.env.DB.prepare("SELECT COUNT(*) AS n FROM series").first<{ n: number }>())!.n;
const chantillyRows = async () =>
  (await t.env.DB.prepare("SELECT s.slug AS slug, s.name AS name, p.slug AS plant FROM series s JOIN plants p ON p.id = s.plant_id WHERE s.name = 'Chantilly'").all<{
    slug: string;
    name: string;
    plant: string;
  }>())!.results;
const allSeriesIds = async () =>
  new Map(
    (await t.env.DB.prepare("SELECT slug, series_id FROM varieties ORDER BY slug").all<{ slug: string; series_id: number | null }>())!.results.map(
      (r) => [r.slug, r.series_id] as const,
    ),
  );

const CHANTILLY = ["snapdragon-chantilly-light-pink", "snapdragon-chantilly-light-salmon", "snapdragon-sherbet-toned-chantilly-mix"];
const CHANTILLY_SERIES = { slug: "snapdragon-chantilly", name: "Chantilly" };

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
  it("varieties/:id/series rides the admin route table beside the latin route", () => {
    expect(ADMIN_ROUTES.find((r) => r.pattern === "varieties/:id/series")).toMatchObject({
      method: "POST",
      scope: "admin",
      bucket: null,
      idempotent: true,
    });
  });
});

describe("the Chantilly assignment", () => {
  it("assigns Takii's Chantilly series to exactly the Chantilly snapdragon records", async () => {
    const admin = await s.auth.mint("series-chantilly-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const idsBefore = await allSeriesIds();
    const countBefore = await seriesCount();
    expect(await chantillyRows()).toEqual([]);
    for (const slug of CHANTILLY) expect(idsBefore.get(slug)).toBeNull();

    // The first assignment creates the series; the rest reuse it.
    const first = await post(`/admin/varieties/${CHANTILLY[0]}/series`, { series: "Chantilly" }, auth);
    expect(first.status).toBe(200);
    expect(((await first.json()) as { data: Record<string, unknown> }).data).toMatchObject({ variety: CHANTILLY[0], changed: ["series"], series: CHANTILLY_SERIES, created: true });
    for (const slug of CHANTILLY.slice(1)) {
      const r = await post(`/admin/varieties/${slug}/series`, { series: "Chantilly" }, auth);
      expect(r.status).toBe(200);
      expect(((await r.json()) as { data: Record<string, unknown> }).data).toMatchObject({ variety: slug, changed: ["series"], series: CHANTILLY_SERIES, created: false });
    }

    // Read-back through the public service agrees: each Chantilly variety carries the
    // series, the series page lists the three members, and /search renders a Series group.
    for (const slug of CHANTILLY) {
      expect((await s.catalog.getVariety(slug))!.series).toEqual(CHANTILLY_SERIES);
    }
    const detail = (await s.catalog.getSeries("snapdragon-chantilly"))!;
    expect(detail.name).toBe("Chantilly");
    expect(detail.varieties.map((v) => v.slug).sort()).toEqual([...CHANTILLY].sort());
    const found = await s.catalog.search("chantilly");
    expect(found.series.map((x) => x.slug)).toContain("snapdragon-chantilly");

    // The scope fence: exactly one Chantilly series row exists (on snapdragon), the series
    // table grew by exactly one, and no other variety's series_id moved.
    expect(await chantillyRows()).toEqual([{ ...CHANTILLY_SERIES, plant: "snapdragon" }]);
    expect(await seriesCount()).toBe(countBefore + 1);
    const idsAfter = await allSeriesIds();
    const moved = [...idsAfter.keys()].filter((slug) => idsAfter.get(slug) !== idsBefore.get(slug));
    expect(moved.sort()).toEqual([...CHANTILLY].sort());

    // A non-Chantilly snapdragon carries no series.
    expect((await stored("snapdragon-rocket-mix")).series_id).toBeNull();
    expect((await s.catalog.getVariety("snapdragon-rocket-mix"))!.series).toBeNull();
  });
});

describe("route: assign, re-set, and clear", () => {
  it("assigning to an existing series reuses its row and advances the catalog sequence", async () => {
    const admin = await s.auth.mint("series-existing-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const countBefore = await seriesCount();
    const seqBefore = await s.catalog.catalogSeq();

    const r = await post("/admin/varieties/zinnia-dawn-creek-pastels/series", { series: "Dearest" }, auth);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: Record<string, unknown> }).data).toMatchObject({
      variety: "zinnia-dawn-creek-pastels",
      changed: ["series"],
      series: { slug: "zinnia-dearest", name: "Dearest" },
      created: false,
    });
    expect(await seriesCount()).toBe(countBefore);
    expect(await s.catalog.catalogSeq()).toBeGreaterThan(seqBefore);
    expect((await s.catalog.getVariety("zinnia-dawn-creek-pastels"))!.series).toEqual({ slug: "zinnia-dearest", name: "Dearest" });

    // Restore: the fixture goes back to carrying no series.
    expect(await post("/admin/varieties/zinnia-dawn-creek-pastels/series", { series: null }, auth)).toMatchObject({ status: 200 });
    expect((await stored("zinnia-dawn-creek-pastels")).series_id).toBeNull();
  });

  it("assigning the same series again reports no change and writes nothing", async () => {
    const admin = await s.auth.mint("series-idempotent-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const slug = "snapdragon-chantilly-light-pink";
    // Ensure assigned (idempotent whether or not the Chantilly test ran first).
    expect(await post(`/admin/varieties/${slug}/series`, { series: "Chantilly" }, auth)).toMatchObject({ status: 200 });
    const afterFirst = await stored(slug);

    const second = await post(`/admin/varieties/${slug}/series`, { series: "Chantilly" }, auth);
    expect(second.status).toBe(200);
    expect(((await second.json()) as { data: Record<string, unknown> }).data).toMatchObject({ changed: [], created: false });
    expect(await stored(slug)).toEqual(afterFirst);
  });

  it("POST null clears the assignment to none", async () => {
    const admin = await s.auth.mint("series-clear-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    expect(await post("/admin/varieties/snapdragon-madame-butterfly-mix/series", { series: "Chantilly" }, auth)).toMatchObject({ status: 200 });
    expect((await stored("snapdragon-madame-butterfly-mix")).series_id).not.toBeNull();

    const r = await post("/admin/varieties/snapdragon-madame-butterfly-mix/series", { series: null }, auth);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: Record<string, unknown> }).data).toMatchObject({ changed: ["series"], series: null });
    expect((await stored("snapdragon-madame-butterfly-mix")).series_id).toBeNull();
    expect((await s.catalog.getVariety("snapdragon-madame-butterfly-mix"))!.series).toBeNull();
  });

  it("a colliding slug owned by another series is a 409 naming the slug, with nothing written", async () => {
    const admin = await s.auth.mint("series-conflict-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    // Ensure the Chantilly series exists (slug snapdragon-chantilly), whatever ran before.
    expect(await post("/admin/varieties/snapdragon-black-prince/series", { series: "Chantilly" }, auth)).toMatchObject({ status: 200 });
    const countBefore = await seriesCount();
    const before = await stored("snapdragon-toulon-mix");

    // A different name with the same slug: exact-name lookup misses, slug lookup hits.
    const r = await post("/admin/varieties/snapdragon-toulon-mix/series", { series: "CHANTILLY" }, auth);
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ code: "series_slug_conflict" });
    expect(await stored("snapdragon-toulon-mix")).toEqual(before);
    expect(await seriesCount()).toBe(countBefore);

    // Restore the helper variety.
    expect(await post("/admin/varieties/snapdragon-black-prince/series", { series: null }, auth)).toMatchObject({ status: 200 });
  });

  it("the revalidate set covers the variety, the crop, the variety index, both series pages, and the sitemap on create", async () => {
    const spec = ADMIN_ROUTES.find((r) => r.pattern === "varieties/:id/series")!;
    // Create: a fresh series name brings a new public URL, so the sitemap revalidates.
    const created = await spec.handler({ services: s, params: { id: "snapdragon-orange-wonder" }, body: { series: "Revalidation Probe" } } as never);
    expect((created.data as { changed: string[] }).changed).toEqual(["series"]);
    expect(created.revalidate).toEqual(["/variety/snapdragon-orange-wonder", "/crop/snapdragon", "/variety", "/series/snapdragon-revalidation-probe", "/sitemap.xml"]);
    // Plain assign to an existing series: no new URL, no sitemap.
    const assigned = await spec.handler({ services: s, params: { id: "snapdragon-avignon-bicolor-yellow" }, body: { series: "Chantilly" } } as never);
    expect(assigned.revalidate).toEqual(["/variety/snapdragon-avignon-bicolor-yellow", "/crop/snapdragon", "/variety", "/series/snapdragon-chantilly"]);
    // Clear: the left series page revalidates (membership changed there), no sitemap.
    const cleared = await spec.handler({ services: s, params: { id: "snapdragon-avignon-bicolor-yellow" }, body: { series: null } } as never);
    expect((cleared.data as { changed: string[] }).changed).toEqual(["series"]);
    expect(cleared.revalidate).toEqual(["/variety/snapdragon-avignon-bicolor-yellow", "/crop/snapdragon", "/variety", "/series/snapdragon-chantilly"]);
    // Restore the helper variety (the empty probe series row stays: no public page links it).
    await spec.handler({ services: s, params: { id: "snapdragon-orange-wonder" }, body: { series: null } } as never);
    expect((await stored("snapdragon-orange-wonder")).series_id).toBeNull();
  });

  it("numeric ids work; malformed refs 404 like the sibling routes", async () => {
    const admin = await s.auth.mint("series-ref-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const id = (await t.env.DB.prepare("SELECT id FROM varieties WHERE slug = 'snapdragon-defiant-mix'").first<{ id: number }>())!.id;
    const ok = await post(`/admin/varieties/${id}/series`, { series: "Chantilly" }, auth);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { id: number } }).data.id).toBe(id);
    expect((await s.catalog.getVariety("snapdragon-defiant-mix"))!.series).toEqual(CHANTILLY_SERIES);
    expect(await post(`/admin/varieties/${id}/series`, { series: null }, auth)).toMatchObject({ status: 200 });

    const bad = await post("/admin/varieties/BAD_SLUG!!/series", { series: "x" }, auth);
    expect(bad.status).toBe(404);
    expect(await bad.json()).toMatchObject({ code: "not_found" });

    const missing = await post("/admin/varieties/no-such-variety/series", { series: "x" }, auth);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "variety_not_found" });
  });
});

describe("route validation", () => {
  it("a blank series is a validation error, never a clear — clearing is null's job", async () => {
    const admin = await s.auth.mint("series-blank-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("snapdragon-black-prince");
    for (const body of [{ series: "" }, { series: "   " }]) {
      const r = await post("/admin/varieties/snapdragon-black-prince/series", body, auth);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(await r.json()).toMatchObject({ code: "validation_error" });
    }
    expect(await stored("snapdragon-black-prince")).toEqual(before);
  });

  it("the body is strict: missing, extra, over-long, or mistyped series are 400 with nothing written", async () => {
    const admin = await s.auth.mint("series-body-admin", ["admin"]);
    const auth = { Authorization: `Bearer ${admin.token}` };
    const before = await stored("snapdragon-rembrandt");
    for (const body of [{}, { series: "x", extra: 1 }, { series: "x".repeat(121) }, { series: 42 }, { series: { name: "x" } }]) {
      const r = await post("/admin/varieties/snapdragon-rembrandt/series", body, auth);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(await r.json()).toMatchObject({ code: "validation_error" });
    }
    expect(await stored("snapdragon-rembrandt")).toEqual(before);
  });
});

describe("service level: the shared funnel", () => {
  it("varietySeriesUpdate resolves slugs and ids, and 404s unknown refs", async () => {
    const bySlug = await s.admin.varietySeriesUpdate("echinacea-white-swan", { series: "Primadonna" });
    expect(bySlug.data.changed).toEqual(["series"]);
    expect(bySlug.revalidate).toEqual(["/variety/echinacea-white-swan", "/crop/echinacea", "/variety", "/series/echinacea-primadonna"]);
    const id = (await t.env.DB.prepare("SELECT id FROM varieties WHERE slug = 'echinacea-white-swan'").first<{ id: number }>())!.id;
    const byId = await s.admin.varietySeriesUpdate(String(id), { series: null });
    expect(byId.data.changed).toEqual(["series"]);
    expect((await stored("echinacea-white-swan")).series_id).toBeNull();
    await expect(s.admin.varietySeriesUpdate("no-such-variety", { series: "x" })).rejects.toMatchObject({
      status: 404,
      code: "variety_not_found",
    });
  });
});

describe("auth", () => {
  it("401 without a key, 403 with the wrong scope, 200 with an admin key", async () => {
    const ingest = await s.auth.mint("series-ingest", ["ingest"]);
    const admin = await s.auth.mint("series-auth-admin", ["admin"]);
    const body = { series: "Chantilly" };

    const none = await post("/admin/varieties/snapdragon-potomac-appleblossom/series", body);
    expect(none.status).toBe(401);
    expect(none.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await none.json()).toMatchObject({ code: "unauthorized" });

    const wrong = await post("/admin/varieties/snapdragon-potomac-appleblossom/series", body, { Authorization: `Bearer ${ingest.token}` });
    expect(wrong.status).toBe(403);
    expect(await wrong.json()).toMatchObject({ code: "insufficient_scope" });

    const before = await stored("snapdragon-potomac-appleblossom");
    expect(before.series_id).toBeNull();

    const ok = await post("/admin/varieties/snapdragon-potomac-appleblossom/series", body, { Authorization: `Bearer ${admin.token}` });
    expect(ok.status).toBe(200);
    expect((await s.catalog.getVariety("snapdragon-potomac-appleblossom"))!.series).toEqual(CHANTILLY_SERIES);
    expect(await post("/admin/varieties/snapdragon-potomac-appleblossom/series", { series: null }, { Authorization: `Bearer ${admin.token}` })).toMatchObject({ status: 200 });
  });
});
