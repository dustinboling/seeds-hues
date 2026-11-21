/**
 * Slice C (listings + varieties + accounts) on a throwaway D1 (Miniflare): migration
 * 0015 losslessness, the variety-remove guardrail centerpiece (both surfaces, every
 * public payload, no cascade, reviewer refusal), the retire/restore round trip, E1
 * search/chips/deep-links, aliases incl. RA-1, and accounts incl. the last-admin and
 * self guards. Destructive tests build their own throwaway rows; list tests read seed
 * rows or compare against dynamic SQL counts, never hardcoded totals.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Services } from "@/lib/services";
import type { RuntimeEnv } from "@/lib/api/runtime-env";

const ctx = vi.hoisted(() => ({ services: null as unknown, env: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => ctx.env }));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import { resetTokenBuckets } from "@/lib/api/rate-limit";
import * as adminRepo from "@/lib/repositories/admin";
import * as ingestRepo from "@/lib/repositories/ingest";
import * as adminAuthRepo from "@/lib/repositories/admin-auth";
import * as accountsRepo from "@/lib/repositories/accounts";
import * as waitlistRepo from "@/lib/repositories/waitlist";
import { snapshotRows } from "@/lib/repositories/sync";
import { DUPLICATE_DECISION_SOURCE } from "@/lib/services/admin";
import { statusWordForListing } from "@/lib/admin/listings";
import * as adminRoute from "@/app/api/v1/admin/[...path]/route";
import sitemap from "@/app/sitemap";

let t: TestD1;
let s: Services;
const clock = { t: Date.parse("2026-11-21T10:00:00.000Z") };
const now = () => new Date(clock.t);
const iso = () => now().toISOString();
const advance = (ms: number) => {
  clock.t += ms;
};
const raw = (sql: string, ...binds: unknown[]) => t.env.DB.prepare(sql).bind(...binds);

const REVIEWER = { role: "reviewer", decider: { userId: 101, name: "Rae Reviewer" } };
const ADMIN = { role: "admin", decider: { userId: 102, name: "Ann Admin" } };

type Handler = (req: Request, c: { params: Promise<Record<string, string | string[] | undefined>> }) => Promise<Response>;
const BASE = "https://seeds.hues.flowers/api/v1";
const post = (h: Handler, path: string, body: unknown, headers: Record<string, string> = {}) =>
  h(new Request(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }), { params: Promise.resolve({}) });

let plantSlug = "";
let sellerId = 0;
let sourceId = 0;
let adminKey = "";

async function seedIds(): Promise<void> {
  plantSlug = (await raw("SELECT slug FROM plants ORDER BY id LIMIT 1").first<{ slug: string }>())!.slug;
  sellerId = (await raw("SELECT id FROM sellers WHERE slug = 'songbird-seed-co'").first<{ id: number }>())!.id;
  sourceId = (await raw("SELECT id FROM sources ORDER BY id LIMIT 1").first<{ id: number }>())!.id;
}

let throwaway = 0;
/** A throwaway listing with a unique product URL (parallel-safe within this file). */
async function insertListing(varietyId: number, over: { status?: string; availability?: string; title?: string } = {}): Promise<number> {
  throwaway += 1;
  const url = `https://example.com/slice-c-${throwaway}-${Date.now()}`;
  const r = await raw(
    "INSERT INTO listings (variety_id, seller_id, source_id, product_url, status, availability, title_raw, created_at, updated_at, last_checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    varietyId,
    sellerId,
    sourceId,
    url,
    over.status ?? "published",
    over.availability ?? "in_stock",
    over.title ?? `Xqvj Throwaway ${throwaway}`,
    "2026-11-20T00:00:00.000Z",
    "2026-11-20T00:00:00.000Z",
    "2026-11-20T22:14:00.000Z",
  ).first<{ id: number }>();
  return r!.id;
}

beforeAll(async () => {
  t = await createTestD1();
  s = createServices(t.db, { now });
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
  await seedIds();
  adminKey = (await s.auth.mint("slice-c-admin", ["admin"])).token;
}, 180_000);

afterAll(async () => {
  await t.dispose();
});

beforeEach(() => resetTokenBuckets());

describe("migration 0015: the 'restored' event + actor", () => {
  it("rebuilds listing_events losslessly on scratch SQLite running the real migration files", () => {
    // The real 0000–0014 files, then seeded rows, then the real 0015 file: the rebuild
    // must carry every row across verbatim. (Wrangler-application of 0015 itself is
    // proven on the main test D1 below, whose live DDL carries restored + actor.)
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys = OFF"); // D1 does not enforce FKs; mirror it.
      const files = ["0000_init", "0001_varieties_fts", "0002_delta", "0003_plants_latin_nullable", "0004_media_plant", "0005_plants_season_class", "0006_plant_sowing_methods", "0007_seller_imported_rating", "0008_accounts_waitlists", "0009_plants_grower_guide", "0010_seller_small_farm", "0011_listing_event_reason", "0012_admin_roles", "0013_admin_review", "0014_seller_notes"];
      for (const f of files) db.exec(readFileSync(join(process.cwd(), "migrations", `${f}.sql`), "utf8"));
      // One row per pre-migration event value, with reasons where the app writes them.
      const insert = db.prepare("INSERT INTO listing_events (listing_id, event, at, reason) VALUES (?, ?, ?, ?)");
      const seed: [number, string, string, string | null][] = [
        [11, "first_seen", "2026-11-18T10:00:00.000Z", null],
        [11, "sold_out", "2026-11-19T10:00:00.000Z", null],
        [12, "restocked", "2026-11-19T12:00:00.000Z", null],
        [13, "gone", "2026-11-20T10:00:00.000Z", "Not seed"],
      ];
      for (const [listingId, event, at, reason] of seed) insert.run(listingId, event, at, reason);
      const before = db.prepare("SELECT id, listing_id, event, at, reason FROM listing_events ORDER BY id").all();
      expect(before).toHaveLength(4);

      db.exec(readFileSync(join(process.cwd(), "migrations/0015_listing_events_restored.sql"), "utf8"));

      // Lossless: every row survives verbatim (id, listing_id, event, at, reason).
      expect(db.prepare("SELECT id, listing_id, event, at, reason FROM listing_events ORDER BY id").all()).toEqual(before);
      expect(db.prepare("SELECT DISTINCT actor FROM listing_events").all()).toEqual([{ actor: null }]);
      // 'restored' is accepted after the migration…
      db.prepare("INSERT INTO listing_events (listing_id, event, at, reason, actor) VALUES (11, 'restored', '2026-11-21T10:00:00.000Z', NULL, 'Ann Admin')").run();
      expect((db.prepare("SELECT actor FROM listing_events WHERE event = 'restored'").get() as { actor: string }).actor).toBe("Ann Admin");
      // …and the pre-migration values remain accepted.
      for (const event of ["first_seen", "restocked", "sold_out", "gone"]) {
        db.prepare("INSERT INTO listing_events (listing_id, event, at) VALUES (99, ?, '2026-11-21T10:00:00.000Z')").run(event);
      }
      // The CHECK still guards the enum.
      expect(() => db.prepare("INSERT INTO listing_events (listing_id, event, at) VALUES (99, 'bogus', '2026-11-21T10:00:00.000Z')").run()).toThrow();
    } finally {
      db.close();
    }
  });

  it("is Slice C's only schema change: restored + actor on the live DDL, verbatim copy in the file", async () => {
    const ddl = (await raw("SELECT sql FROM sqlite_master WHERE name = 'listing_events'").first<{ sql: string }>())!.sql;
    expect(ddl).toContain("'restored'");
    expect(ddl).toContain("actor");
    expect((await raw("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'listing_events' ORDER BY name").all<{ name: string }>()).results.map((r) => r.name)).toEqual([
      "listing_events_at_idx",
      "listing_events_listing_idx",
    ]);
    const file = readFileSync(join(process.cwd(), "migrations/0015_listing_events_restored.sql"), "utf8");
    expect(file).toContain("INSERT INTO `listing_events_new` (`id`, `listing_id`, `event`, `at`, `reason`) SELECT `id`, `listing_id`, `event`, `at`, `reason` FROM `listing_events`");
  });
});

