/**
 * Slice A (review queues) on a throwaway D1 (Miniflare): migration 0013 (the decider
 * trail, duplicate_hold, alias provenance), decider threading, the scout-holds feed,
 * duplicate decisions both ways, reviewer powers + limits, farm-stream approvals, the
 * candidate state, home counts, windowed lists, and public-payload privacy.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices, type Services } from "@/lib/services";
import { createAdminReviewService, type AdminReviewService } from "@/lib/admin/review-service";
import * as reviewRepo from "@/lib/repositories/admin";
import * as farmRepo from "@/lib/repositories/farm-submissions";
import { readSnapshotRows } from "@/lib/repositories/snapshot";
import { snapshotRows } from "@/lib/repositories/sync";
import { SNAPSHOT_ALLOWLIST } from "@/lib/repositories/snapshot-allowlist";
import { ADMIN_ROUTES } from "@/lib/api/ingest-admin-routes";
import { normalizeName } from "@/lib/names";
import type { DuplicateHoldBody } from "@/lib/services/admin";

let t: TestD1;
let s: Services;
let review: AdminReviewService;
const clock = { t: Date.parse("2026-11-21T10:00:00.000Z") };
const now = () => new Date(clock.t);
const iso = () => now().toISOString();
const advance = (ms: number) => {
  clock.t += ms;
};
const raw = (sql: string, ...binds: unknown[]) => t.env.DB.prepare(sql).bind(...binds);

const REVIEWER = { role: "reviewer", decider: { userId: 101, name: "Rae Reviewer" } };
const ADMIN = { role: "admin", decider: { userId: 102, name: "Ann Admin" } };

let songbirdId = 0;
let songbirdDomain = "";
let sunsetId = 0;
let chantillyId = 0;

function listingProposal(varietyId: number | null, crop: string | null, extracted: string, tag: string) {
  return {
    observation_id: 1,
    seller_id: songbirdId,
    seller_slug: "songbird-seed-co",
    variety_id: varietyId,
    crop,
    extracted_name: extracted,
    normalized_name: normalizeName(extracted, null),
    listing: {
      sellerId: songbirdId,
      productUrl: `https://${songbirdDomain}/p/${tag}`,
      variantKey: "",
      externalProductId: null,
      titleRaw: `${extracted} Seeds`,
      availability: "in_stock",
      sourceUrl: `https://${songbirdDomain}/p/${tag}`,
      checkedAt: iso(),
    },
    match: { variety_id: varietyId, method: "model", confidence: 0.82 },
  };
}

function holdBody(over: Partial<DuplicateHoldBody> = {}): DuplicateHoldBody {
  return {
    held_name: "Chantilly Pink",
    crop: "snapdragon",
    seller_id: songbirdId,
    seller_slug: "songbird-seed-co",
    listing: { productUrl: `https://${songbirdDomain}/p/chantilly-pink`, titleRaw: "Chantilly Pink Snapdragon Seeds", availability: "in_stock", checkedAt: iso() },
    candidate: { variety_id: chantillyId, name: "Chantilly Light Pink", slug: "snapdragon-chantilly-light-pink" },
    evidence_quote: "sold side by side with Chantilly Light Pink",
    hold_reason: "Possible duplicate of Chantilly Light Pink",
    source: "scout",
    ...over,
  };
}

async function farmSubmission(tag: string) {
  return farmRepo.insertFarmSubmission(t.db, {
    farmName: `Test Farm ${tag}`,
    contactName: "F Ann",
    contactEmail: `fann-${tag}@example.com`,
    city: "Springfield",
    state: "OR",
    website: `https://${tag}.example-farm.test`,
    growsText: "We grow zinnias.",
    varietiesText: "Dearest Sunset",
    authorized: true,
    businessPhone: "5415550199",
    turnstile: "dev_bypass",
    status: "pending",
    createdAt: iso(),
    draftStatus: "pending",
  });
}

beforeAll(async () => {
  t = await createTestD1();
  s = createServices(t.db, { now });
  review = createAdminReviewService(t.db, { now });
  songbirdId = (await raw("SELECT id FROM sellers WHERE slug = 'songbird-seed-co'").first<{ id: number }>())!.id;
  songbirdDomain = (await raw("SELECT domain FROM sellers WHERE id = ?", songbirdId).first<{ domain: string }>())!.domain;
  sunsetId = (await raw("SELECT id FROM varieties WHERE slug = 'zinnia-dearest-sunset'").first<{ id: number }>())!.id;
  chantillyId = (await raw("SELECT id FROM varieties WHERE slug = 'snapdragon-chantilly-light-pink'").first<{ id: number }>())!.id;
}, 180_000);

afterAll(async () => {
  await t.dispose();
});

describe("migration 0013: the decider trail, duplicate_hold, alias provenance", () => {
  it("all six types insert; the new columns default NULL; bad types are rejected", async () => {
    for (const type of ["listing_match", "new_variety", "seller_candidate", "seller_correction", "removal", "duplicate_hold"] as const) {
      const id = await reviewRepo.insertReviewItem(t.db, { type, groupKey: `m13-${type}`, proposal: { probe: true }, reason: null, confidence: null, at: iso() });
      const row = await raw("SELECT decided_by_user_id, decided_by_name, verified_by_name, verified_at, seen_by_name, seen_at FROM review_items WHERE id = ?", id).first<Record<string, null>>();
      expect(row).toEqual({ decided_by_user_id: null, decided_by_name: null, verified_by_name: null, verified_at: null, seen_by_name: null, seen_at: null });
    }
    const sunsetProbe = (await raw("SELECT id FROM varieties WHERE slug = 'zinnia-dearest-sunset'").first<{ id: number }>())!.id;
    await reviewRepo.addAlias(t.db, sunsetProbe, "M13 Probe Alias", "synonym", "Zinnia");
    const alias = await raw("SELECT source, decision_item_id, decided_by_name, created_at FROM variety_aliases WHERE variety_id = ? AND alias = ?", sunsetProbe, "M13 Probe Alias").first<Record<string, null>>();
    expect(alias).toEqual({ source: null, decision_item_id: null, decided_by_name: null, created_at: null });
    await raw("DELETE FROM variety_aliases WHERE variety_id = ? AND alias = ?", sunsetProbe, "M13 Probe Alias").run();
    await expect(raw("INSERT INTO review_items (type, group_key, proposal, created_at) VALUES ('bogus', 'x', '{}', ?)", iso()).run()).rejects.toThrow();
  });

  it("the rebuild is lossless on a seeded pre-0013 database (real migration files, before/after)", async () => {
    // Stage migrations 0000–0012 in a temp dir behind a temp wrangler config, apply, seed
    // every legacy type × mixed statuses, then add 0013 and re-apply: row count and a
    // sample of full rows must be identical across it.
    const stage = mkdtempSync(join(tmpdir(), "seeds-m13-stage-"));
    const migDir = join(stage, "migrations");
    mkdirSync(migDir);
    for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql") && f !== "0013_admin_review.sql")) copyFileSync(join("migrations", f), join(migDir, f));
    const configPath = join(stage, "wrangler.m13.jsonc");
    writeFileSync(configPath, JSON.stringify({ name: "seeds-m13", compatibility_date: "2026-11-01", d1_databases: [{ binding: "DB", database_name: "m13", database_id: "m13", migrations_dir: "migrations" }] }));
    const persist = mkdtempSync(join(tmpdir(), "seeds-m13-d1-"));
    const wranglerBin = join(process.cwd(), "node_modules/wrangler/bin/wrangler.js");
    const applyEnv = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" };
    try {
      execFileSync(process.execPath, [wranglerBin, "d1", "migrations", "apply", "DB", "--local", "--persist-to", persist, "--config", configPath], { stdio: "pipe", env: applyEnv, cwd: stage });
      const proxy = await getPlatformProxy<CloudflareEnv>({ configPath, persist: { path: join(persist, "v3") } });
      try {
        const OLD_COLS = "id, type, group_key, proposal, reason, confidence, status, created_at, resolved_at";
        const seed = [
          ["listing_match", "pending", "g1", '{"a":1}', null, 0.9, "2026-11-18T10:00:00.000Z", null],
          ["listing_match", "approved", "g1", '{"a":2}', "model_match", 0.9, "2026-11-18T11:00:00.000Z", "2026-11-19T10:00:00.000Z"],
          ["new_variety", "pending", "blue fire", '{"crop":"zinnia"}', "no_match", 0.2, "2026-11-17T10:00:00.000Z", null],
          ["seller_candidate", "rejected", "x.example", '{"name":"X"}', null, null, "2026-11-16T10:00:00.000Z", "2026-11-17T10:00:00.000Z"],
          ["seller_correction", "pending", "seller:geoseed", '{"report_id":1}', "report:correct", null, "2026-11-15T10:00:00.000Z", null],
          ["seller_correction", "merged", "seller:geoseed", '{"report_id":2}', "report:correct", null, "2026-11-14T10:00:00.000Z", "2026-11-15T10:00:00.000Z"],
          ["removal", "pending", "seller:old", '{"report_id":3}', "report:remove", null, "2026-11-13T10:00:00.000Z", null],
        ];
        for (const [type, status, groupKey, proposal, reason, confidence, created, resolved] of seed) {
          await proxy.env.DB.prepare("INSERT INTO review_items (type, status, group_key, proposal, reason, confidence, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(type, status, groupKey, proposal, reason, confidence, created, resolved)
            .run();
        }
        const before = await proxy.env.DB.prepare(`SELECT ${OLD_COLS} FROM review_items ORDER BY id`).all<Record<string, unknown>>();
        expect(before.results).toHaveLength(seed.length);
        copyFileSync(join("migrations", "0013_admin_review.sql"), join(migDir, "0013_admin_review.sql"));
        execFileSync(process.execPath, [wranglerBin, "d1", "migrations", "apply", "DB", "--local", "--persist-to", persist, "--config", configPath], { stdio: "pipe", env: applyEnv, cwd: stage });
        const after = await proxy.env.DB.prepare(`SELECT ${OLD_COLS} FROM review_items ORDER BY id`).all<Record<string, unknown>>();
        expect(after.results).toHaveLength(before.results.length);
        expect(after.results).toEqual(before.results);
        // New columns exist and read NULL for the carried rows; the indexes survived.
        const carried = await proxy.env.DB.prepare("SELECT decided_by_user_id, verified_by_name, seen_at FROM review_items ORDER BY id LIMIT 2").all<Record<string, null>>();
        expect(carried.results).toEqual([
          { decided_by_user_id: null, verified_by_name: null, seen_at: null },
          { decided_by_user_id: null, verified_by_name: null, seen_at: null },
        ]);
        const indexes = await proxy.env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'review_items' AND name LIKE 'review_items\\_%' ESCAPE '\\' ORDER BY name").all<{ name: string }>();
        expect(indexes.results.map((r) => r.name).sort()).toEqual(["review_items_group_idx", "review_items_status_type_idx"]);
        // The extended check accepts the new type and still rejects garbage.
        await proxy.env.DB.prepare("INSERT INTO review_items (type, group_key, proposal, created_at) VALUES ('duplicate_hold', 'x', '{}', ?)").bind(iso()).run();
        await expect(proxy.env.DB.prepare("INSERT INTO review_items (type, group_key, proposal, created_at) VALUES ('bogus', 'x', '{}', ?)").bind(iso()).run()).rejects.toThrow();
      } finally {
        await proxy.dispose();
      }
    } finally {
      rmSync(stage, { recursive: true, force: true });
      rmSync(persist, { recursive: true, force: true });
    }
  }, 180_000);
});

describe("decider threading", () => {
  it("the key-based path resolves with no decider and behaves exactly as before", async () => {
    const a = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "keypath-a.example", proposal: { name: "Keypath A", website_url: "https://keypath-a.example", domain: "keypath-a.example" }, reason: null, confidence: null, at: iso() });
    const r = await s.admin.approve(a, {});
    expect(r.data).toMatchObject({ status: "approved", eligibility: "candidate" });
    const row = await reviewRepo.reviewItemById(t.db, a);
    expect(row?.status).toBe("approved");
    expect(row?.decidedByUserId).toBeNull();
    expect(row?.decidedByName).toBeNull();
    expect(row?.resolvedAt).toBe(iso());
    const b = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "keypath-b.example", proposal: { name: "Keypath B", website_url: "https://keypath-b.example", domain: "keypath-b.example" }, reason: null, confidence: null, at: iso() });
    await s.admin.reject(b);
    const rowB = await reviewRepo.reviewItemById(t.db, b);
    expect(rowB?.status).toBe("rejected");
    expect(rowB?.decidedByUserId).toBeNull();
    expect(rowB?.decidedByName).toBeNull();
    expect(rowB?.reason).toBeNull();
  });

  it("the UI path stamps decider id + name + resolved_at together", async () => {
    advance(1000);
    const a = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "uipath-a.example", proposal: { name: "Uipath A", website_url: "https://uipath-a.example", domain: "uipath-a.example" }, reason: null, confidence: null, at: iso() });
    await review.approveSellerCandidate(a, REVIEWER);
    const row = await reviewRepo.reviewItemById(t.db, a);
    expect(row).toMatchObject({ status: "approved", decidedByUserId: 101, decidedByName: "Rae Reviewer", resolvedAt: iso() });
    const b = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "uipath-b.example", proposal: { name: "Uipath B", website_url: "https://uipath-b.example", domain: "uipath-b.example" }, reason: null, confidence: null, at: iso() });
    await review.declineSellerCandidate(b, ADMIN, "not a seed seller");
    const rowB = await reviewRepo.reviewItemById(t.db, b);
    expect(rowB).toMatchObject({ status: "rejected", decidedByUserId: 102, decidedByName: "Ann Admin", resolvedAt: iso(), reason: "not a seed seller" });
  });
});

describe("the scout-holds feed", () => {
  it("creates a pending hold, and re-submits return the existing item (no second row)", async () => {
    advance(1000);
    const first = await s.admin.createDuplicateHold(holdBody());
    expect(first).toMatchObject({ type: "duplicate_hold", status: "pending", created: true });
    const item = await reviewRepo.reviewItemById(t.db, first.id);
    expect(item?.groupKey).toBe(normalizeName("Chantilly Pink", "Snapdragon"));
    // Same pair in different spacing/case normalizes to the same hold.
    const again = await s.admin.createDuplicateHold(holdBody({ held_name: "  CHANTILLY pink " }));
    expect(again).toEqual({ id: first.id, type: "duplicate_hold", status: "pending", created: false });
    const n = await raw("SELECT COUNT(*) n FROM review_items WHERE type = 'duplicate_hold' AND group_key = ?", item!.groupKey).first<{ n: number }>();
    expect(n!.n).toBe(1);
    expect(first.id).toBeGreaterThan(0);
  });

  it("refuses an inactive candidate and an unknown seller", async () => {
    await expect(s.admin.createDuplicateHold(holdBody({ candidate: { variety_id: 999999, name: "Nope" } }))).rejects.toMatchObject({ status: 422, code: "unknown_candidate" });
    await expect(s.admin.createDuplicateHold(holdBody({ seller_id: 999999 }))).rejects.toMatchObject({ status: 422, code: "unknown_seller" });
  });

  it("is registered on the key-based admin API as admin POST review/duplicate-holds", () => {
    const spec = ADMIN_ROUTES.find((r) => r.pattern === "review/duplicate-holds");
    expect(spec).toMatchObject({ method: "POST", scope: "admin" });
  });
});

describe("duplicate decisions", () => {
  it("duplicate: synonym alias + provenance, the listing publishes, merged, searchable", async () => {
    advance(1000);
    const held = "Chantilly Cream";
    const { id } = await s.admin.createDuplicateHold(holdBody({ held_name: held, listing: { productUrl: `https://${songbirdDomain}/p/chantilly-cream`, titleRaw: "Chantilly Cream Snapdragon Seeds", availability: "in_stock", checkedAt: iso() } }));
    const r = await review.decideDuplicate(id, "duplicate", REVIEWER);
    expect(r.data).toMatchObject({ status: "merged", held_name: held, existing: "Chantilly Light Pink" });
    expect(r.revalidate).toContain("/variety/snapdragon-chantilly-light-pink");
    const item = await reviewRepo.reviewItemById(t.db, id);
    expect(item).toMatchObject({ status: "merged", decidedByUserId: 101, decidedByName: "Rae Reviewer" });
    const alias = await reviewRepo.aliasRow(t.db, chantillyId, held);
    expect(alias).toMatchObject({ kind: "synonym", nameNormalized: normalizeName(held, "Snapdragon"), source: "duplicate_decision", decisionItemId: id, decidedByName: "Rae Reviewer" });
    // The hold's listing is on the candidate variety now (guards + effects of publish).
    const v = (await s.catalog.getVariety("snapdragon-chantilly-light-pink"))!;
    const listing = v.listings.find((l) => l.productUrl === `https://${songbirdDomain}/p/chantilly-cream`);
    expect(listing).toMatchObject({ seller: { slug: "songbird-seed-co" }, provenance: { method: "human", confidence: 1 } });
    // …and the held name finds the variety through public search (the FTS alias match).
    const found = await s.catalog.search("chantilly cream", { limit: 10 });
    expect(found.varieties.map((x) => x.slug)).toContain("snapdragon-chantilly-light-pink");
  });

  it("duplicate twice on one name fills provenance instead of duplicating the alias", async () => {
    advance(1000);
    // A legacy/manual alias row for the held name (no provenance) predates the decision.
    await reviewRepo.addAlias(t.db, chantillyId, "Chantilly Legacy", "synonym", "Snapdragon");
    expect((await reviewRepo.aliasRow(t.db, chantillyId, "Chantilly Legacy"))?.source).toBeNull();
    const { id } = await s.admin.createDuplicateHold(holdBody({ held_name: "Chantilly Legacy", listing: { productUrl: `https://${songbirdDomain}/p/chantilly-legacy`, checkedAt: iso() } }));
    await review.decideDuplicate(id, "duplicate", ADMIN);
    const alias = await reviewRepo.aliasRow(t.db, chantillyId, "Chantilly Legacy");
    expect(alias).toMatchObject({ source: "duplicate_decision", decisionItemId: id, decidedByName: "Ann Admin" });
    const n = await raw("SELECT COUNT(*) n FROM variety_aliases WHERE variety_id = ? AND alias = ?", chantillyId, "Chantilly Legacy").first<{ n: number }>();
    expect(n!.n).toBe(1);
  });

  it("not-a-duplicate: the variety is created from held name + crop, listing on it, approved", async () => {
    advance(1000);
    const held = "Blue Testfire";
    const { id } = await s.admin.createDuplicateHold(holdBody({ held_name: held, crop: "zinnia", listing: { productUrl: `https://${songbirdDomain}/p/blue-testfire`, titleRaw: "Blue Testfire Zinnia Seeds", availability: "in_stock", checkedAt: iso() } }));
    const r = await review.decideDuplicate(id, "not_duplicate", REVIEWER);
    expect(r.data).toMatchObject({ status: "approved", held_name: held });
    const slug = String(r.data.variety_slug);
    expect(slug).toBe("zinnia-blue-testfire");
    expect(r.revalidate).toContain(`/variety/${slug}`);
    const v = (await s.catalog.getVariety(slug))!;
    expect(v.varietyName).toBe(held);
    expect(v.listings.map((l) => l.productUrl)).toContain(`https://${songbirdDomain}/p/blue-testfire`);
    const item = await reviewRepo.reviewItemById(t.db, id);
    expect(item).toMatchObject({ status: "approved", decidedByName: "Rae Reviewer" });
  });

  it("the key-based path refuses to approve a hold: still pending, no variety, no alias, no listing", async () => {
    advance(1000);
    const held = "Keypath Refused";
    const productUrl = `https://${songbirdDomain}/p/keypath-refused`;
    const { id } = await s.admin.createDuplicateHold(holdBody({ held_name: held, crop: "zinnia", listing: { productUrl, checkedAt: iso() } }));
    await expect(s.admin.approve(id, {})).rejects.toMatchObject({ status: 422, code: "duplicate_hold_ui_only", message: expect.stringContaining("admin UI") });
    // Nothing decided, nothing created: the item is pending exactly as submitted.
    expect(await reviewRepo.reviewItemById(t.db, id)).toMatchObject({ type: "duplicate_hold", status: "pending", decidedByUserId: null, decidedByName: null, resolvedAt: null });
    expect(await s.catalog.getVariety("zinnia-keypath-refused")).toBeNull();
    expect(await reviewRepo.aliasRow(t.db, chantillyId, held)).toBeNull();
    expect(await raw("SELECT id FROM listings WHERE product_url = ?", productUrl).first()).toBeNull();
  });

  it("the key-based path refuses to reject a hold: still pending", async () => {
    advance(1000);
    const { id } = await s.admin.createDuplicateHold(holdBody({ held_name: "Keypath Reject Refused", listing: { productUrl: `https://${songbirdDomain}/p/keypath-reject-refused`, checkedAt: iso() } }));
    await expect(s.admin.reject(id)).rejects.toMatchObject({ status: 422, code: "duplicate_hold_ui_only", message: expect.stringContaining("admin UI") });
    expect(await reviewRepo.reviewItemById(t.db, id)).toMatchObject({ type: "duplicate_hold", status: "pending", decidedByUserId: null, decidedByName: null, resolvedAt: null });
  });

  it("other queue types still approve AND reject through the key API (the refusal is type-scoped)", async () => {
    advance(1000);
    // new_variety approve still creates the variety — the effect approve-on-hold no longer has.
    const nv = await reviewRepo.insertReviewItem(t.db, { type: "new_variety", groupKey: "keypath-scope-new", proposal: listingProposal(null, "zinnia", "Keypath Scoped", "keypath-scope-new"), reason: "no_match", confidence: 0.2, at: iso() });
    const created = await s.admin.approve(nv, {});
    expect(created.data).toMatchObject({ status: "approved", variety_slug: "zinnia-keypath-scoped" });
    expect((await s.catalog.getVariety("zinnia-keypath-scoped"))!.varietyName).toBe("Keypath Scoped");
    // …and a queued listing still rejects.
    const lm = await reviewRepo.insertReviewItem(t.db, { type: "listing_match", groupKey: "keypath-scope-reject", proposal: listingProposal(sunsetId, "zinnia", "Dearest Sunset", "keypath-scope-reject"), reason: "model_match", confidence: 0.4, at: iso() });
    await s.admin.reject(lm);
    expect((await reviewRepo.reviewItemById(t.db, lm))?.status).toBe("rejected");
  });

  it("a merged-away candidate refuses the duplicate outcome; the detail follows the chain", async () => {
    advance(1000);
    // Retire a spare variety by merging it into the sunset, then hold against the loser.
    const loserId = (await raw("SELECT id FROM varieties WHERE slug = 'zinnia-dearest-tabita'").first<{ id: number }>())!.id;
    await reviewRepo.mergeVarieties(t.db, loserId, sunsetId, iso());
    const { id } = await s.admin.createDuplicateHold(
      holdBody({ held_name: "Doomed Hold", crop: "zinnia", candidate: { variety_id: sunsetId, name: "Dearest Sunset" }, listing: { productUrl: `https://${songbirdDomain}/p/doomed-hold`, checkedAt: iso() } }),
    );
    // Rewrite the hold's candidate to the merged loser (the race the guard exists for).
    const p = (await reviewRepo.reviewItemById(t.db, id))!.proposal;
    (p.candidate as Record<string, unknown>).variety_id = loserId;
    await raw("UPDATE review_items SET proposal = ? WHERE id = ?", JSON.stringify(p), id).run();
    await expect(review.decideDuplicate(id, "duplicate", ADMIN)).rejects.toMatchObject({ status: 409, code: "variety_changed" });
    expect((await reviewRepo.reviewItemById(t.db, id))?.status).toBe("pending");
    // The feed itself refuses a merged candidate.
    await expect(s.admin.createDuplicateHold(holdBody({ held_name: "Doomed Hold 2", candidate: { variety_id: loserId, name: "Dearest Tabita" } }))).rejects.toMatchObject({ code: "unknown_candidate" });
    // …while the pane follows the chain to the survivor instead of dead-ending.
    const d = await review.detail({ kind: "review", id });
    if (!d || d.type !== "duplicate_hold") throw new Error("expected the hold detail");
    expect(d.stale).toBe(true);
    expect(d.existing?.slug).toBe("zinnia-dearest-sunset");
  });
});

describe("windowed queue reads", () => {
  it("returns at most the window with exact totals, oldest-first, stable across windows", async () => {
    const tag = "windowprobe";
    const ids: number[] = [];
    for (let i = 0; i < 30; i++) {
      advance(1000);
      ids.push(await reviewRepo.insertReviewItem(t.db, { type: "listing_match", groupKey: `${tag}-${i}`, proposal: listingProposal(sunsetId, "zinnia", `Window Probe ${i}`, `${tag}-${i}`), reason: "model_match", confidence: 0.8, at: iso() }));
    }
    const w10 = await review.waitingList("listings", 10);
    const w25 = await review.waitingList("listings", 25);
    expect(w10.rows.length).toBeLessThanOrEqual(10);
    expect(w25.rows.length).toBeLessThanOrEqual(25);
    expect(w10.total).toBe(w25.total);
    expect(w10.total).toBeGreaterThanOrEqual(30);
    // Oldest-first…
    const ats = w25.rows.map((r) => r.createdAt);
    expect([...ats].sort()).toEqual(ats);
    // …and stable: the small window is the large window's prefix (no repeats, no skips).
    expect(w25.rows.slice(0, w10.rows.length).map((r) => r.ref.id)).toEqual(w10.rows.map((r) => r.ref.id));
    const w50 = await review.waitingList("listings", 50);
    expect(w50.rows.slice(0, w25.rows.length).map((r) => r.ref.id)).toEqual(w25.rows.map((r) => r.ref.id));
    const seen = new Set(w50.rows.map((r) => `${r.ref.kind}-${r.ref.id}`));
    expect(seen.size).toBe(w50.rows.length);
    // The probes arrived oldest-first among themselves.
    const probeRows = w50.rows.filter((r) => ids.includes(r.ref.id));
    expect(probeRows.map((r) => r.ref.id)).toEqual(ids);
  });

  it("ranks the oldest waiting item first, advances past a cursor, and locates deep links", async () => {
    const { rows } = await review.waitingList("duplicates", 25);
    expect(rows.length).toBeGreaterThan(0);
    const first = rows[0]!;
    expect(await review.rank("duplicates", first.ref)).toMatchObject({ rank: 1 });
    const next = await review.selectedAfter("duplicates", { createdAt: first.createdAt, kind: first.ref.kind, id: first.ref.id }, 25);
    expect(next?.ref).toEqual(rows[1]?.ref ?? rows[0]?.ref ?? null);
    expect(await review.locate(first.ref)).toEqual({ status: "pending" });
    expect(await review.locate({ kind: "review", id: 999999 })).toEqual({ status: "missing" });
    // A decided item resolves through its trail.
    const decided = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "locate-decided.example", proposal: { name: "Locate Decided" }, reason: null, confidence: null, at: iso() });
    await review.declineSellerCandidate(decided, REVIEWER);
    expect(await review.locate({ kind: "review", id: decided })).toEqual({ status: "decided", decidedByName: "Rae Reviewer" });
    expect(await review.rank("duplicates", { kind: "review", id: decided })).toBeNull();
  });
});

describe("reviewer powers", () => {
  it("approves a seller candidate and publishes a queued listing", async () => {
    advance(1000);
    const c = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "reviewer-power.example", proposal: { name: "Reviewer Power Farm", website_url: "https://reviewer-power.example", domain: "reviewer-power.example" }, reason: null, confidence: null, at: iso() });
    const created = await review.approveSellerCandidate(c, REVIEWER);
    expect(created.data).toMatchObject({ eligibility: "candidate" });
    expect((await reviewRepo.reviewItemById(t.db, c))?.decidedByName).toBe("Rae Reviewer");
    const l = await reviewRepo.insertReviewItem(t.db, { type: "listing_match", groupKey: "reviewer-publish", proposal: listingProposal(sunsetId, "zinnia", "Dearest Sunset", "reviewer-publish"), reason: "model_match", confidence: 0.9, at: iso() });
    const pub = await review.publishListing(l, REVIEWER);
    expect(pub.data).toMatchObject({ status: "approved", variety_slug: "zinnia-dearest-sunset" });
    expect(pub.revalidate).toContain("/variety/zinnia-dearest-sunset");
    expect((await s.catalog.getVariety("zinnia-dearest-sunset"))!.listings.map((x) => x.productUrl)).toContain(`https://${songbirdDomain}/p/reviewer-publish`);
  });

  it("rejects a queued listing with its reason kept on the record", async () => {
    advance(1000);
    const l = await reviewRepo.insertReviewItem(t.db, { type: "listing_match", groupKey: "reviewer-reject", proposal: listingProposal(sunsetId, "zinnia", "Dearest Sunset", "reviewer-reject"), reason: "model_match", confidence: 0.4, at: iso() });
    await review.rejectQueuedListing(l, REVIEWER, "Wrong variety — actually a marigold");
    expect(await reviewRepo.reviewItemById(t.db, l)).toMatchObject({ status: "rejected", decidedByName: "Rae Reviewer", reason: "Wrong variety — actually a marigold" });
  });

  it("applies a structured seller correction immediately (RA-3), decider stamped", async () => {
    advance(1000);
    const c = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "correction-target.example", proposal: { name: "Correction Target", website_url: "https://correction-target.example", domain: "correction-target.example" }, reason: null, confidence: null, at: iso() });
    const slug = String((await review.approveSellerCandidate(c, ADMIN)).data.seller_slug);
    const item = await reviewRepo.insertReviewItem(t.db, {
      type: "seller_correction",
      groupKey: `seller:${slug}`,
      proposal: { report: { type: "correct", target_type: "seller", target_ref: slug, message: "We moved down the road." }, fields: { location: "Greenwood, SC" } },
      reason: "report:correct",
      confidence: null,
      at: iso(),
    });
    const r = await review.applyCorrection(item, REVIEWER);
    expect(r.data).toMatchObject({ status: "approved", seller: slug, applied: ["location"] });
    expect((await raw("SELECT location FROM sellers WHERE slug = ?", slug).first<{ location: string }>())!.location).toBe("Greenwood, SC");
    expect(await reviewRepo.reviewItemById(t.db, item)).toMatchObject({ status: "approved", decidedByUserId: 101, decidedByName: "Rae Reviewer" });
  });

  it("dismisses a report, and confirms one with the verified stamp while it stays pending", async () => {
    advance(1000);
    const d = await reviewRepo.insertReviewItem(t.db, { type: "removal", groupKey: "seller:songbird-seed-co", proposal: { report: { type: "remove", target_type: "seller", target_ref: "songbird-seed-co", message: "Please remove us." } }, reason: "report:remove", confidence: null, at: iso() });
    await review.dismissReport(d, REVIEWER, "seller confirmed they stay");
    expect(await reviewRepo.reviewItemById(t.db, d)).toMatchObject({ status: "rejected", decidedByName: "Rae Reviewer", reason: "seller confirmed they stay" });
    const f = await reviewRepo.insertReviewItem(t.db, { type: "seller_correction", groupKey: "seller:songbird-seed-co", proposal: { report: { type: "correct", target_type: "seller", target_ref: "songbird-seed-co", message: "Our hours changed." } }, reason: "report:correct", confidence: null, at: iso() });
    const confirmed = await review.confirmReport(f, REVIEWER);
    expect(confirmed.data).toMatchObject({ status: "pending", verified_by: "Rae Reviewer" });
    const row = await reviewRepo.reviewItemById(t.db, f);
    expect(row).toMatchObject({ status: "pending", verifiedByName: "Rae Reviewer", verifiedAt: iso() });
    // …and the verified line renders in the row and the detail.
    const { rows } = await review.waitingList("reports", 50);
    expect(rows.find((r) => r.ref.id === f)?.verifiedBy).toBe("Rae Reviewer");
    const detail = await review.detail({ kind: "review", id: f });
    if (!detail || detail.type !== "seller_correction") throw new Error("expected the report detail");
    expect(detail.verifiedBy).toBe("Rae Reviewer");
  });

  it("refuses to apply a free-form correction (nothing structured to apply)", async () => {
    advance(1000);
    const f = await reviewRepo.insertReviewItem(t.db, { type: "seller_correction", groupKey: "seller:songbird-seed-co", proposal: { report: { type: "correct", target_type: "seller", target_ref: "songbird-seed-co", message: "Something is off." } }, reason: "report:correct", confidence: null, at: iso() });
    await expect(review.applyCorrection(f, ADMIN)).rejects.toMatchObject({ status: 422, code: "no_fields" });
    expect((await reviewRepo.reviewItemById(t.db, f))?.status).toBe("pending");
  });

  it("skips a hold: recorded as seen, never as decided", async () => {
    advance(1000);
    const { id } = await s.admin.createDuplicateHold(holdBody({ held_name: "Skipped Hold", listing: { productUrl: `https://${songbirdDomain}/p/skipped-hold`, checkedAt: iso() } }));
    await review.skipHold(id, REVIEWER);
    expect(await reviewRepo.reviewItemById(t.db, id)).toMatchObject({ status: "pending", seenByName: "Rae Reviewer", seenAt: iso(), decidedByName: null });
  });
});

describe("reviewer limits (server-side)", () => {
  it("a reviewer removal-approve and retire-from-report are refused with no state change", async () => {
    advance(1000);
    const c = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "removal-target.example", proposal: { name: "Removal Target", website_url: "https://removal-target.example", domain: "removal-target.example" }, reason: null, confidence: null, at: iso() });
    const slug = String((await review.approveSellerCandidate(c, ADMIN)).data.seller_slug);
    const removal = await reviewRepo.insertReviewItem(t.db, { type: "removal", groupKey: `seller:${slug}`, proposal: { report: { type: "remove", target_type: "seller", target_ref: slug, message: "Please remove us." } }, reason: "report:remove", confidence: null, at: iso() });
    await expect(review.applyRemoval(removal, REVIEWER)).rejects.toMatchObject({ status: 403 });
    expect((await reviewRepo.reviewItemById(t.db, removal))?.status).toBe("pending");
    expect((await raw("SELECT eligibility FROM sellers WHERE slug = ?", slug).first<{ eligibility: string }>())!.eligibility).toBe("candidate");
    // A live listing routed from a report stays live under a reviewer hand.
    const l = await reviewRepo.insertReviewItem(t.db, { type: "listing_match", groupKey: "retire-target", proposal: listingProposal(sunsetId, "zinnia", "Dearest Sunset", "retire-target"), reason: "model_match", confidence: 0.9, at: iso() });
    const listingId = Number((await review.publishListing(l, ADMIN)).data.listing_id);
    const report = await reviewRepo.insertReviewItem(t.db, { type: "seller_correction", groupKey: "seller:songbird-seed-co", proposal: { report: { type: "correct", target_type: "seller", target_ref: "songbird-seed-co", message: "That listing is wrong." }, listing_id: listingId }, reason: "report:correct", confidence: null, at: iso() });
    await expect(review.retireFromReport(report, listingId, "Wrong variety", REVIEWER)).rejects.toMatchObject({ status: 403 });
    expect((await raw("SELECT status FROM listings WHERE id = ?", listingId).first<{ status: string }>())!.status).toBe("published");
    expect((await reviewRepo.reviewItemById(t.db, report))?.status).toBe("pending");
  });
});

describe("admin-only report remedies", () => {
  it("applies a removal: the seller leaves, the report resolves with the decider", async () => {
    advance(1000);
    const c = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "gone-seller.example", proposal: { name: "Gone Seller", website_url: "https://gone-seller.example", domain: "gone-seller.example" }, reason: null, confidence: null, at: iso() });
    const slug = String((await review.approveSellerCandidate(c, ADMIN)).data.seller_slug);
    const removal = await reviewRepo.insertReviewItem(t.db, { type: "removal", groupKey: `seller:${slug}`, proposal: { report_id: 4242, report: { type: "remove", target_type: "seller", target_ref: slug, message: "Please remove us." } }, reason: "report:remove", confidence: null, at: iso() });
    const r = await review.applyRemoval(removal, ADMIN);
    expect(r.data).toMatchObject({ seller: slug, eligibility: "removed_by_request" });
    expect((await reviewRepo.reviewItemById(t.db, removal))).toMatchObject({ status: "approved", decidedByName: "Ann Admin" });
    expect((await raw("SELECT reason FROM blocked_domains WHERE domain = 'gone-seller.example'").first())).toBeTruthy();
  });

  it("retires the report's own listing — and only that listing", async () => {
    advance(1000);
    const l = await reviewRepo.insertReviewItem(t.db, { type: "listing_match", groupKey: "retire-ok", proposal: listingProposal(sunsetId, "zinnia", "Dearest Sunset", "retire-ok"), reason: "model_match", confidence: 0.9, at: iso() });
    const listingId = Number((await review.publishListing(l, ADMIN)).data.listing_id);
    const report = await reviewRepo.insertReviewItem(t.db, { type: "seller_correction", groupKey: "seller:songbird-seed-co", proposal: { report: { type: "correct", target_type: "seller", target_ref: "songbird-seed-co", message: "Dead link." }, listing_id: listingId }, reason: "report:correct", confidence: null, at: iso() });
    await expect(review.retireFromReport(report, listingId + 9999, "Dead link", ADMIN)).rejects.toMatchObject({ status: 422, code: "wrong_listing" });
    const r = await review.retireFromReport(report, listingId, "Dead link", ADMIN);
    expect(r.data).toMatchObject({ status: "approved", listing_id: listingId });
    expect((await raw("SELECT status FROM listings WHERE id = ?", listingId).first<{ status: string }>())!.status).toBe("removed");
    expect(await reviewRepo.reviewItemById(t.db, report)).toMatchObject({ status: "approved", decidedByName: "Ann Admin" });
  });
});

describe("the farm stream", () => {
  it("approves a submission into a candidate seller, linked and stamped, flag untouched", async () => {
    advance(1000);
    const { insertUser, userById } = await import("@/lib/repositories/accounts");
    const user = (await insertUser(t.db, { email: "farmer-flag@example.com", name: "F Armer", phone: "5415550142", zip: "97448", usdaZone: "8b", role: "visitor" }))!;
    const sub = await farmSubmission("flagcheck");
    await farmRepo.updateFarmSubmission(t.db, sub.id, { userId: user.id });
    const r = await review.approveFarm(sub.id, ADMIN);
    expect(r.data).toMatchObject({ status: "approved", farm_name: sub.farmName });
    expect(r.revalidate).toEqual([]);
    const slug = String(r.data.seller_slug);
    expect(slug.length).toBeGreaterThan(0);
    const after = (await farmRepo.farmSubmissionById(t.db, sub.id))!;
    expect(after).toMatchObject({ status: "approved", reviewedBy: "Ann Admin", reviewedAt: iso(), sellerId: Number(r.data.seller_id) });
    expect((await raw("SELECT eligibility FROM sellers WHERE id = ?", after.sellerId).first<{ eligibility: string }>())!.eligibility).toBe("candidate");
    // Farm-owner semantics do not change in this queue (Slice C's G2 owns the flag).
    expect(await userById(t.db, user.id)).toMatchObject({ isFarmOwner: false, sellerId: null });
  });

  it("declines a submission with its reason kept in decision_note", async () => {
    advance(1000);
    const sub = await farmSubmission("declined");
    await review.declineFarm(sub.id, REVIEWER, "not a working farm");
    expect(await farmRepo.farmSubmissionById(t.db, sub.id)).toMatchObject({ status: "rejected", reviewedBy: "Rae Reviewer", reviewedAt: iso(), decisionNote: "not a working farm" });
  });

  it("folds hunt and farm streams oldest-first with exact totals", async () => {
    advance(1000);
    const before = await review.waitingTotal("sellers");
    const cAt = iso();
    advance(1000);
    const c = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "interleave.example", proposal: { name: "Interleave Farm", website_url: "https://interleave.example", domain: "interleave.example" }, reason: null, confidence: null, at: cAt });
    const fAt = iso();
    const sub = await farmSubmission("interleave");
    const { rows, total } = await review.waitingList("sellers", 100);
    expect(total).toBe(before + 2);
    const pair = rows.filter((r) => (r.ref.kind === "review" && r.ref.id === c) || (r.ref.kind === "farm" && r.ref.id === sub.id));
    expect(pair.map((r) => r.ref.kind)).toEqual(["review", "farm"]);
    expect(pair[0]?.source).toBe("Found by the hunt");
    expect(pair[1]?.source).toBe("Add Your Farm submission");
    expect(pair[0]?.createdAt).toBe(cAt);
    expect(pair[1]?.createdAt).toBe(fAt);
    // Cleanup reasoning stays honest: both still pending.
    expect(await review.locate({ kind: "farm", id: sub.id })).toEqual({ status: "pending" });
  });
});

describe("candidate state", () => {
  it("an approved candidate has no public page and stays out of search and the directory", async () => {
    advance(1000);
    const c = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "hidden-farm.example", proposal: { name: "Hidden Farm Zzz", website_url: "https://hidden-farm.example", domain: "hidden-farm.example" }, reason: null, confidence: null, at: iso() });
    const slug = String((await review.approveSellerCandidate(c, ADMIN)).data.seller_slug);
    expect(await s.catalog.getSeller(slug)).toBeNull();
    expect((await s.catalog.search("Hidden Farm Zzz", { limit: 10 })).sellers).toHaveLength(0);
    expect((await s.catalog.listSellers({ offset: 0, limit: 200 })).items.map((x) => x.slug)).not.toContain(slug);
    expect((await s.catalog.sitemapEntries()).sellers.map((x) => x.slug)).not.toContain(slug);
  });
});

describe("home", () => {
  it("the duplicates card reads real holds and totalWaiting includes them", async () => {
    const before = await s.adminAuth.queueCards();
    advance(1000);
    const older = iso();
    await s.admin.createDuplicateHold(holdBody({ held_name: "Count Hold A", listing: { productUrl: `https://${songbirdDomain}/p/count-a`, checkedAt: older } }));
    advance(86_400_000);
    await s.admin.createDuplicateHold(holdBody({ held_name: "Count Hold B", listing: { productUrl: `https://${songbirdDomain}/p/count-b`, checkedAt: iso() } }));
    const after = await s.adminAuth.queueCards();
    const dupBefore = before.cards.find((c) => c.key === "duplicates")!;
    const dupAfter = after.cards.find((c) => c.key === "duplicates")!;
    expect(dupAfter.count).toBe(dupBefore.count + 2);
    expect(dupAfter.oldest).toBe(dupBefore.oldest && dupBefore.oldest < older ? dupBefore.oldest : older);
    expect(after.totalWaiting).toBe(before.totalWaiting + 2);
    expect(after.totalWaiting).toBe(after.cards.reduce((n, c) => n + c.count, 0));
  });

  it("recent decisions read in plain words with the decider and the label", async () => {
    advance(1000);
    const c = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "recent-words.example", proposal: { name: "Recent Words Farm", website_url: "https://recent-words.example", domain: "recent-words.example" }, reason: null, confidence: null, at: iso() });
    await review.approveSellerCandidate(c, REVIEWER);
    const decisions = await s.adminAuth.recentDecisions(30);
    expect(decisions.map((d) => d.text)).toContain("Rae Reviewer approved Recent Words Farm");
    expect(decisions.map((d) => d.text)).toContain("Rae Reviewer marked 'Chantilly Cream' a duplicate of 'Chantilly Light Pink'");
    expect(decisions.map((d) => d.text)).toContain("Rae Reviewer applied a correction to correction-target");
    for (const d of decisions) expect(d.text).not.toMatch(/#\d+$/);
  });
});

describe("decided history", () => {
  it("lists newest-first with the outcome, decider and time", async () => {
    advance(1000);
    const a = await reviewRepo.insertReviewItem(t.db, { type: "listing_match", groupKey: "history-a", proposal: listingProposal(sunsetId, "zinnia", "Dearest Sunset", "history-a"), reason: "model_match", confidence: 0.9, at: iso() });
    await review.publishListing(a, ADMIN);
    advance(1000);
    const b = await reviewRepo.insertReviewItem(t.db, { type: "listing_match", groupKey: "history-b", proposal: listingProposal(sunsetId, "zinnia", "Dearest Sunset", "history-b"), reason: "model_match", confidence: 0.9, at: iso() });
    await review.rejectQueuedListing(b, REVIEWER, "Wrong variety");
    const { rows } = await review.decidedList("listings", 1, 20);
    const pair = rows.filter((r) => r.ref.id === a || r.ref.id === b);
    expect(pair.map((r) => r.ref.id)).toEqual([b, a]);
    expect(pair[0]).toMatchObject({ name: "Dearest Sunset", outcome: "Declined", decider: "Rae Reviewer" });
    expect(pair[1]).toMatchObject({ outcome: "Approved", decider: "Ann Admin" });
  });
});

describe("public payloads", () => {
  it("carry no provenance or decider fields (variety, search, snapshot, sync)", async () => {
    const v = await s.catalog.getVariety("snapdragon-chantilly-light-pink");
    expect(JSON.stringify(v)).not.toMatch(/decided_by|decision_item|duplicate_decision|reviewed_by/);
    // The alias itself IS public (searchable); only its trail stays private.
    expect(v!.aliases).toContain("Chantilly Cream");
    const found = await s.catalog.search("chantilly cream", { limit: 5 });
    expect(JSON.stringify(found)).not.toMatch(/decided_by|decision_item|duplicate_decision|reviewed_by/);
    const snap = await readSnapshotRows(t.db);
    expect(Object.keys(snap)).not.toContain("review_items");
    expect(JSON.stringify(snap.variety_aliases ?? [])).not.toMatch(/decided_by|decision_item|duplicate_decision/);
    const aliases = SNAPSHOT_ALLOWLIST.find((a) => a.name === "variety_aliases")!;
    expect(aliases.columns).toEqual(["varietyId", "alias", "nameNormalized", "kind"]);
    const sync = await snapshotRows(t.db);
    expect(JSON.stringify(sync)).not.toMatch(/decided_by|decision_item|duplicate_decision/);
  });
});
