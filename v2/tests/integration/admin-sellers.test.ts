/**
 * Slice B (sellers) on a throwaway D1 (Miniflare): migration 0014 (the internal-notes
 * store), the notes-never-public centerpiece across the five real public surfaces, D3
 * edits, D4 classification + candidate completion, reviewer limits at the service,
 * deactivate / reactivate / remove, the D1 working list, and detail hydration.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { Services } from "@/lib/services";
import type { RuntimeEnv } from "@/lib/api/runtime-env";

const ctx = vi.hoisted(() => ({ services: null as unknown, env: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => ctx.env }));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import { resetTokenBuckets } from "@/lib/api/rate-limit";
import * as reviewRepo from "@/lib/repositories/admin";
import { readSnapshotRows } from "@/lib/repositories/snapshot";
import { snapshotRows } from "@/lib/repositories/sync";
import { SNAPSHOT_ALLOWLIST } from "@/lib/repositories/snapshot-allowlist";
import { PRIVATE_ACCOUNT_TABLES } from "@/lib/db/schema";
import { isPubliclyListed, statusWordFor } from "@/lib/admin/sellers";
import { SellerValidationError } from "@/lib/admin/seller-service";
import * as sellerRoute from "@/app/api/v1/sellers/[slug]/route";
import * as searchRoute from "@/app/api/v1/search/route";
import SellerPage from "@/app/seller/[slug]/page";
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
const NOTEBODY = "xqvj-body-7k2 the team should know the barn roof leaks";
const NOTENAME = "Xqvj Notebook Keeper";
const NOTE_CTX = { role: "admin", decider: { userId: 777, name: NOTENAME } };
const EMAILMARK = "xqvj-email-9p4@example.com";

type Handler = (req: Request, c: { params: Promise<Record<string, string | string[] | undefined>> }) => Promise<Response>;
const BASE = "https://seeds.hues.flowers";
async function callJson(h: Handler, path: string, params: Record<string, string> = {}) {
  const res = await h(new Request(`${BASE}${path}`, { headers: { "cf-connecting-ip": "198.51.100.7" } }), { params: Promise.resolve(params) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as { data?: unknown } };
}

async function sellerPageHtml(slug: string): Promise<string> {
  const el = await SellerPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
  return renderToString(el);
}

beforeAll(async () => {
  t = await createTestD1();
  s = createServices(t.db, { now });
  ctx.services = s;
  ctx.env = {
    siteUrl: BASE,
    corsOrigins: [BASE],
    rateLimiter: null,
    limiters: { search: null, reports: null, ingest: null },
    snapshots: t.env.SNAPSHOTS,
    revalidateToken: null,
    turnstileSecret: null,
    clickSalt: "test",
  } satisfies RuntimeEnv;
}, 180_000);

afterAll(async () => {
  await t.dispose();
});

beforeEach(() => resetTokenBuckets());

describe("migration 0014: the internal-notes store", () => {
  it("is additive only — seeded sellers, listings and review items untouched, notes empty", async () => {
    const sellers = (await raw("SELECT count(*) n FROM sellers").first<{ n: number }>())!.n;
    const listings = (await raw("SELECT count(*) n FROM listings").first<{ n: number }>())!.n;
    const items = (await raw("SELECT count(*) n FROM review_items").first<{ n: number }>())!.n;
    expect(sellers).toBeGreaterThan(0);
    expect(listings).toBeGreaterThan(0);
    expect(items).toBe(0);
    const songbird = (await raw("SELECT name, domain, eligibility, status FROM sellers WHERE slug = 'songbird-seed-co'").first<Record<string, string>>())!;
    expect(songbird).toMatchObject({ name: "Songbird Seed Co.", domain: "songbirdseeds.com", eligibility: "approved", status: "active" });
    expect((await raw("SELECT count(*) n FROM seller_notes").first<{ n: number }>())!.n).toBe(0);
    const ddl = (await raw("SELECT sql FROM sqlite_master WHERE name = 'seller_notes'").first<{ sql: string }>())!.sql;
    for (const col of ["seller_id", "author_user_id", "author_name", "author_role", "body", "created_at"]) expect(ddl).toContain(col);
    expect((await raw("SELECT name FROM sqlite_master WHERE name = 'seller_notes_seller_created_idx'").first())!.name).toBe("seller_notes_seller_created_idx");
    // The migration file itself only creates: no ALTER, DROP, DELETE, UPDATE, INSERT.
    expect(readFileSync(join(process.cwd(), "migrations/0014_seller_notes.sql"), "utf8")).not.toMatch(/ALTER|DROP|DELETE|UPDATE|INSERT/i);
  });
});

describe("notes never public — the centerpiece", () => {
  it("a note's body and author name reach no public surface, but do reach the admin read", async () => {
    advance(1000);
    await s.adminSellers.addNote("songbird-seed-co", { body: NOTEBODY }, NOTE_CTX);
    const needles = [NOTEBODY, NOTENAME, "seller_notes"];

    // (a) the public catalog API's seller payload, through the real route handler.
    const api = await callJson(sellerRoute.GET as Handler, "/api/v1/sellers/songbird-seed-co", { slug: "songbird-seed-co" });
    expect(api.status).toBe(200);
    expect(JSON.stringify(api.json.data)).toContain("songbird-seed-co");
    for (const n of needles) expect(JSON.stringify(api.json), `(a) ${n}`).not.toContain(n);

    // (b) the public seller page's rendered HTML, through the real page component.
    const html = await sellerPageHtml("songbird-seed-co");
    expect(html).toContain("Songbird Seed Co.");
    for (const n of needles) expect(html, `(b) ${n}`).not.toContain(n);

    // (c) the public search results for the seller's name, through the real search route.
    const found = await callJson(searchRoute.GET as Handler, "/search?q=Songbird&limit=10");
    expect(found.status).toBe(200);
    expect(JSON.stringify(found.json.data)).toContain("songbird-seed-co");
    for (const n of needles) expect(JSON.stringify(found.json), `(c) ${n}`).not.toContain(n);
    // And searching the marker itself finds nothing public.
    const markerSearch = await s.catalog.search("Xqvj Notebook", { limit: 10 });
    expect(markerSearch.sellers).toHaveLength(0);

    // (d) the sitemap payload, through the real sitemap export.
    const map = await sitemap();
    expect(JSON.stringify(map)).toContain("/seller/songbird-seed-co");
    for (const n of needles) expect(JSON.stringify(map), `(d) ${n}`).not.toContain(n);

    // (e) the catalog snapshot (sync) payload, through the real builders.
    const snap = await readSnapshotRows(t.db);
    const syncSnap = await s.sync.snapshot();
    const syncChanges = await s.sync.changes(0, 1000);
    expect(JSON.stringify(snap.sellers)).toContain("songbird-seed-co");
    for (const out of [JSON.stringify(snap), JSON.stringify(syncSnap), JSON.stringify(syncChanges)]) {
      for (const n of needles) expect(out, `(e) ${n}`).not.toContain(n);
    }

    // Non-vacuous the other way: the admin-authorized read returns the note.
    const notes = await s.adminSellers.listNotes("songbird-seed-co", REVIEWER);
    expect(notes.map((n) => n.body)).toContain(NOTEBODY);
    expect(notes.map((n) => n.authorName)).toContain(NOTENAME);
  });
});

describe("private-table discipline", () => {
  it("seller_notes is registered private and absent from the snapshot", async () => {
    expect(PRIVATE_ACCOUNT_TABLES as readonly string[]).toContain("seller_notes");
    expect(SNAPSHOT_ALLOWLIST.map((t) => t.name)).not.toContain("seller_notes");
    const snap = await readSnapshotRows(t.db);
    expect(Object.keys(snap)).not.toContain("seller_notes");
    expect(JSON.stringify(await snapshotRows(t.db))).not.toContain("seller_notes");
  });
});

describe("D3 edit", () => {
  it("an admin save changes exactly the submitted fields and returns the changed list", async () => {
    advance(1000);
    const before = (await s.adminSellers.detail("floret"))!;
    const platform = before.platform === null ? "shopify" : null;
    const type = before.type === "retail" ? "specialty" : "retail";
    const country = before.country === "US" ? "USA" : "US";
    const fields = { type, platform, contactEmail: "floret-admin@example.com", location: "Greenwood, SC", country, shipsTo: "US, CA", description: "D3 probe body" };
    const r = await s.adminSellers.updateSeller("floret", fields, ADMIN);
    expect(r.data.changed).toEqual(["type", "platform", "contactEmail", "location", "country", "shipsTo", "description"]);
    expect(r.revalidate).toContain("/seller/floret");
    expect(r.revalidate).toContain("/seller");
    expect(r.revalidate).toContain("/sitemap.xml");
    expect(r.revalidate.some((p) => p.startsWith("/variety/"))).toBe(true);
    const after = (await s.adminSellers.detail("floret"))!;
    expect(after).toMatchObject({ type, platform, contactEmail: "floret-admin@example.com", location: "Greenwood, SC", country, shipsTo: '["US","CA"]', description: "D3 probe body" });
    // Everything not submitted is untouched.
    expect(after.name).toBe(before.name);
    expect(after.homepage).toBe(before.homepage);
    expect(after.eligibility).toBe(before.eligibility);
    // Saving the same values again is a no-op save: nothing written, empty changed list.
    advance(1000);
    const again = await s.adminSellers.updateSeller("floret", fields, ADMIN);
    expect(again.data.changed).toEqual([]);
  });

  it("type/platform outside the enums are refused with no state change", async () => {
    const before = await s.adminSellers.detail("floret");
    await expect(s.adminSellers.updateSeller("floret", { type: "bogus" }, ADMIN)).rejects.toBeInstanceOf(SellerValidationError);
    await expect(s.adminSellers.updateSeller("floret", { platform: "bogus" }, ADMIN)).rejects.toBeInstanceOf(SellerValidationError);
    await expect(s.adminSellers.updateSeller("floret", { name: "   " }, ADMIN)).rejects.toBeInstanceOf(SellerValidationError);
    expect(await s.adminSellers.detail("floret")).toEqual(before);
  });

  it("contactEmail set through D3 never appears in any public payload", async () => {
    advance(1000);
    await s.adminSellers.updateSeller("hudson-valley-seed-co", { contactEmail: EMAILMARK }, ADMIN);
    const api = await callJson(sellerRoute.GET as Handler, "/api/v1/sellers/hudson-valley-seed-co", { slug: "hudson-valley-seed-co" });
    expect(JSON.stringify(api.json)).not.toContain(EMAILMARK);
    expect(await sellerPageHtml("hudson-valley-seed-co")).not.toContain(EMAILMARK);
    const found = await callJson(searchRoute.GET as Handler, "/search?q=Hudson+Valley&limit=10");
    expect(JSON.stringify(found.json)).not.toContain(EMAILMARK);
    expect(JSON.stringify(await sitemap())).not.toContain(EMAILMARK);
    expect(JSON.stringify(await readSnapshotRows(t.db))).not.toContain(EMAILMARK);
    expect(JSON.stringify(await s.sync.snapshot())).not.toContain(EMAILMARK);
    // …while the admin record carries it (the read is non-vacuous).
    expect((await s.adminSellers.detail("hudson-valley-seed-co"))!.contactEmail).toBe(EMAILMARK);
    await s.adminSellers.updateSeller("hudson-valley-seed-co", { contactEmail: null }, ADMIN);
  });
});

describe("D4 classification", () => {
  it("an admin flip changes isSmallFarm and the public badge, filing the Why note", async () => {
    advance(1000);
    const notesBefore = (await s.adminSellers.detail("songbird-seed-co"))!.notes.length;
    const r = await s.adminSellers.classifySeller("songbird-seed-co", { is_small_farm: false, note: "Too big for the badge." }, ADMIN);
    expect(r.data.is_small_farm).toBe(false);
    expect(r.data.published).toBe(false);
    expect((await s.adminSellers.detail("songbird-seed-co"))!.isSmallFarm).toBe(false);
    expect((await s.catalog.getSeller("songbird-seed-co"))!.isSmallFarm).toBe(false);
    const notes = await s.adminSellers.listNotes("songbird-seed-co", ADMIN);
    expect(notes).toHaveLength(notesBefore + 1);
    expect(notes[0]).toMatchObject({ body: "Too big for the badge.", authorName: "Ann Admin", authorRole: "admin", authorUserId: 102 });
    expect(r.revalidate).toContain("/seller/songbird-seed-co");
    // Restore the badge (no note → no note filed).
    advance(1000);
    await s.adminSellers.classifySeller("songbird-seed-co", { is_small_farm: true }, ADMIN);
    expect((await s.adminSellers.detail("songbird-seed-co"))!.isSmallFarm).toBe(true);
    expect(await s.adminSellers.listNotes("songbird-seed-co", ADMIN).then((ns) => ns.length)).toBe(notesBefore + 1);
  });

  it("a candidate stays unlisted after a D3 save and lists after the D4 save (resolution 4)", async () => {
    advance(1000);
    const c = await reviewRepo.createCandidateSeller(t.db, { name: "Completion Farm", homepage: "https://completion-farm.example", domain: "completion-farm.example", at: iso() });
    await s.adminSellers.updateSeller(c.slug, { location: "Greenwood, SC", description: "Details finished." }, ADMIN);
    expect(await s.catalog.getSeller(c.slug)).toBeNull();
    expect((await s.catalog.search("Completion Farm", { limit: 10 })).sellers).toHaveLength(0);
    advance(1000);
    const r = await s.adminSellers.classifySeller(c.slug, { is_small_farm: true }, ADMIN);
    expect(r.data.published).toBe(true);
    expect((await s.catalog.getSeller(c.slug))!.isSmallFarm).toBe(true);
    expect((await s.catalog.search("Completion Farm", { limit: 10 })).sellers.map((x) => x.slug)).toContain(c.slug);
    expect((await s.catalog.listSellers({ offset: 0, limit: 500 })).items.map((x) => x.slug)).toContain(c.slug);
    expect((await s.catalog.sitemapEntries()).sellers.map((x) => x.slug)).toContain(c.slug);
  });
});

describe("reviewer limits at the service", () => {
  it("edit, classify, deactivate, reactivate and remove are refused with no state change", async () => {
    const before = await s.adminSellers.detail("songbird-seed-co");
    const beforeJson = JSON.stringify(before);
    await expect(s.adminSellers.updateSeller("songbird-seed-co", { location: "Nowhere" }, REVIEWER)).rejects.toMatchObject({ status: 403 });
    await expect(s.adminSellers.classifySeller("songbird-seed-co", { is_small_farm: false }, REVIEWER)).rejects.toMatchObject({ status: 403 });
    await expect(s.adminSellers.setStatus("songbird-seed-co", "inactive", REVIEWER)).rejects.toMatchObject({ status: 403 });
    await expect(s.adminSellers.setStatus("songbird-seed-co", "active", REVIEWER)).rejects.toMatchObject({ status: 403 });
    await expect(s.adminSellers.removeSeller("songbird-seed-co", REVIEWER)).rejects.toMatchObject({ status: 403 });
    expect(JSON.stringify(await s.adminSellers.detail("songbird-seed-co"))).toBe(beforeJson);
    expect(before!.eligibility).toBe("approved");
  });

  it("a reviewer CAN read the detail and add a note", async () => {
    advance(1000);
    const d = await s.adminSellers.detail("songbird-seed-co");
    expect(d!.name).toBe("Songbird Seed Co.");
    expect("contactEmail" in d!).toBe(true);
    const { note } = await s.adminSellers.addNote("songbird-seed-co", { body: "Reviewer probe note." }, REVIEWER);
    expect(note).toMatchObject({ body: "Reviewer probe note.", authorName: "Rae Reviewer", authorRole: "reviewer", authorUserId: 101 });
    expect((await s.adminSellers.detail("songbird-seed-co"))!.notes[0]).toMatchObject({ body: "Reviewer probe note." });
    await expect(s.adminSellers.addNote("songbird-seed-co", { body: "   " }, REVIEWER)).rejects.toBeInstanceOf(SellerValidationError);
  });
});

describe("deactivate / reactivate / remove", () => {
  it("deactivation hides the seller and its listings publicly; reactivation restores them", async () => {
    const seller = (await raw("SELECT id FROM sellers WHERE slug = 'songbird-seed-co'").first<{ id: number }>())!.id;
    const variety = (await raw("SELECT v.slug FROM listings l JOIN varieties v ON v.id = l.variety_id WHERE l.seller_id = ? AND l.status IN ('active','published') LIMIT 1", seller).first<{ slug: string }>())!.slug;
    expect(JSON.stringify((await s.catalog.getVariety(variety))!.listings)).toContain("songbird-seed-co");

    advance(1000);
    const r = await s.adminSellers.setStatus("songbird-seed-co", "inactive", ADMIN);
    expect(r.data.status).toBe("inactive");
    expect(r.revalidate).toContain("/seller/songbird-seed-co");
    expect(r.revalidate).toContain(`/variety/${variety}`);
    expect((await s.adminSellers.detail("songbird-seed-co"))!.status).toBe("inactive");
    // Nothing deleted — but publicly gone everywhere.
    expect(await s.catalog.getSeller("songbird-seed-co")).toBeNull();
    expect((await s.catalog.search("Songbird", { limit: 10 })).sellers).toHaveLength(0);
    expect((await s.catalog.listSellers({ offset: 0, limit: 500 })).items.map((x) => x.slug)).not.toContain("songbird-seed-co");
    expect((await s.catalog.sitemapEntries()).sellers.map((x) => x.slug)).not.toContain("songbird-seed-co");
    expect(JSON.stringify((await s.catalog.getVariety(variety))!.listings)).not.toContain("songbird-seed-co");

    advance(1000);
    await s.adminSellers.setStatus("songbird-seed-co", "active", ADMIN);
    expect((await s.catalog.getSeller("songbird-seed-co"))!.slug).toBe("songbird-seed-co");
    expect((await s.catalog.search("Songbird", { limit: 10 })).sellers.map((x) => x.slug)).toContain("songbird-seed-co");
    expect(JSON.stringify((await s.catalog.getVariety(variety))!.listings)).toContain("songbird-seed-co");
  });

  it("remove runs the existing removal flow's effects", async () => {
    advance(1000);
    const r = await s.adminSellers.removeSeller("sunflower-steve-seed-co", ADMIN);
    expect(r.data.eligibility).toBe("removed_by_request");
    expect(r.data.listings_removed).toBe(1);
    expect(r.revalidate).toContain("/seller/sunflower-steve-seed-co");
    const row = (await raw("SELECT eligibility FROM sellers WHERE slug = 'sunflower-steve-seed-co'").first<{ eligibility: string }>())!;
    expect(row.eligibility).toBe("removed_by_request");
    expect((await raw("SELECT status FROM listings WHERE seller_id = (SELECT id FROM sellers WHERE slug = 'sunflower-steve-seed-co')").all<{ status: string }>()).results.map((l) => l.status)).toEqual(["removed"]);
    const domain = (await raw("SELECT domain FROM sellers WHERE slug = 'sunflower-steve-seed-co'").first<{ domain: string }>())!.domain;
    expect((await raw("SELECT count(*) n FROM blocked_domains WHERE domain = ?", domain).first<{ n: number }>())!.n).toBe(1);
    expect(await s.catalog.getSeller("sunflower-steve-seed-co")).toBeNull();
    // The admin record stays, reading Not active.
    const d = (await s.adminSellers.detail("sunflower-steve-seed-co"))!;
    expect(statusWordFor(d)).toBe("Not active");
  });
});

describe("D1 working list", () => {
  it("searches by name, case-insensitively", async () => {
    const lower = await s.adminSellers.listSellers({ q: "songbird", badge: "all", state: "all", sort: "name" });
    const upper = await s.adminSellers.listSellers({ q: "SONGBIRD", badge: "all", state: "all", sort: "name" });
    expect(lower.rows.map((r) => r.slug)).toContain("songbird-seed-co");
    expect(upper.rows.map((r) => r.slug)).toContain("songbird-seed-co");
    expect(lower.total).toBe(upper.total);
    const none = await s.adminSellers.listSellers({ q: "zzz-no-such-seller", badge: "all", state: "all", sort: "name" });
    expect(none).toEqual({ rows: [], total: 0 });
  });

  it("filters both chip groups with resolution-3 listing-state semantics", async () => {
    const small = await s.adminSellers.listSellers({ q: null, badge: "small", state: "all", sort: "name" });
    expect(small.rows.length).toBeGreaterThan(0);
    expect(small.rows.every((r) => r.isSmallFarm)).toBe(true);
    const notSmall = await s.adminSellers.listSellers({ q: null, badge: "not_small", state: "all", sort: "name" });
    expect(notSmall.rows.every((r) => !r.isSmallFarm)).toBe(true);

    const active = await s.adminSellers.listSellers({ q: null, badge: "all", state: "active", sort: "name" });
    expect(active.rows.length).toBeGreaterThan(0);
    expect(active.rows.every(isPubliclyListed)).toBe(true);
    expect(active.rows.every((r) => statusWordFor(r) === "Active")).toBe(true);
    const notActive = await s.adminSellers.listSellers({ q: null, badge: "all", state: "not_active", sort: "name" });
    expect(notActive.rows.every((r) => !isPubliclyListed(r))).toBe(true);

    // A candidate appears under All and Not active — never under Active — reading Candidate.
    advance(1000);
    const c = await reviewRepo.createCandidateSeller(t.db, { name: "Chip Probe Farm", homepage: "https://chip-probe.example", domain: "chip-probe.example", at: iso() });
    const all = await s.adminSellers.listSellers({ q: null, badge: "all", state: "all", sort: "name" });
    const againNotActive = await s.adminSellers.listSellers({ q: null, badge: "all", state: "not_active", sort: "name" });
    const againActive = await s.adminSellers.listSellers({ q: null, badge: "all", state: "active", sort: "name" });
    expect(all.rows.map((r) => r.slug)).toContain(c.slug);
    expect(againNotActive.rows.map((r) => r.slug)).toContain(c.slug);
    expect(againActive.rows.map((r) => r.slug)).not.toContain(c.slug);
    expect(statusWordFor(againNotActive.rows.find((r) => r.slug === c.slug)!)).toBe("Candidate");
  });

  it("counts exactly and holds the three sort orders", async () => {
    const all = await s.adminSellers.listSellers({ q: null, badge: "all", state: "all", sort: "name" });
    const rawCount = (await raw("SELECT count(*) n FROM sellers").first<{ n: number }>())!.n;
    expect(all.total).toBe(all.rows.length);
    expect(all.total).toBe(rawCount);
    const names = all.rows.map((r) => r.name.toLowerCase());
    expect([...names].sort()).toEqual(names);

    const byListings = await s.adminSellers.listSellers({ q: null, badge: "all", state: "all", sort: "listings" });
    expect(byListings.rows[0]!.slug).toBe("songbird-seed-co");
    expect(byListings.rows[0]!.liveListings).toBe(9);
    const counts = byListings.rows.map((r) => r.liveListings);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);

    // Recently updated: the freshest write leads (seed rows carry real wall-clock
    // updated_at, so the probe write jumps decisively past them).
    advance(30 * 86_400_000);
    await s.adminSellers.updateSeller("floret", { orderingNotes: "Sort probe." }, ADMIN);
    const byUpdated = await s.adminSellers.listSellers({ q: null, badge: "all", state: "all", sort: "updated" });
    expect(byUpdated.rows[0]!.slug).toBe("floret");
    const stamps = byUpdated.rows.map((r) => r.updatedAt);
    expect([...stamps].sort().reverse()).toEqual(stamps);
  });
});

describe("D2 detail hydration", () => {
  it("carries the full record, first listings, and notes newest-first", async () => {
    advance(1000);
    await s.adminSellers.addNote("floret", { body: "Older detail note." }, ADMIN);
    advance(1000);
    await s.adminSellers.addNote("floret", { body: "Newer detail note." }, REVIEWER);
    const d = (await s.adminSellers.detail("floret"))!;
    expect(d.contactEmail).toBe("floret-admin@example.com");
    expect(d.liveListingCount).toBeGreaterThan(0);
    expect(d.listings.length).toBeGreaterThan(0);
    expect(d.listings.length).toBeLessThanOrEqual(5);
    for (const l of d.listings) {
      expect(l.varietyName.length).toBeGreaterThan(0);
      expect(l.status.length).toBeGreaterThan(0);
    }
    expect(d.notes.map((n) => n.body).slice(0, 2)).toEqual(["Newer detail note.", "Older detail note."]);
    expect(await s.adminSellers.detail("no-such-seller")).toBeNull();
  });
});