describe("variety remove — the guardrail", () => {
  const NAME = "Xqvj Guardrail";
  const ALIAS = "Xqvj Guardrail Altname";
  let varietyId = 0;
  let slug = "";
  let listingId = 0;
  let userId = 0;

  it("sets up an isolated variety: a live listing, an alias, a tag, a waiter", async () => {
    advance(1000);
    const v = (await adminRepo.createVariety(t.db, { plantSlug, name: NAME, at: iso() }))!;
    varietyId = v.id;
    slug = v.slug;
    // A real public variety is indexable (the sitemap only lists indexable rows).
    await ingestRepo.recomputeIndexable(t.db, [varietyId]);
    listingId = await insertListing(varietyId, { title: "Xqvj Guardrail Seeds" });
    await s.adminVarieties.addAlias(slug, { name: ALIAS }, ADMIN);
    await raw("INSERT INTO variety_tags (variety_id, tag) VALUES (?, 'xqvj-guardrail-tag')", varietyId).run();
    userId = (await accountsRepo.insertUser(t.db, { email: "xqvj-guardrail@example.com", name: "Xqvj Waiter" }))!.id;
    await waitlistRepo.joinWaitlist(t.db, userId, varietyId, iso());
    // The F2 number is the guard's number: one shared live-listing definition.
    expect(await adminRepo.liveListingCountForVariety(t.db, varietyId)).toBe(1);
    expect((await s.adminVarieties.detail(slug))!.liveListingCount).toBe(1);
  });

  it("(a) refuses while a live listing exists — API and session — with zero state change", async () => {
    const before = (await raw("SELECT deleted_at, updated_at, updated_seq, status, indexable FROM varieties WHERE id = ?", varietyId).first<Record<string, unknown>>())!;
    const seqBefore = await s.catalog.catalogSeq();
    expect(before.deleted_at).toBeNull();

    // Key API, in-process…
    await expect(s.admin.removeVariety(varietyId)).rejects.toMatchObject({ status: 409, code: "variety_has_listings" });
    await expect(s.admin.removeVariety(varietyId)).rejects.toThrow("1 live listing");
    // …and through the real HTTP handler (401 without a key; 409 names the count).
    expect((await post(adminRoute.POST as Handler, `/admin/varieties/${varietyId}/remove`, {})).status).toBe(401);
    const blocked = await post(adminRoute.POST as Handler, `/admin/varieties/${varietyId}/remove`, {}, { Authorization: `Bearer ${adminKey}` });
    expect(blocked.status).toBe(409);
    const problem = (await blocked.json()) as { code: string; detail: string };
    expect(problem.code).toBe("variety_has_listings");
    expect(problem.detail).toContain("1 live listing");
    // Admin session surface.
    await expect(s.adminVarieties.removeVariety(slug, ADMIN)).rejects.toMatchObject({ status: 409, code: "variety_has_listings" });

    // Zero state change: deleted_at still null, seq + row stamps untouched…
    expect((await raw("SELECT deleted_at, updated_at, updated_seq, status, indexable FROM varieties WHERE id = ?", varietyId).first<Record<string, unknown>>())!).toEqual(before);
    expect(await s.catalog.catalogSeq()).toBe(seqBefore);
    // …and the variety is still on every public surface.
    expect(await s.catalog.getVariety(slug)).not.toBeNull();
    expect((await s.catalog.search(NAME)).varieties.map((v) => v.slug)).toContain(slug);
    expect((await s.catalog.search(ALIAS)).varieties.map((v) => v.slug)).toContain(slug);
    expect(JSON.stringify(await sitemap())).toContain(`/variety/${slug}`);
    expect(JSON.stringify(await s.sync.snapshot())).toContain(slug);
  });

  it("(b) succeeds after the listing is retired through the real removeListing", async () => {
    advance(1000);
    await s.admin.removeListing(listingId, { reason: "test teardown" });
    expect(await adminRepo.liveListingCountForVariety(t.db, varietyId)).toBe(0);

    // Snapshot the record for the no-cascade proof (after the legitimate retire).
    const snap = {
      listings: (await raw("SELECT * FROM listings WHERE variety_id = ? ORDER BY id", varietyId).all()).results,
      aliases: (await raw("SELECT * FROM variety_aliases WHERE variety_id = ? ORDER BY alias", varietyId).all()).results,
      tags: (await raw("SELECT * FROM variety_tags WHERE variety_id = ? ORDER BY tag", varietyId).all()).results,
      waitlist: (await raw("SELECT * FROM waitlist_entries WHERE variety_id = ? ORDER BY id", varietyId).all()).results,
      events: (await raw("SELECT count(*) n FROM listing_events WHERE listing_id = ?", listingId).first<{ n: number }>())!.n,
    };
    expect(snap.listings).toHaveLength(1);
    expect(snap.aliases.length).toBeGreaterThanOrEqual(2); // primary + the manual alias
    expect(snap.waitlist).toHaveLength(1);

    advance(1000);
    const r = await s.admin.removeVariety(varietyId);
    expect(r.data).toEqual({ variety_id: varietyId, slug, already_removed: false });
    expect(r.revalidate).toEqual([`/variety/${slug}`, `/crop/${plantSlug}`, "/variety", "/sitemap.xml"]);
    const row = (await raw("SELECT status, deleted_at, indexable FROM varieties WHERE id = ?", varietyId).first<{ status: string; deleted_at: string; indexable: number }>())!;
    expect(row.status).toBe("active"); // status is NOT changed
    expect(row.deleted_at).toBe(iso());
    expect(row.indexable).toBe(0);

    // (f) no cascade: listings, aliases, tags and waitlist rows byte-for-byte untouched.
    expect((await raw("SELECT * FROM listings WHERE variety_id = ? ORDER BY id", varietyId).all()).results).toEqual(snap.listings);
    expect((await raw("SELECT * FROM variety_aliases WHERE variety_id = ? ORDER BY alias", varietyId).all()).results).toEqual(snap.aliases);
    expect((await raw("SELECT * FROM variety_tags WHERE variety_id = ? ORDER BY tag", varietyId).all()).results).toEqual(snap.tags);
    expect((await raw("SELECT * FROM waitlist_entries WHERE variety_id = ? ORDER BY id", varietyId).all()).results).toEqual(snap.waitlist);
    expect((await raw("SELECT count(*) n FROM listing_events WHERE listing_id = ?", listingId).first<{ n: number }>())!.n).toBe(snap.events);
  });

  it("(e) leaves every real public payload — each proven to contain it before (non-vacuous)", async () => {
    // The variety-by-slug read (its page 404s).
    expect(await s.catalog.getVariety(slug)).toBeNull();
    // Public search by its name AND by its alias.
    expect((await s.catalog.search(NAME)).varieties.map((v) => v.slug)).not.toContain(slug);
    const aliasSearch = await s.catalog.search(ALIAS);
    expect(aliasSearch.varieties.map((v) => v.slug)).not.toContain(slug);
    // The sitemap payload, through the real export.
    expect(JSON.stringify(await sitemap())).not.toContain(`/variety/${slug}`);
    // The catalog snapshot payload, through the real service + repo builders.
    const snap = await s.sync.snapshot();
    expect(snap.varieties.map((v) => v.slug)).not.toContain(slug);
    expect(snap.names.filter((n) => n.name === NAME || n.name === ALIAS)).toHaveLength(0);
    expect(JSON.stringify(await snapshotRows(t.db))).not.toContain(slug);
    // The admin F1/F2 lists too.
    expect((await s.adminVarieties.listVarieties({ tab: "varieties", q: NAME, crop: null, show: 50 })).rows.map((r) => r.slug)).not.toContain(slug);
    expect(await s.adminVarieties.detail(slug)).toBeNull();
  });

  it("(c) a second remove reports already_removed and writes nothing", async () => {
    const before = (await raw("SELECT deleted_at, updated_at, updated_seq FROM varieties WHERE id = ?", varietyId).first<Record<string, unknown>>())!;
    const seqBefore = await s.catalog.catalogSeq();
    advance(1000);
    const again = await s.admin.removeVariety(varietyId);
    expect(again.data).toEqual({ variety_id: varietyId, slug, already_removed: true });
    expect((await raw("SELECT deleted_at, updated_at, updated_seq FROM varieties WHERE id = ?", varietyId).first<Record<string, unknown>>())!).toEqual(before);
    expect(await s.catalog.catalogSeq()).toBe(seqBefore);
    // Through HTTP too.
    const http = await post(adminRoute.POST as Handler, `/admin/varieties/${varietyId}/remove`, {}, { Authorization: `Bearer ${adminKey}` });
    expect(http.status).toBe(200);
    expect(((await http.json()) as { data: unknown }).data).toEqual({ variety_id: varietyId, slug, already_removed: true });
  });

  it("(d) an unknown id 404s on both surfaces", async () => {
    await expect(s.admin.removeVariety(999_999)).rejects.toMatchObject({ status: 404, code: "variety_not_found" });
    const missing = await post(adminRoute.POST as Handler, "/admin/varieties/999999/remove", {}, { Authorization: `Bearer ${adminKey}` });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "variety_not_found" });
    await expect(s.adminVarieties.removeVariety("no-such-variety", ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  it("(g) a reviewer-session remove is refused with no state change; the admin session removes", async () => {
    advance(1000);
    const v = (await adminRepo.createVariety(t.db, { plantSlug, name: "Xqvj Session", at: iso() }))!;
    const before = (await raw("SELECT deleted_at, updated_seq FROM varieties WHERE id = ?", v.id).first<Record<string, unknown>>())!;
    const seqBefore = await s.catalog.catalogSeq();
    await expect(s.adminVarieties.removeVariety(v.slug, REVIEWER)).rejects.toMatchObject({ status: 403 });
    expect((await raw("SELECT deleted_at, updated_seq FROM varieties WHERE id = ?", v.id).first<Record<string, unknown>>())!).toEqual(before);
    expect(await s.catalog.catalogSeq()).toBe(seqBefore);
    expect(await s.catalog.getVariety(v.slug)).not.toBeNull();
    // The admin session drives the same effect successfully.
    const r = await s.adminVarieties.removeVariety(v.slug, ADMIN);
    expect(r.data).toMatchObject({ variety_id: v.id, already_removed: false });
    expect(await s.catalog.getVariety(v.slug)).toBeNull();
  });
});

describe("retire / restore round trip", () => {
  let varietyId = 0;
  let slug = "";
  let listingId = 0;

  it("retires through the session service: gone event with actor + reason, off the public page", async () => {
    advance(1000);
    const v = (await adminRepo.createVariety(t.db, { plantSlug, name: "Xqvj Roundtrip", at: iso() }))!;
    varietyId = v.id;
    slug = v.slug;
    listingId = await insertListing(varietyId, { title: "Xqvj Roundtrip Seeds" });
    const countsBefore = await waitlistRepo.visibleListingCounts(t.db, [varietyId]);
    expect(countsBefore.get(varietyId)).toBe(1);
    expect((await s.catalog.getVariety(slug))!.listings.map((l) => l.id)).toContain(listingId);

    advance(1000);
    const r = await s.adminListings.retire({ listing: String(listingId), reason: "Not seed", note: "sold as bulbs" }, ADMIN);
    expect(r.data).toMatchObject({ listing_id: listingId, status: "removed" });
    expect((await raw("SELECT status FROM listings WHERE id = ?", listingId).first<{ status: string }>())!.status).toBe("removed");
    const events = (await raw("SELECT event, reason, actor FROM listing_events WHERE listing_id = ? ORDER BY id", listingId).all<{ event: string; reason: string | null; actor: string | null }>()).results;
    expect(events).toEqual([{ event: "gone", reason: "Not seed — sold as bulbs", actor: "Ann Admin" }]);
    // Off the variety's public page.
    expect((await waitlistRepo.visibleListingCounts(t.db, [varietyId])).get(varietyId)).toBeUndefined();
    expect((await s.catalog.getVariety(slug))!.listings.map((l) => l.id)).not.toContain(listingId);
  });

  it("restores: restored event with actor, back on the public page", async () => {
    advance(1000);
    const r = await s.adminListings.restore({ listing: String(listingId) }, ADMIN);
    expect(r.data).toMatchObject({ listing_id: listingId, status: "published", restored: true });
    expect((await raw("SELECT status FROM listings WHERE id = ?", listingId).first<{ status: string }>())!.status).toBe("published");
    const events = (await raw("SELECT event, reason, actor FROM listing_events WHERE listing_id = ? ORDER BY id", listingId).all<{ event: string; reason: string | null; actor: string | null }>()).results;
    expect(events).toEqual([
      { event: "gone", reason: "Not seed — sold as bulbs", actor: "Ann Admin" },
      { event: "restored", reason: null, actor: "Ann Admin" },
    ]);
    expect((await waitlistRepo.visibleListingCounts(t.db, [varietyId])).get(varietyId)).toBe(1);
    expect((await s.catalog.getVariety(slug))!.listings.map((l) => l.id)).toContain(listingId);
    // The E2 history reads the trail back in order.
    const detail = (await s.adminListings.detail(listingId))!;
    expect(detail.history.map((e) => e.event)).toEqual(["gone", "restored"]);
    expect(detail.history[0]).toMatchObject({ reason: "Not seed — sold as bulbs", actor: "Ann Admin" });
  });

  it("restoring a non-removed listing is a no-op naming why", async () => {
    const seqBefore = await s.catalog.catalogSeq();
    const eventsBefore = (await raw("SELECT count(*) n FROM listing_events WHERE listing_id = ?", listingId).first<{ n: number }>())!.n;
    advance(1000);
    const r = await s.adminListings.restore({ listing: String(listingId) }, ADMIN);
    expect(r.data).toEqual({ listing_id: listingId, restored: false, why: "not_removed" });
    expect(r.revalidate).toEqual([]);
    expect(await s.catalog.catalogSeq()).toBe(seqBefore);
    expect((await raw("SELECT count(*) n FROM listing_events WHERE listing_id = ?", listingId).first<{ n: number }>())!.n).toBe(eventsBefore);
  });

  it("a concurrent double restore has a single winner", async () => {
    advance(1000);
    await s.adminListings.retire({ listing: String(listingId), reason: "Other" }, ADMIN);
    const seqBefore = await s.catalog.catalogSeq();
    advance(1000);
    const [a, b] = await Promise.all([s.adminListings.restore({ listing: String(listingId) }, ADMIN), s.adminListings.restore({ listing: String(listingId) }, ADMIN)]);
    const outcomes = [a.data.restored, b.data.restored].sort();
    expect(outcomes).toEqual([false, true]);
    expect((await raw("SELECT count(*) n FROM listing_events WHERE listing_id = ? AND event = 'restored'", listingId).first<{ n: number }>())!.n).toBe(2); // one per restore above
    expect(await s.catalog.catalogSeq()).toBe(seqBefore + 1);
    expect((await raw("SELECT status FROM listings WHERE id = ?", listingId).first<{ status: string }>())!.status).toBe("published");
  });

  it("refuses reviewer retire/restore with no state change, and validates the reason", async () => {
    const rowBefore = (await raw("SELECT status, updated_seq FROM listings WHERE id = ?", listingId).first<Record<string, unknown>>())!;
    await expect(s.adminListings.retire({ listing: String(listingId), reason: "Not seed" }, REVIEWER)).rejects.toMatchObject({ status: 403 });
    await expect(s.adminListings.restore({ listing: String(listingId) }, REVIEWER)).rejects.toMatchObject({ status: 403 });
    expect((await raw("SELECT status, updated_seq FROM listings WHERE id = ?", listingId).first<Record<string, unknown>>())!).toEqual(rowBefore);
    await expect(s.adminListings.retire({ listing: String(listingId), reason: "junk" }, ADMIN)).rejects.toMatchObject({ status: 422, code: "invalid_fields" });
    await expect(s.adminListings.retire({ listing: String(listingId), reason: "Other", note: "x".repeat(501) }, ADMIN)).rejects.toMatchObject({ status: 422 });
  });

  it("stamps the actor from every door: report-retire passes it, the key API leaves NULL", async () => {
    advance(1000);
    const reportListing = await insertListing(varietyId, { title: "Xqvj Report Retire" });
    const itemId = await adminRepo.insertReviewItem(t.db, { type: "seller_correction", groupKey: "xqvj-report", proposal: {}, reason: null, confidence: null, at: iso() });
    await s.admin.retireListingFromReport(itemId, reportListing, "Dead link", { userId: 102, name: "Ann Admin" });
    expect((await raw("SELECT actor FROM listing_events WHERE listing_id = ? AND event = 'gone'", reportListing).first<{ actor: string }>())!.actor).toBe("Ann Admin");

    advance(1000);
    const apiListing = await insertListing(varietyId, { title: "Xqvj API Retire" });
    await s.admin.removeListing(apiListing, {});
    expect((await raw("SELECT actor FROM listing_events WHERE listing_id = ? AND event = 'gone'", apiListing).first<{ actor: string | null }>())!.actor).toBeNull();
  });
});

describe("E1: search, chips, deep links, counts, status words", () => {
  it("searches product title, variety name and seller name", async () => {
    const seed = (await raw(
      "SELECT l.id, l.title_raw, v.variety_name, s.name AS seller_name FROM listings l JOIN varieties v ON v.id = l.variety_id JOIN sellers s ON s.id = l.seller_id WHERE l.title_raw IS NOT NULL AND l.title_raw <> '' AND l.status <> 'removed' ORDER BY l.id LIMIT 1",
    ).first<{ id: number; title_raw: string; variety_name: string; seller_name: string }>())!;
    const ids = async (q: string) => (await s.adminListings.listListings({ q, chip: "all", seller: null, variety: null, show: 1000 })).rows.map((r) => r.id);
    // A middle slice proves substring matching (not just prefix).
    const slice = seed.title_raw.length > 14 ? seed.title_raw.slice(4, 14) : seed.title_raw;
    expect(await ids(slice)).toContain(seed.id);
    expect(await ids(seed.variety_name)).toContain(seed.id);
    expect(await ids(seed.seller_name)).toContain(seed.id);
  });

  it("filters chips per resolution 5 with exact totals", async () => {
    const visible = "l.status IN ('active','published') AND l.deleted_at IS NULL AND s.eligibility = 'approved' AND s.status = 'active' AND s.listing_policy <> 'removed' AND s.deleted_at IS NULL";
    const activeTotal = (await raw(`SELECT count(*) n FROM listings l JOIN sellers s ON s.id = l.seller_id JOIN varieties v ON v.id = l.variety_id WHERE ${visible} AND l.availability <> 'sold_out'`).first<{ n: number }>())!.n;
    const soldTotal = (await raw(`SELECT count(*) n FROM listings l JOIN sellers s ON s.id = l.seller_id JOIN varieties v ON v.id = l.variety_id WHERE ${visible} AND l.availability = 'sold_out'`).first<{ n: number }>())!.n;
    const retiredTotal = (await raw("SELECT count(*) n FROM listings WHERE status = 'removed'").first<{ n: number }>())!.n;
    const allTotal = (await raw("SELECT count(*) n FROM listings").first<{ n: number }>())!.n;
    expect(activeTotal).toBeGreaterThan(0);
    expect(retiredTotal).toBeGreaterThan(0); // the round-trip suite retired rows above

    const active = await s.adminListings.listListings({ q: null, chip: "active", seller: null, variety: null, show: 50 });
    expect(active.total).toBe(activeTotal);
    for (const r of active.rows) expect(statusWordForListing(r)).toBe("Active");
    const sold = await s.adminListings.listListings({ q: null, chip: "sold_out", seller: null, variety: null, show: 50 });
    expect(sold.total).toBe(soldTotal);
    for (const r of sold.rows) expect(statusWordForListing(r)).toBe("Sold out");
    const retired = await s.adminListings.listListings({ q: null, chip: "retired", seller: null, variety: null, show: 50 });
    expect(retired.total).toBe(retiredTotal);
    for (const r of retired.rows) expect(statusWordForListing(r)).toBe("Retired");
    expect((await s.adminListings.listListings({ q: null, chip: "all", seller: null, variety: null, show: 50 })).total).toBe(allTotal);
  });

  it("covers a sold-out visible listing and a gone one end to end", async () => {
    const v = (await adminRepo.createVariety(t.db, { plantSlug, name: "Xqvj Statuswords", at: iso() }))!;
    const soldOut = await insertListing(v.id, { availability: "sold_out", title: "Xqvj Statuswords Soldout" });
    const gone = await insertListing(v.id, { status: "gone", title: "Xqvj Statuswords Gone" });
    const found = await s.adminListings.listListings({ q: "Xqvj Statuswords", chip: "all", seller: null, variety: null, show: 50 });
    expect(found.rows.map((r) => [r.id, statusWordForListing(r)])).toEqual([
      [soldOut, "Sold out"],
      [gone, "Gone"],
    ]);
    expect((await s.adminListings.listListings({ q: "Xqvj Statuswords", chip: "sold_out", seller: null, variety: null, show: 50 })).rows.map((r) => r.id)).toEqual([soldOut]);
    expect((await s.adminListings.listListings({ q: "Xqvj Statuswords", chip: "active", seller: null, variety: null, show: 50 })).total).toBe(0);
    expect((await s.adminListings.listListings({ q: "Xqvj Statuswords", chip: "retired", seller: null, variety: null, show: 50 })).total).toBe(0);
  });

  it("applies the seller and variety deep links, combinable with search + chips", async () => {
    const sellerRows = await s.adminListings.listListings({ q: null, chip: "all", seller: "songbird-seed-co", variety: null, show: 50 });
    expect(sellerRows.total).toBeGreaterThan(0);
    for (const r of sellerRows.rows) expect(r.sellerSlug).toBe("songbird-seed-co");
    expect(sellerRows.total).toBe((await raw("SELECT count(*) n FROM listings l JOIN sellers s ON s.id = l.seller_id WHERE s.slug = 'songbird-seed-co'").first<{ n: number }>())!.n);

    const seedVariety = (await raw("SELECT slug FROM varieties WHERE deleted_at IS NULL ORDER BY id LIMIT 1").first<{ slug: string }>())!.slug;
    const varietyRows = await s.adminListings.listListings({ q: null, chip: "all", seller: null, variety: seedVariety, show: 50 });
    for (const r of varietyRows.rows) expect(r.varietySlug).toBe(seedVariety);

    // Combined: a deep link + search + chip narrows together.
    const combined = await s.adminListings.listListings({ q: "Xqvj Statuswords", chip: "sold_out", seller: "songbird-seed-co", variety: null, show: 50 });
    expect(combined.total).toBe(1);
    for (const r of combined.rows) expect([statusWordForListing(r), r.sellerSlug]).toEqual(["Sold out", "songbird-seed-co"]);

    // Chip labels resolve names; unknown slugs resolve null (the filter then matches nothing).
    expect(await s.adminListings.filterLabels({ seller: "songbird-seed-co", variety: seedVariety })).toMatchObject({ seller: { slug: "songbird-seed-co" } });
    expect((await s.adminListings.filterLabels({ seller: "songbird-seed-co", variety: seedVariety })).seller!.name).toContain("Songbird");
    expect(await s.adminListings.filterLabels({ seller: "no-such-seller", variety: null })).toEqual({ seller: null, variety: null });
  });

  it("windows at 50 with exact totals", async () => {
    // The seed holds 23 listings — top up with throwaways so the window bites.
    const v = (await adminRepo.createVariety(t.db, { plantSlug, name: "Xqvj Windowing", at: iso() }))!;
    for (let i = 0; i < 60; i++) await insertListing(v.id, { title: `Xqvj Windowing ${i}` });
    const first = await s.adminListings.listListings({ q: null, chip: "all", seller: null, variety: null, show: 50 });
    expect(first.rows).toHaveLength(50);
    expect(first.total).toBeGreaterThan(50);
    const wider = await s.adminListings.listListings({ q: null, chip: "all", seller: null, variety: null, show: 100 });
    expect(wider.rows).toHaveLength(wider.total);
    expect(wider.total).toBe(first.total);
    expect(wider.rows.slice(0, 50).map((r) => r.id)).toEqual(first.rows.map((r) => r.id));
  });
});

describe("F1/F2/F3 + aliases (RA-1)", () => {
  const NAME = "Xqvj Alias";
  const ALT = "Xqvj Alias Altname";
  let varietyId = 0;
  let slug = "";

  it("adds a manual alias: on F2, in F1 search labeled, seq bumped", async () => {
    advance(1000);
    const v = (await adminRepo.createVariety(t.db, { plantSlug, name: NAME, at: iso() }))!;
    varietyId = v.id;
    slug = v.slug;
    await insertListing(varietyId, { title: "Xqvj Alias Seeds" });
    const seqBefore = (await raw("SELECT updated_seq FROM varieties WHERE id = ?", varietyId).first<{ updated_seq: number }>())!.updated_seq;

    advance(1000);
    await s.adminVarieties.addAlias(slug, { name: ALT }, ADMIN);
    const detail = (await s.adminVarieties.detail(slug))!;
    expect(detail.aliases.map((a) => a.alias)).toContain(ALT);
    const added = detail.aliases.find((a) => a.alias === ALT)!;
    expect(added).toMatchObject({ kind: "synonym", source: null, decisionItemId: null, decidedByName: null });
    expect((await raw("SELECT updated_seq FROM varieties WHERE id = ?", varietyId).first<{ updated_seq: number }>())!.updated_seq).toBeGreaterThan(seqBefore);

    // F1 search finds it labeled as an alias match.
    const byAlias = await s.adminVarieties.listVarieties({ tab: "varieties", q: ALT, crop: null, show: 50 });
    const row = byAlias.rows.find((r) => r.slug === slug)!;
    expect(row.matchedAlias).toBe(ALT);
    const byName = await s.adminVarieties.listVarieties({ tab: "varieties", q: NAME, crop: null, show: 50 });
    expect(byName.rows.find((r) => r.slug === slug)!.matchedAlias).toBeNull();
  });

  it("refuses blank / duplicate / own-name adds with no write", async () => {
    const aliasesBefore = (await raw("SELECT count(*) n FROM variety_aliases WHERE variety_id = ?", varietyId).first<{ n: number }>())!.n;
    const seqBefore = await s.catalog.catalogSeq();
    await expect(s.adminVarieties.addAlias(slug, { name: "   " }, ADMIN)).rejects.toMatchObject({ status: 422, code: "invalid_fields" });
    await expect(s.adminVarieties.addAlias(slug, { name: ALT.toUpperCase() }, ADMIN)).rejects.toMatchObject({ status: 422 }); // normalized duplicate
    await expect(s.adminVarieties.addAlias(slug, { name: `  ${NAME} ` }, ADMIN)).rejects.toMatchObject({ status: 422 }); // the variety's own name
    expect((await raw("SELECT count(*) n FROM variety_aliases WHERE variety_id = ?", varietyId).first<{ n: number }>())!.n).toBe(aliasesBefore);
    expect(await s.catalog.catalogSeq()).toBe(seqBefore);
  });

  it("removes a manual alias; refuses a duplicate_decision alias at the service layer", async () => {
    advance(1000);
    await adminRepo.addAlias(t.db, varietyId, "Xqvj Decided Name", "synonym", null, { source: DUPLICATE_DECISION_SOURCE, decisionItemId: 4242, decidedByName: "Rae Reviewer", createdAt: iso() });
    const decided = (await s.adminVarieties.detail(slug))!.aliases.find((a) => a.alias === "Xqvj Decided Name")!;
    expect(decided).toMatchObject({ source: DUPLICATE_DECISION_SOURCE, decidedByName: "Rae Reviewer" });

    // RA-1 at the service layer: refused with no state change no matter how it arrives.
    const aliasesBefore = (await raw("SELECT * FROM variety_aliases WHERE variety_id = ? ORDER BY alias", varietyId).all()).results;
    await expect(s.adminVarieties.removeAlias(slug, { alias: "Xqvj Decided Name" }, ADMIN)).rejects.toMatchObject({ status: 403, code: "alias_protected" });
    await expect(s.adminVarieties.removeAlias(slug, { alias: "Xqvj Decided Name" }, REVIEWER)).rejects.toMatchObject({ status: 403 });
    expect((await raw("SELECT * FROM variety_aliases WHERE variety_id = ? ORDER BY alias", varietyId).all()).results).toEqual(aliasesBefore);

    // The manual alias removes cleanly (and reviewers can't remove those either).
    await expect(s.adminVarieties.removeAlias(slug, { alias: ALT }, REVIEWER)).rejects.toMatchObject({ status: 403 });
    await s.adminVarieties.removeAlias(slug, { alias: ALT }, ADMIN);
    expect((await s.adminVarieties.detail(slug))!.aliases.map((a) => a.alias)).not.toContain(ALT);
    expect((await s.adminVarieties.detail(slug))!.aliases.map((a) => a.alias)).toContain("Xqvj Decided Name");
    await expect(s.adminVarieties.removeAlias(slug, { alias: "no-such-name" }, ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  it("counts sellers and names per row, filters crops, windows with exact totals", async () => {
    const all = await s.adminVarieties.listVarieties({ tab: "varieties", q: null, crop: null, show: 50 });
    expect(all.total).toBe((await raw("SELECT count(*) n FROM varieties WHERE deleted_at IS NULL").first<{ n: number }>())!.n);
    expect(all.rows).toHaveLength(50);
    // Row counts match the record.
    const row = (await s.adminVarieties.listVarieties({ tab: "varieties", q: NAME, crop: null, show: 50 })).rows.find((r) => r.slug === slug)!;
    expect(row.liveSellers).toBe(1);
    expect(row.aliasCount).toBe(1); // the manual alias left; the decision alias stays
    // Crop filter: every row the crop, total exact.
    const crop = await s.adminVarieties.listVarieties({ tab: "varieties", q: null, crop: plantSlug, show: 500 });
    expect(crop.total).toBeGreaterThan(0);
    for (const r of crop.rows) expect(r.plantSlug).toBe(plantSlug);
    expect(crop.total).toBe((await raw("SELECT count(*) n FROM varieties v JOIN plants p ON p.id = v.plant_id WHERE v.deleted_at IS NULL AND p.slug = ?", plantSlug).first<{ n: number }>())!.n);
  });

  it("hydrates F2: status-word breakdown, waitlist count, aliases", async () => {
    const w = (await accountsRepo.insertUser(t.db, { email: "xqvj-alias-waiter@example.com", name: "Xqvj" }))!.id;
    await waitlistRepo.joinWaitlist(t.db, w, varietyId, iso());
    const detail = (await s.adminVarieties.detail(slug))!;
    expect(detail.listingCounts).toEqual([{ word: "Active", n: 1 }]);
    expect(detail.listingTotal).toBe(1);
    expect(detail.waitlistCount).toBe(1);
    expect(detail.aliases.map((a) => a.alias)).toContain("Xqvj Decided Name");
  });

  it("lists crops with variety and seller counts", async () => {
    const crops = await s.adminVarieties.listCrops();
    expect(crops.length).toBeGreaterThan(0);
    const crop = crops.find((c) => c.slug === plantSlug)!;
    expect(crop.varietyCount).toBe((await raw("SELECT count(*) n FROM varieties v JOIN plants p ON p.id = v.plant_id WHERE p.slug = ? AND v.status = 'active' AND v.deleted_at IS NULL", plantSlug).first<{ n: number }>())!.n);
    expect(crop.sellerCount).toBeGreaterThanOrEqual(1);
    const names = crops.map((c) => c.commonName.toLowerCase());
    expect([...names].sort()).toEqual(names);
  });
});

describe("G1/G2 accounts", () => {
  let adminId = 0;
  let reviewerId = 0;
  let visitorId = 0;
  let farmId = 0;

  it("sets up isolated accounts with roles", async () => {
    advance(1000);
    adminId = (await accountsRepo.insertUser(t.db, { email: "xqvj-admin@example.com", name: "Xqvj Admin", phone: "5550001000" }))!.id;
    reviewerId = (await accountsRepo.insertUser(t.db, { email: "xqvj-reviewer@example.com", name: "Xqvj Reviewer", displayName: "Xqvj Ree" }))!.id;
    visitorId = (await accountsRepo.insertUser(t.db, { email: "xqvj-visitor@example.com", name: "Xqvj Visitor" }))!.id;
    farmId = (await accountsRepo.insertUser(t.db, { email: "xqvj-farmer@example.com", name: "Xqvj Farmer" }))!.id;
    await adminAuthRepo.setRole(t.db, { userId: adminId, fromRole: "visitor", toRole: "admin", actor: "test-seed", at: iso() });
    await adminAuthRepo.setRole(t.db, { userId: reviewerId, fromRole: "visitor", toRole: "reviewer", actor: "test-seed", at: iso() });
    expect(await adminAuthRepo.countAdmins(t.db)).toBe(1);
  });

  it("searches name, displayName and email with exact totals", async () => {
    const byName = await s.adminAccounts.listAccounts({ q: "Xqvj Reviewer", show: 50 }, ADMIN);
    expect(byName.rows.map((r) => r.id)).toContain(reviewerId);
    const byDisplay = await s.adminAccounts.listAccounts({ q: "Xqvj Ree", show: 50 }, ADMIN);
    expect(byDisplay.rows.map((r) => r.id)).toContain(reviewerId);
    const byEmail = await s.adminAccounts.listAccounts({ q: "xqvj-visitor@example.com", show: 50 }, ADMIN);
    expect(byEmail.rows.map((r) => r.id)).toEqual([visitorId]);
    expect(byEmail.total).toBe(1);
    const all = await s.adminAccounts.listAccounts({ q: null, show: 50 }, ADMIN);
    expect(all.total).toBe((await raw("SELECT count(*) n FROM users").first<{ n: number }>())!.n);
  });

  it("changes roles through role_audit, and the history reads back", async () => {
    advance(1000);
    const r = await s.adminAccounts.setRole({ account: String(visitorId), role: "reviewer" }, ADMIN);
    expect(r).toMatchObject({ changed: true, fromRole: "visitor", toRole: "reviewer" });
    const audit = await adminAuthRepo.roleAuditFor(t.db, visitorId);
    expect(audit[0]).toMatchObject({ fromRole: "visitor", toRole: "reviewer", actor: "Ann Admin" });
    const detail = await s.adminAccounts.detail({ account: visitorId }, ADMIN);
    expect(detail.role).toBe("reviewer");
    expect(detail.roleAudit[0]).toMatchObject({ toRole: "reviewer", actor: "Ann Admin" });

    // Grant admin lands as admin.
    advance(1000);
    const grant = await s.adminAccounts.setRole({ account: String(visitorId), role: "admin" }, ADMIN);
    expect(grant).toMatchObject({ changed: true, toRole: "admin" });
    expect((await accountsRepo.userById(t.db, visitorId))!.role).toBe("admin");
  });

  it("refuses to demote the last admin and to change your own role", async () => {
    // visitorId is an admin now (above); demote back so adminId stands alone.
    advance(1000);
    await s.adminAccounts.setRole({ account: String(visitorId), role: "reviewer" }, ADMIN);
    expect(await adminAuthRepo.countAdmins(t.db)).toBe(1);

    const auditBefore = (await raw("SELECT count(*) n FROM role_audit WHERE user_id = ?", adminId).first<{ n: number }>())!.n;
    await expect(s.adminAccounts.setRole({ account: String(adminId), role: "reviewer" }, ADMIN)).rejects.toMatchObject({ status: 409, code: "last_admin" });
    expect((await accountsRepo.userById(t.db, adminId))!.role).toBe("admin");
    expect((await raw("SELECT count(*) n FROM role_audit WHERE user_id = ?", adminId).first<{ n: number }>())!.n).toBe(auditBefore);

    // A second admin unlocks the demotion.
    advance(1000);
    await s.adminAccounts.setRole({ account: String(visitorId), role: "admin" }, ADMIN);
    await s.adminAccounts.setRole({ account: String(adminId), role: "reviewer" }, ADMIN);
    expect((await accountsRepo.userById(t.db, adminId))!.role).toBe("reviewer");

    // Self change is refused even by an admin (defense in depth behind the absent controls).
    const self = { role: "admin", decider: { userId: visitorId, name: "Xqvj Visitor" } };
    const roleBefore = (await accountsRepo.userById(t.db, visitorId))!.role;
    await expect(s.adminAccounts.setRole({ account: String(visitorId), role: "visitor" }, self)).rejects.toMatchObject({ status: 403, code: "self_role_change" });
    expect((await accountsRepo.userById(t.db, visitorId))!.role).toBe(roleBefore);

    // Same-role saves and bad roles write nothing.
    const auditsBefore = (await raw("SELECT count(*) n FROM role_audit").first<{ n: number }>())!.n;
    expect(await s.adminAccounts.setRole({ account: String(reviewerId), role: "reviewer" }, ADMIN)).toMatchObject({ changed: false });
    await expect(s.adminAccounts.setRole({ account: String(reviewerId), role: "superadmin" }, ADMIN)).rejects.toMatchObject({ status: 422 });
    expect((await raw("SELECT count(*) n FROM role_audit").first<{ n: number }>())!.n).toBe(auditsBefore);
  });

  it("grants and revokes farm-owner status through the existing audit trail", async () => {
    const w = (await raw("SELECT id FROM varieties WHERE deleted_at IS NULL ORDER BY id LIMIT 1").first<{ id: number }>())!.id;
    await waitlistRepo.joinWaitlist(t.db, farmId, w, iso());
    advance(1000);
    const grant = await s.adminAccounts.grantFarmOwner({ account: String(farmId), seller: "songbird-seed-co" }, ADMIN);
    expect(grant).toMatchObject({ changed: true, sellerSlug: "songbird-seed-co" });
    const bound = (await accountsRepo.userById(t.db, farmId))!;
    expect(bound.isFarmOwner).toBe(true);
    expect(bound.sellerId).toBe(sellerId);
    const audit = await accountsRepo.farmOwnerAuditFor(t.db, farmId);
    expect(audit[0]).toMatchObject({ action: "granted", actor: "Ann Admin", sellerId });
    const detail = await s.adminAccounts.detail({ account: farmId }, ADMIN);
    expect(detail.farmSeller).toMatchObject({ slug: "songbird-seed-co" });

    advance(1000);
    const revoke = await s.adminAccounts.revokeFarmOwner({ account: String(farmId) }, ADMIN);
    expect(revoke).toMatchObject({ changed: true });
    const unbound = (await accountsRepo.userById(t.db, farmId))!;
    expect(unbound.isFarmOwner).toBe(false);
    expect((await accountsRepo.farmOwnerAuditFor(t.db, farmId))[0]).toMatchObject({ action: "revoked", actor: "Ann Admin" });
    // Revoking keeps the account and its waiting lists.
    expect(unbound.email).toBe("xqvj-farmer@example.com");
    expect(await waitlistRepo.waitlistCountForUser(t.db, farmId)).toBe(1);

    await expect(s.adminAccounts.grantFarmOwner({ account: String(farmId), seller: "no-such-seller" }, ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  it("hydrates G2: facts, waitlist count, status, picker options", async () => {
    const detail = await s.adminAccounts.detail({ account: adminId }, ADMIN);
    expect(detail).toMatchObject({ email: "xqvj-admin@example.com", phone: "5550001000", status: "active" });
    expect(detail.waitlistCount).toBe(0);
    const options = await s.adminAccounts.sellerOptions(ADMIN);
    expect(options.length).toBeGreaterThan(0);
    expect(options[0]).toMatchObject({ slug: expect.any(String), name: expect.any(String) });
    await expect(s.adminAccounts.detail({ account: 999_999 }, ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  it("gives reviewers no Accounts data and no Accounts writes (403, no state change)", async () => {
    const auditsBefore = (await raw("SELECT count(*) n FROM role_audit").first<{ n: number }>())!.n;
    const farmBefore = (await raw("SELECT count(*) n FROM farm_owner_audit").first<{ n: number }>())!.n;
    await expect(s.adminAccounts.listAccounts({ q: null, show: 50 }, REVIEWER)).rejects.toMatchObject({ status: 403 });
    await expect(s.adminAccounts.detail({ account: adminId }, REVIEWER)).rejects.toMatchObject({ status: 403 });
    await expect(s.adminAccounts.setRole({ account: String(reviewerId), role: "visitor" }, REVIEWER)).rejects.toMatchObject({ status: 403 });
    await expect(s.adminAccounts.grantFarmOwner({ account: String(farmId), seller: "songbird-seed-co" }, REVIEWER)).rejects.toMatchObject({ status: 403 });
    await expect(s.adminAccounts.revokeFarmOwner({ account: String(farmId) }, REVIEWER)).rejects.toMatchObject({ status: 403 });
    await expect(s.adminAccounts.sellerOptions(REVIEWER)).rejects.toMatchObject({ status: 403 });
    expect((await raw("SELECT count(*) n FROM role_audit").first<{ n: number }>())!.n).toBe(auditsBefore);
    expect((await raw("SELECT count(*) n FROM farm_owner_audit").first<{ n: number }>())!.n).toBe(farmBefore);
    expect((await accountsRepo.userById(t.db, reviewerId))!.role).toBe("reviewer");
  });
});
