/**
 * Write flows on their own throwaway D1 + R2 (Miniflare): ingest evidence validation (the
 * planted tests of design D6), publishing rules, admin review/merge, the throwaway-seller removal
 * flow (R8), /go click logging (R7), view beacon + rollup (R11), reports (R8), API keys (D5).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices, type Services } from "@/lib/services";
import { createIngestService } from "@/lib/services/ingest";
import { withUtm } from "@/lib/services/clicks";

let t: TestD1;
let s: Services;
const raw = (sql: string, ...binds: unknown[]) => t.env.DB.prepare(sql).bind(...binds);
const NOW = () => new Date().toISOString();

const SNAPSHOT = `<html><body><h1>Dearest Sunset Zinnia Seeds</h1>
<p>Zinnia elegans · 50 seeds per packet</p>
<p class="stock">In stock</p>
<p>Also: Dearest Bubblegum Zinnia Seeds — Sold out</p></body></html>`;

let sellerId = 0;
let sellerSlug = "";
let sourceId = 0;

function observation(over: Record<string, unknown> = {}, product: Record<string, unknown> = {}) {
  return {
    schema: "listing_observation/1",
    seller_id: sellerSlug,
    source_id: sourceId,
    product: {
      url: "https://shop.throwaway-farm.example/products/dearest-sunset",
      external_product_id: "unknown",
      variant_key: "",
      title_raw: "Dearest Sunset Zinnia Seeds",
      is_seed: { value: "yes", evidence: "50 seeds per packet" },
      crop: { value: "zinnia", evidence: "Zinnia Seeds" },
      variety_name: { value: "Dearest Sunset", evidence: "Dearest Sunset Zinnia Seeds" },
      availability: { value: "in_stock", evidence: "In stock" },
      organic: { value: "unknown", evidence: null },
      ...product,
    },
    match: { variety_id: "zinnia-dearest-sunset", method: "exact", confidence: 1 },
    ...over,
  };
}

beforeAll(async () => {
  t = await createTestD1();
  s = createServices(t.db, { snapshots: t.env.SNAPSHOTS });
});
afterAll(async () => {
  await t?.dispose();
});

describe("API keys (D5)", () => {
  it("stores only the SHA-256 hash; verify() resolves scopes; revoked keys fail", async () => {
    const { id, token } = await s.auth.mint("test", ["ingest"]);
    expect(token).toMatch(/^sf_ingest_[\w-]{43}$/);
    const row = await raw("SELECT key_hash, scopes FROM api_keys WHERE id = ?", id).first<{ key_hash: string; scopes: string }>();
    expect(row!.key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.key_hash).not.toContain(token);
    expect(await s.auth.verify(token)).toMatchObject({ id, scopes: ["ingest"] });
    await raw("UPDATE api_keys SET revoked_at = ? WHERE id = ?", NOW(), id).run();
    expect(await s.auth.verify(token)).toBeNull();
    expect(await s.auth.verify("sf_admin_nope-nope-nope-nope-nope")).toBeNull();
  });
});

describe("throwaway seller: candidate → review → approve", () => {
  it("a seller candidate lands in the queue and is never auto-approved", async () => {
    const r = await s.ingest.sellerCandidate({ name: "Throwaway Test Farm", website_url: "https://throwaway-farm.example", evidence: "test fixture" });
    const item = await raw("SELECT type, status, group_key FROM review_items WHERE id = ?", r.review_item_id).first<Record<string, string>>();
    expect(item).toEqual({ type: "seller_candidate", status: "pending", group_key: "throwaway-farm.example" });
    const a = await s.admin.approve(r.review_item_id, {});
    expect(a.data).toMatchObject({ eligibility: "candidate" });
    sellerId = Number(a.data.seller_id);
    sellerSlug = String(a.data.seller_slug);
    expect(sellerSlug).toBe("throwaway-test-farm");
    expect(await s.catalog.getSeller(sellerSlug)).toBeNull(); // candidates are not public
    await expect(s.ingest.sellerCandidate({ name: "Again", website_url: "https://throwaway-farm.example/", evidence: "x" })).rejects.toMatchObject({ code: "seller_exists" });
  });

  it("registering a source stores the snapshot in R2 at fetch/{hash}.txt, idempotent on (url, hash)", async () => {
    const body = {
      url: "https://shop.throwaway-farm.example/products/dearest-sunset",
      fetched_at: NOW(),
      http_status: 200,
      content_text: SNAPSHOT,
      robots_allowed: true,
      kind: "human" as const,
    };
    const a = await s.ingest.registerSource(body);
    expect(a.created).toBe(true);
    expect(a.snapshot_key).toMatch(/^fetch\/[0-9a-f]{64}\.txt$/);
    expect(await (await t.env.SNAPSHOTS.get(a.snapshot_key))!.text()).toBe(SNAPSHOT);
    const b = await s.ingest.registerSource({ ...body, fetched_at: NOW() });
    expect(b).toMatchObject({ id: a.id, created: false });
    sourceId = a.id;
    await expect(s.ingest.registerSource({ ...body, kind: "web", robots_allowed: false })).rejects.toMatchObject({ code: "robots_disallowed" });
  });
});

describe("observation validation, in order (canonical §4)", () => {
  it("(2) an unapproved seller is rejected", async () => {
    const r = await s.ingest.observations({ observations: [observation()] });
    expect(r.results[0]).toMatchObject({ status: "rejected", reason: "seller_not_approved" });
  });

  it("approve the seller", async () => {
    const r = await s.admin.sellerAction(sellerSlug, "approve", {});
    expect(r.data).toMatchObject({ eligibility: "approved" });
  });

  it("(1) schema violations: guessing without evidence, illegal enums, wrong schema version", async () => {
    const r = await s.ingest.observations({
      observations: [
        observation({}, { availability: { value: "in_stock", evidence: null } }),
        observation({}, { availability: { value: "maybe", evidence: "In stock" } }),
        observation({ schema: "listing_observation/2" }),
        "not an object",
      ],
    });
    expect(r.results.map((x) => [x.status, "reason" in x ? x.reason : null])).toEqual([
      ["rejected", "schema_invalid"],
      ["rejected", "schema_invalid"],
      ["rejected", "schema_invalid"],
      ["rejected", "schema_invalid"],
    ]);
  });

  it("(2) manual_only sellers accept only human-captured sources; opted_out sellers nothing", async () => {
    const web = await s.ingest.registerSource({
      url: "https://shop.throwaway-farm.example/products/dearest-sunset?web",
      fetched_at: NOW(),
      http_status: 200,
      content_text: SNAPSHOT,
      robots_allowed: true,
      kind: "web",
    });
    const r = await s.ingest.observations({ observations: [observation({ source_id: web.id })] });
    expect(r.results[0]).toMatchObject({ status: "rejected", reason: "crawl_manual_only" });
    await raw("UPDATE sellers SET crawl_policy = 'opted_out' WHERE id = ?", sellerId).run();
    const o = await s.ingest.observations({ observations: [observation()] });
    expect(o.results[0]).toMatchObject({ status: "rejected", reason: "crawl_opted_out" });
    await raw("UPDATE sellers SET crawl_policy = 'manual_only' WHERE id = ?", sellerId).run();
  });

  it("(3) a product URL off the seller's domain is rejected", async () => {
    const r = await s.ingest.observations({ observations: [observation({}, { url: "https://elsewhere.example/p/dearest-sunset" })] });
    expect(r.results[0]).toMatchObject({ status: "rejected", reason: "off_domain" });
  });

  it("(4) a missing or stale source is rejected", async () => {
    const missing = await s.ingest.observations({ observations: [observation({ source_id: 999999 })] });
    expect((missing.results[0] as { reason: string }).reason).toMatch(/crawl_manual_only|source_not_found/);
    const old = await s.ingest.registerSource({
      url: "https://shop.throwaway-farm.example/products/old",
      fetched_at: new Date(Date.now() - 8 * 86_400_000).toISOString(),
      http_status: 200,
      content_text: SNAPSHOT + " old",
      robots_allowed: true,
      kind: "human",
    });
    const stale = await s.ingest.observations({ observations: [observation({ source_id: old.id })] });
    expect(stale.results[0]).toMatchObject({ status: "rejected", reason: "source_stale" });
  });

  it("(5) PLANTED: a fabricated evidence quote is REJECTED with evidence_not_found", async () => {
    const r = await s.ingest.observations({
      observations: [observation({}, { availability: { value: "in_stock", evidence: "Only 3 left — ships tomorrow" } })],
    });
    expect(r.results[0]).toMatchObject({ status: "rejected", reason: "evidence_not_found" });
    expect((r.results[0] as { detail: string }).detail).toMatch(/availability/);
    const listing = await raw("SELECT count(*) n FROM listings WHERE seller_id = ?", sellerId).first<{ n: number }>();
    expect(listing!.n).toBe(0);
    const obs = await raw("SELECT status, reason FROM observations ORDER BY id DESC LIMIT 1").first<Record<string, string>>();
    expect(obs!.status).toBe("rejected");
    expect(obs!.reason).toMatch(/^evidence_not_found/);
  });

  it("(5)(6) PLANTED: a genuine quote from the stored snapshot is ACCEPTED and publishes on an exact match", async () => {
    expect((await s.catalog.getVariety("zinnia-dearest-sunset"))!.indexable).toBe(true); // already indexable: every active variety is (owner ruling 2026-11-16)
    const seqBefore = await s.catalog.catalogSeq();
    const r = await s.ingest.observations({ observations: [observation()] });
    expect(r.results[0]).toMatchObject({ status: "published", created: true, event: "first_seen", variety_slug: "zinnia-dearest-sunset" });
    const v = (await s.catalog.getVariety("zinnia-dearest-sunset"))!;
    const l = v.listings.find((x) => x.seller.slug === sellerSlug)!;
    expect(l).toMatchObject({ availability: "in_stock", productUrl: "https://shop.throwaway-farm.example/products/dearest-sunset" });
    expect(l.provenance).toMatchObject({ source_url: "https://shop.throwaway-farm.example/products/dearest-sunset", method: "exact", confidence: 1 });
    expect(v.indexable).toBe(true); // still indexable after publish (recomputed)
    expect(await s.catalog.catalogSeq()).toBeGreaterThan(seqBefore);
    const changes = await s.sync.changes(seqBefore);
    expect(changes.upserts.listings.map((x) => x.id)).toContain(l.id);
  });

  it("(6) a retry updates the same listing (seller, URL, variant) — no duplicate; a state change logs an event", async () => {
    const again = await s.ingest.observations({ observations: [observation()] });
    expect(again.results[0]).toMatchObject({ status: "published", created: false, event: null });
    const sold = await s.ingest.observations({
      observations: [observation({}, { availability: { value: "sold_out", evidence: "Sold out" } })],
    });
    expect(sold.results[0]).toMatchObject({ status: "published", created: false, event: "sold_out" });
    const n = await raw("SELECT count(*) n FROM listings WHERE seller_id = ?", sellerId).first<{ n: number }>();
    expect(n!.n).toBe(1);
    const restock = await s.ingest.observations({ observations: [observation()] });
    expect(restock.results[0]).toMatchObject({ event: "restocked" });
    const recent = await s.catalog.recent({ limit: 5 });
    expect(recent[0]).toMatchObject({ event: "restocked" });
  });

  it("PLANTED: a model match queues instead of publishing, at any confidence", async () => {
    const r = await s.ingest.observations({
      observations: [
        observation(
          { match: { variety_id: "zinnia-dearest-bubblegum", method: "model", confidence: 0.99 } },
          {
            url: "https://shop.throwaway-farm.example/products/dearest-bubblegum",
            variety_name: { value: "Dearest Bubblegum", evidence: "Dearest Bubblegum Zinnia Seeds" },
            availability: { value: "sold_out", evidence: "Sold out" },
          },
        ),
      ],
    });
    expect(r.results[0]).toMatchObject({ status: "queued", reason: "model_match" });
    const item = await raw("SELECT type, group_key, status FROM review_items WHERE id = ?", (r.results[0] as { review_item_id: number }).review_item_id).first<Record<string, string>>();
    expect(item).toEqual({ type: "listing_match", group_key: "dearest bubblegum", status: "pending" });
    expect((await s.catalog.getVariety("zinnia-dearest-bubblegum"))!.listings).toHaveLength(0);
  });

  it("an exact claim whose name does not normalize to a known name queues (name_mismatch); no match → new_variety", async () => {
    const r = await s.ingest.observations({
      observations: [
        observation({}, { variety_name: { value: "Dearest Bubblegum", evidence: "Dearest Bubblegum Zinnia Seeds" }, url: "https://shop.throwaway-farm.example/products/x" }),
        observation(
          { match: { variety_id: null, method: "none", confidence: 0 } },
          { variety_name: { value: "Dearest Sunset", evidence: "Dearest Sunset" }, url: "https://shop.throwaway-farm.example/products/new" },
        ),
      ],
    });
    expect(r.results.map((x) => [x.status, "reason" in x ? x.reason : null])).toEqual([
      ["queued", "name_mismatch"],
      ["queued", "no_match"],
    ]);
  });

  it("match-context lists the crop's varieties with ids and names", async () => {
    const m = (await s.ingest.matchContext("zinnia"))!;
    expect(m.crop.slug).toBe("zinnia");
    expect(m.varieties.find((v) => v.slug === "zinnia-dearest-sunset")).toMatchObject({ name: "Dearest Sunset", name_normalized: "dearest sunset" });
  });
});

describe("admin review (R11)", () => {
  it("approve applies a model-match proposal (published with method human)", async () => {
    const [item] = (await s.admin.listReview({ type: "listing_match", status: "pending" }, 50)).filter((i) => i.groupKey === "dearest bubblegum");
    const r = await s.admin.approve(item!.id, {});
    expect(r.data).toMatchObject({ status: "approved", variety_slug: "zinnia-dearest-bubblegum" });
    const v = (await s.catalog.getVariety("zinnia-dearest-bubblegum"))!;
    expect(v.listings[0]!.provenance.method).toBe("human");
    await expect(s.admin.approve(item!.id, {})).rejects.toMatchObject({ code: "already_resolved" });
  });

  it("merge moves the loser's names and listings and marks it merged (tombstone with merged_into)", async () => {
    const seq = await s.catalog.catalogSeq();
    const [item] = (await s.admin.listReview({ type: "new_variety", status: "pending" }, 50));
    const r = await s.admin.merge(item!.id, { into_id: "zinnia-dearest-sunset", variety_id: "zinnia-dearest-tabita" });
    expect(r.data).toMatchObject({ status: "merged", merged: { loser: "zinnia-dearest-tabita", into: "zinnia-dearest-sunset" } });
    expect(await s.catalog.getVariety("zinnia-dearest-tabita")).toBeNull();
    expect(await s.catalog.mergedVarietyTarget("zinnia-dearest-tabita")).toBe("zinnia-dearest-sunset");
    expect((await s.catalog.getVariety("zinnia-dearest-sunset"))!.aliases).toContain("Dearest Tabita");
    const c = await s.sync.changes(seq);
    const winner = (await raw("SELECT id FROM varieties WHERE slug = 'zinnia-dearest-sunset'").first<{ id: number }>())!.id;
    expect(c.deletes).toContainEqual({ type: "variety", id: expect.any(Number), merged_into: winner });
  });

  it("in-stock listings sort first on a variety page", async () => {
    await s.ingest.registerSource({
      url: "https://shop.throwaway-farm.example/products/kings-ransom",
      fetched_at: NOW(),
      http_status: 200,
      content_text: "King's Ransom Sweet Pea Seeds. 10 seeds. Sold out",
      robots_allowed: true,
      kind: "human",
    });
    const src = (await raw("SELECT id FROM fetch_sources WHERE url LIKE '%kings-ransom'").first<{ id: number }>())!.id;
    const r = await s.ingest.observations({
      observations: [
        observation(
          { source_id: src, match: { variety_id: "sweet-pea-kings-ransom", method: "exact", confidence: 1 } },
          {
            url: "https://shop.throwaway-farm.example/products/kings-ransom",
            is_seed: { value: "yes", evidence: "10 seeds" },
            crop: { value: "sweet pea", evidence: "Sweet Pea" },
            variety_name: { value: "King's Ransom", evidence: "King's Ransom Sweet Pea Seeds" },
            availability: { value: "sold_out", evidence: "Sold out" },
          },
        ),
      ],
    });
    expect(r.results[0]!.status).toBe("published");
    const v = (await s.catalog.getVariety("sweet-pea-kings-ransom"))!;
    expect(v.listings.map((l) => [l.seller.slug, l.availability])).toEqual([
      ["songbird-seed-co", "in_stock"],
      [sellerSlug, "sold_out"],
    ]);
    expect(v.answer).toMatch(/2 sellers list King's Ransom: Songbird Seed Co\. and Throwaway Test Farm\.$/);
  });

  it("health: no invariant violations on clean data; flags an off-domain listing", async () => {
    expect((await s.admin.health()).ok).toBe(true);
    await raw("UPDATE listings SET product_url = 'https://evil.example/x' WHERE id = 1").run();
    const h = await s.admin.health();
    expect(h.invariants.violations).toContainEqual(expect.objectContaining({ invariant: "off_domain_url", listing_id: 1 }));
    await raw("UPDATE listings SET product_url = 'https://www.songbirdseeds.com/seedshop/p/kingsransom-54d2m' WHERE id = 1").run();
    expect(h.queue.pending).toBeGreaterThanOrEqual(1);
  });
});

describe("/go/{listing_id} (R7)", () => {
  it("withUtm keeps an existing query and never overwrites utm_source", () => {
    expect(withUtm("https://a.example/p")).toBe("https://a.example/p?utm_source=seedfinder&utm_medium=referral");
    expect(withUtm("https://a.example/p?variant=2")).toBe("https://a.example/p?variant=2&utm_source=seedfinder&utm_medium=referral");
    expect(withUtm("https://a.example/p?utm_source=farm")).toBe("https://a.example/p?utm_source=farm&utm_medium=referral");
  });

  it("302 with UTM, writes click_events with a visitor hash and no IP", async () => {
    const out = await s.clicks.go({
      listingId: 1,
      ip: "203.0.113.77",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      xClient: null,
      referer: "https://seeds.hues.flowers/variety/sweet-pea-kings-ransom",
      ownHosts: ["seeds.hues.flowers"],
      salt: "test-salt",
    });
    expect(out).toEqual({ status: 302, location: "https://www.songbirdseeds.com/seedshop/p/kingsransom-54d2m?utm_source=seedfinder&utm_medium=referral" });
    const row = await raw("SELECT * FROM click_events ORDER BY id DESC LIMIT 1").first<Record<string, unknown>>();
    expect(row).toMatchObject({ listing_id: 1, availability_at_click: "in_stock", page_type: "variety", referrer_host: "seeds.hues.flowers", client: "safari", is_bot: 0 });
    expect(String(row!.visitor_day_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain("203.0.113.77");
  });

  it("bots are flagged; unknown ids 404", async () => {
    await s.clicks.go({ listingId: 1, ip: null, userAgent: "Googlebot/2.1", xClient: null, referer: null, ownHosts: [], salt: "x" });
    const row = await raw("SELECT is_bot, page_type, client FROM click_events ORDER BY id DESC LIMIT 1").first<Record<string, unknown>>();
    expect(row).toEqual({ is_bot: 1, page_type: "direct", client: "bot" });
    expect(await s.clicks.go({ listingId: 99999, ip: null, userAgent: null, xClient: null, referer: null, ownHosts: [], salt: "x" })).toEqual({ status: 404 });
  });
});

describe("views, demand stats and rollup (R11)", () => {
  it("view beacon counts per (date, variety); demand lists exclude bots", async () => {
    expect(await s.clicks.view("stock-katz-mix")).toBe(true);
    expect(await s.clicks.view("stock-katz-mix")).toBe(true);
    expect(await s.clicks.view("no-such-variety")).toBe(false);
    await s.catalog.search("nothing-like-this", { logClient: "test" });
    const d = await s.admin.demand("2000-01-01", 10);
    expect(d.top_clicked_varieties[0]).toMatchObject({ slug: "sweet-pea-kings-ransom", clicks: 1 });
    expect(d.top_zero_seller_views[0]).toMatchObject({ slug: "stock-katz-mix", views: 2 });
    expect(d.top_zero_result_searches.map((x) => x.query)).toContain("nothing like this");
  });

  it("rollup aggregates non-bot clicks into daily_stats", async () => {
    const today = NOW().slice(0, 10);
    const r = await s.admin.rollup(today);
    expect(r).toEqual({ rows: 1, clicks: 1 });
    expect(await s.admin.rollup(today)).toEqual({ rows: 1, clicks: 1 }); // idempotent
  });
});

describe("reports (R8)", () => {
  it("stores the report and a queue item; Turnstile not configured → marked not_configured", async () => {
    const r = await s.reports.submit(
      { type: "remove", target_type: "seller", target_ref: sellerSlug, message: "Please remove our farm.", contact: "owner@throwaway-farm.example" },
      "203.0.113.5",
    );
    expect(r).toMatchObject({ status: "open", turnstile: "not_configured" });
    const item = await raw("SELECT type, group_key, status FROM review_items WHERE id = ?", r.review_item_id).first<Record<string, string>>();
    expect(item).toEqual({ type: "removal", group_key: `seller:${sellerSlug}`, status: "pending" });
    await expect(
      s.reports.submit({ type: "correct", target_type: "variety", target_ref: "no-such-thing", message: "hello there", contact: "a@b.example" }, null),
    ).rejects.toMatchObject({ code: "unknown_target" });
  });

  it("with a Turnstile secret, a missing or failed token is refused (siteverify stubbed)", async () => {
    const { createReportService } = await import("@/lib/services/reports");
    const failing = createReportService(t.db, { turnstileSecret: "secret", fetchFn: (async () => Response.json({ success: false })) as typeof fetch });
    const body = { type: "correct" as const, target_type: "seller" as const, target_ref: "floret", message: "hello there", contact: "a@b.example" };
    await expect(failing.submit(body, null)).rejects.toMatchObject({ code: "turnstile_required" });
    await expect(failing.submit({ ...body, turnstile_token: "x" }, null)).rejects.toMatchObject({ code: "turnstile_failed" });
    const passing = createReportService(t.db, { turnstileSecret: "secret", fetchFn: (async () => Response.json({ success: true })) as typeof fetch });
    expect((await passing.submit({ ...body, turnstile_token: "x" }, null)).turnstile).toBe("verified");
  });
});

describe("removal flow on the throwaway seller (R8)", () => {
  it("approving the removal request: eligibility, listings removed, domain blocked, 410, excluded everywhere", async () => {
    const seq = await s.catalog.catalogSeq();
    const [item] = await s.admin.listReview({ type: "removal", status: "pending" }, 10);
    const r = await s.admin.approve(item!.id, {});
    expect(r.data).toMatchObject({ seller: sellerSlug, eligibility: "removed_by_request", blocked_domain: "throwaway-farm.example" });
    expect(r.data.listings_removed).toBe(4); // dearest-sunset, dearest-bubblegum, the merged one, kings-ransom
    expect(r.revalidate).toContain(`/seller/${sellerSlug}`);

    const seller = await raw("SELECT eligibility FROM sellers WHERE id = ?", sellerId).first<{ eligibility: string }>();
    expect(seller!.eligibility).toBe("removed_by_request");
    const live = await raw("SELECT count(*) n FROM listings WHERE seller_id = ? AND status <> 'removed'", sellerId).first<{ n: number }>();
    expect(live!.n).toBe(0);
    expect(await raw("SELECT reason FROM blocked_domains WHERE domain = 'throwaway-farm.example'").first()).toBeTruthy();
    const report = await raw("SELECT status FROM reports WHERE target_ref = ? AND type = 'remove'", sellerSlug).first<{ status: string }>();
    expect(report!.status).toBe("resolved");

    expect(await s.catalog.sellerStatus(sellerSlug)).toBe("gone");
    expect(await s.catalog.getSeller(sellerSlug)).toBeNull();
    expect((await s.catalog.listSellers({ offset: 0, limit: 100 })).items.map((x) => x.slug)).not.toContain(sellerSlug);
    expect((await s.catalog.sitemapEntries()).sellers.map((x) => x.slug)).not.toContain(sellerSlug);
    expect((await s.catalog.search("throwaway", { limit: 10 })).sellers).toHaveLength(0);
    expect((await s.catalog.getVariety("sweet-pea-kings-ransom"))!.listings.map((l) => l.seller.slug)).toEqual(["songbird-seed-co"]);
    expect((await s.catalog.getVariety("zinnia-dearest-bubblegum"))!.indexable).toBe(true); // stays indexable after losing its only listing (owner ruling 2026-11-16)

    const listingId = (await raw("SELECT id FROM listings WHERE seller_id = ? LIMIT 1", sellerId).first<{ id: number }>())!.id;
    expect(await s.clicks.go({ listingId, ip: null, userAgent: null, xClient: null, referer: null, ownHosts: [], salt: "x" })).toEqual({ status: 410 });
    const c = await s.sync.changes(seq);
    expect(c.deletes).toContainEqual({ type: "seller", id: sellerId });
    expect(c.deletes.filter((d) => d.type === "listing")).toHaveLength(4);
  });

  it("the blocked domain can no longer feed the catalog", async () => {
    const r = await s.ingest.observations({ observations: [observation()] });
    expect(r.results[0]).toMatchObject({ status: "rejected", reason: "seller_not_approved" });
    await expect(
      s.ingest.registerSource({ url: "https://shop.throwaway-farm.example/x", fetched_at: NOW(), http_status: 200, content_text: "x", robots_allowed: true, kind: "human" }),
    ).rejects.toMatchObject({ code: "blocked_domain" });
    await expect(s.ingest.sellerCandidate({ name: "Back again", website_url: "https://throwaway-farm.example", evidence: "x" })).rejects.toMatchObject({ code: "blocked_domain" });
    await expect(s.admin.sellerAction(sellerSlug, "approve", {})).rejects.toMatchObject({ code: "seller_removed" });
  });
});

describe("crawl jobs", () => {
  it("lease → complete; fail backs off; expired leases return to the queue", async () => {
    const a = await s.admin.enqueueJob({ type: "seller_shop", target: "floret" });
    const b = await s.admin.enqueueJob({ type: "seller_shop", target: "songbird-seed-co" });
    const leased = await s.ingest.lease({ count: 5, agent: "test-agent", model: "none", prompt_version: "v0" });
    expect(leased.agent_run_id).toBeGreaterThan(0);
    expect(leased.jobs.map((j) => j.id).sort()).toEqual([a.id, b.id].sort());
    expect((await s.ingest.lease({ count: 5 })).jobs).toHaveLength(0);
    expect(await s.ingest.completeJob(a.id)).toEqual({ id: a.id, status: "done" });
    const f = await s.ingest.failJob(b.id);
    expect(f).toMatchObject({ status: "queued", attempts: 1 });
    expect(Date.parse(f.next_run_at!)).toBeGreaterThan(Date.now());
    await expect(s.ingest.completeJob(b.id)).rejects.toMatchObject({ code: "job_not_leased" });
    // expired lease → back in the queue
    const later = createIngestService(t.db, { snapshots: t.env.SNAPSHOTS, now: () => new Date(Date.now() + 60 * 60_000) });
    await raw("UPDATE crawl_jobs SET status = 'leased', lease_expires_at = ? WHERE id = ?", new Date(Date.now() + 15 * 60_000).toISOString(), b.id).run();
    expect((await later.lease({ count: 5 })).jobs.map((j) => j.id)).toEqual([b.id]);
  });
});

describe("admin listing removal (POST /admin/listings/:id/remove)", () => {
  const liveListing = () =>
    raw("SELECT l.id, v.slug variety FROM listings l JOIN varieties v ON v.id = l.variety_id WHERE l.status <> 'removed' ORDER BY l.id LIMIT 1").first<{
      id: number;
      variety: string;
    }>();
  const goneEvents = (id: number) =>
    raw("SELECT reason FROM listing_events WHERE listing_id = ? AND event = 'gone'", id).all<{ reason: string | null }>();

  it("removes one listing: status flipped, one 'gone' event with the reason, seq bumped, pages revalidated", async () => {
    const l = (await liveListing())!;
    const seqBefore = await s.catalog.catalogSeq();
    const r = await s.admin.removeListing(l.id, { reason: "product page is gone" });
    expect(r.data).toEqual({ listing_id: l.id, status: "removed", already_removed: false });
    expect(r.revalidate).toHaveLength(2);
    expect(r.revalidate[0]).toBe(`/variety/${l.variety}`);
    expect(r.revalidate[1]).toMatch(/^\/seller\/.+/);

    const row = await raw("SELECT status, updated_seq FROM listings WHERE id = ?", l.id).first<{ status: string; updated_seq: number }>();
    expect(row!.status).toBe("removed");
    const seqAfter = await s.catalog.catalogSeq();
    expect(seqAfter).toBeGreaterThan(seqBefore);
    expect(row!.updated_seq).toBe(seqAfter);
    expect((await goneEvents(l.id)).results).toEqual([{ reason: "product page is gone" }]);
    // The variety keeps its public page (indexable is status-based, not listing-based).
    expect((await s.catalog.getVariety(l.variety))!.indexable).toBe(true);
  });

  it("is idempotent: a repeat succeeds with already_removed and writes nothing", async () => {
    const l = (await liveListing())!;
    await s.admin.removeListing(l.id, {});
    const seq = await s.catalog.catalogSeq();
    const again = await s.admin.removeListing(l.id, { reason: "second call" });
    expect(again.data).toEqual({ listing_id: l.id, status: "removed", already_removed: true });
    expect(await s.catalog.catalogSeq()).toBe(seq);
    expect((await goneEvents(l.id)).results).toEqual([{ reason: null }]); // one event; no reason was supplied the first time
  });

  it("concurrent removes of the same live listing: one winner, one 'gone' event, one seq bump", async () => {
    const l = (await liveListing())!;
    const seqBefore = await s.catalog.catalogSeq();
    const [a, b] = await Promise.all([s.admin.removeListing(l.id, { reason: "race a" }), s.admin.removeListing(l.id, { reason: "race b" })]);
    expect([a.data.already_removed, b.data.already_removed].sort()).toEqual([false, true]);
    expect((await goneEvents(l.id)).results).toHaveLength(1);
    expect(await s.catalog.catalogSeq()).toBe(seqBefore + 1);
    expect((await raw("SELECT status FROM listings WHERE id = ?", l.id).first<{ status: string }>())!.status).toBe("removed");
  });

  it("404 listing_not_found for an unknown id", async () => {
    await expect(s.admin.removeListing(999_999, {})).rejects.toMatchObject({ status: 404, code: "listing_not_found" });
  });
});
