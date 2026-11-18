/**
 * Real local D1 (Miniflare) with the real migrations: importer + derivations (D2), spot checks,
 * the R5 index rule, price absence (R1), search (R12), sync (R9), Zod fail-loud behaviour.
 * Write flows (ingest, admin, reports, /go) live in ingest-admin.test.ts on their own D1.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestD1, loadCatalogJson, type TestD1 } from "../helpers/d1";
import { importCatalog } from "@/lib/catalog/importer";
import { createServices } from "@/lib/services";
import { searchVarieties } from "@/lib/repositories/fts";
import { tableCounts } from "@/lib/repositories/catalog-write";
import { COMPANY_NAME_EXCLUSION_PATTERN } from "@/lib/catalog/assertions";

let t: TestD1;
beforeAll(async () => {
  t = await createTestD1();
});
afterAll(async () => {
  await t?.dispose();
});

const raw = (sql: string, ...binds: unknown[]) => t.env.DB.prepare(sql).bind(...binds);
const svc = () => createServices(t.db).catalog;

describe("importer (design D2)", () => {
  it("loads 778 varieties / 25 sellers / 17 listings / 124 plants, 32 series, a first_seen event per listing", async () => {
    const c = await tableCounts(t.db);
    expect([c.varieties, c.sellers, c.listings, c.plants]).toEqual([778, 25, 17, 124]);
    expect(c.series).toBe(32);
    expect(c.listingEvents).toBe(17);
    expect(c.approvedSellers).toBe(25);
    expect(c.listingsWithoutCheckDate).toBe(0);
    expect(c.media).toBe(0);
    expect(c.priceHistory).toBeGreaterThan(0); // stored, never shown
  });

  it("full-replace: re-running converges to exactly the catalog.json contents", async () => {
    await raw("UPDATE listings SET availability = 'preorder' WHERE id = 1").run();
    const r = await importCatalog(t.db, loadCatalogJson());
    expect(r.status).toBe("replaced");
    expect([r.counts.varieties, r.counts.sellers, r.counts.listings, r.counts.plants]).toEqual([778, 25, 17, 124]);
    const row = await raw("SELECT availability FROM listings WHERE id = 1").first<{ availability: string }>();
    expect(row?.availability).toBe("in_stock");
    expect(r.catalogSeq).toBeGreaterThan(0);
  });

  it("seller approval fields are mapped honestly (approved 2026-11-15; Week 1 terms review 2026-11-16)", async () => {
    // Terms actually read and owner-approved 2026-11-16 for these three.
    const termsReviewed = new Set(["songbird-seed-co", "floret", "hudson-valley-seed-co"]);
    const rows = await raw("SELECT slug, eligibility, approved_at, terms_reviewed_at, domain FROM sellers").all<Record<string, string | null>>();
    // The six exemplars were approved 2026-11-15; the Floret-list farms, Johnny's and
    // The Gardener's Workshop were added by owner direction on 2026-11-16.
    const exemplars = new Set(["songbird-seed-co", "sunflower-steve-seed-co", "floret", "dawn-creek-farm", "hudson-valley-seed-co", "wild-west-seed"]);
    for (const s of rows.results) {
      expect(s.eligibility).toBe("approved");
      expect(s.approved_at?.slice(0, 10)).toBe(s.slug && exemplars.has(s.slug) ? "2026-11-15" : "2026-11-16");
      if (s.slug && termsReviewed.has(s.slug)) {
        expect(s.terms_reviewed_at?.slice(0, 10)).toBe("2026-11-16");
      } else {
        // Sunflower Steve (terms page blank), Dawn Creek (breeder-terms source
        // unlocated), Wild West (no retail terms exist) and every 2026-11-16
        // addition (terms not yet read) stay unreviewed.
        expect(s.terms_reviewed_at).toBeNull();
      }
      expect(s.domain).toBeTruthy();
    }
  });

  it("every listing has provenance; no seller names an excluded company", async () => {
    const l = await raw("SELECT count(*) n FROM listings WHERE source_id IS NULL OR last_checked_at IS NULL OR match_method <> 'human'").first<{ n: number }>();
    expect(l?.n).toBe(0);
    const rows = await raw("SELECT slug, name FROM sellers").all<{ slug: string; name: string }>();
    for (const r of rows.results) expect(COMPANY_NAME_EXCLUSION_PATTERN.test(`${r.slug} ${r.name}`)).toBe(false);
  });

  it("the DB still refuses a stored price without source/date (storage unchanged)", async () => {
    await expect(raw("UPDATE listing_packet_sizes SET price_source = NULL WHERE price_cents IS NOT NULL").run()).rejects.toThrow(/CHECK/i);
  });
});

describe("derivations + spot checks (task 3)", () => {
  it("Songbird × King's Ransom: in_stock, last checked 2026-11-15, provenance from the product URL", async () => {
    const v = (await svc().getVariety("sweet-pea-kings-ransom"))!;
    const l = v.listings.find((x) => x.seller.slug === "songbird-seed-co")!;
    expect(l.availability).toBe("in_stock");
    expect(l.lastCheckedAt?.slice(0, 10)).toBe("2026-11-15");
    expect(l.productUrl).toBe("https://www.songbirdseeds.com/seedshop/p/kingsransom-54d2m");
    expect(l.provenance).toEqual({
      source_url: "https://www.songbirdseeds.com/seedshop/p/kingsransom-54d2m",
      retrieved_at: l.lastCheckedAt,
      method: "human",
      confidence: 1,
    });
    expect(l.goUrl).toBe(`https://seeds.hues.flowers/go/${l.id}`);
    expect(v.answer).toBe("As of 2026-11-15, 1 small farm lists King's Ransom: Songbird Seed Co.");
  });

  it("Songbird × Emma: sold_out; Floret × Dawn Creek Pastels: unknown availability", async () => {
    const emma = (await svc().getVariety("sweet-pea-emma"))!;
    expect(emma.listings.find((x) => x.seller.slug === "songbird-seed-co")!.availability).toBe("sold_out");
    const dcp = (await svc().getVariety("zinnia-dawn-creek-pastels"))!;
    expect(dcp.listings.find((x) => x.seller.slug === "floret")!.availability).toBe("unknown");
  });

  it("Songbird's seller page lists its 9 varieties", async () => {
    const s = (await svc().getSeller("songbird-seed-co"))!;
    expect(s.listings.length).toBe(9);
    const v = (await svc().listVarieties({ filters: { seller: "songbird-seed-co" }, page: { offset: 0, limit: 100 } })).items;
    expect(v.length).toBe(9);
  });

  it("unknown facts are explicit; rating is not_yet_rated", async () => {
    const v = (await svc().getVariety("stock-katz-mix"))!;
    expect(v.facts.color_family).toBe("mix"); // sourced since brief #2 (variety-colors.json)
    expect((await svc().getVariety("virginia-stock"))!.facts.color_family).toBe("unknown"); // no colour data → explicit unknown
    expect(v.facts.pollination).toBe("unknown");
    expect(v.facts.days_to_bloom).toEqual({ min: null, max: null });
    expect(v.rating).toEqual({ state: "not_yet_rated", average: null, review_count: 0 });
    expect(v.answer).toBe("No small farm found selling Katz Mix yet.");
  });

  it("series: Dearest is one zinnia series with its member varieties", async () => {
    const s = (await svc().getSeries("zinnia-dearest"))!;
    expect(s.name).toBe("Dearest");
    expect(s.crop.slug).toBe("zinnia");
    expect(s.varieties.length).toBe(s.varietyCount);
    expect(s.varieties.every((v) => v.series?.slug === "zinnia-dearest")).toBe(true);
  });
});

describe("index rule (owner ruling 2026-11-16)", () => {
  it("778 indexable varieties (every active variety, sellers or not), 0 noindex, all in the sitemap", async () => {
    const first = await svc().listVarieties({ page: { offset: 0, limit: 100 } });
    const items = [...first.items];
    for (let offset = 100; offset < first.total; offset += 100) {
      items.push(...(await svc().listVarieties({ page: { offset, limit: 100 } })).items);
    }
    expect(items).toHaveLength(778);
    expect(items.filter((v) => v.indexable)).toHaveLength(778);
    expect(items.filter((v) => !v.indexable)).toHaveLength(0);
    for (const v of items) expect(v.indexable).toBe(true);
    const sitemap = await svc().sitemapEntries();
    expect(sitemap.varieties).toHaveLength(778);
  });
});

describe("prices are stored, never shown (R1)", () => {
  it("no price field in any public service output", async () => {
    const s = svc();
    const docs: unknown[] = [
      await s.listVarieties({ page: { offset: 0, limit: 100 } }),
      await s.listSellers({ offset: 0, limit: 100 }),
      await s.listCrops({ offset: 0, limit: 100 }),
      await s.coverage(),
      await s.recent({ limit: 100 }),
      await createServices(t.db).sync.snapshot(),
    ];
    for (const v of (await s.listVarieties({ page: { offset: 0, limit: 100 } })).items) docs.push(await s.getVariety(v.slug));
    for (const x of (await s.listSellers({ offset: 0, limit: 100 })).items) docs.push(await s.getSeller(x.slug));
    const text = JSON.stringify(docs);
    // Keys only: free-text listing notes may say e.g. "price not recorded".
    expect(text).not.toMatch(/"price\w*":|"currency":|"fromPrice":|"inStock":|"lowPrice":/i);
  });
});

describe("listing visibility", () => {
  it("removed / unapproved sellers disappear from pages, lists and search", async () => {
    const s = svc();
    await raw("UPDATE sellers SET eligibility = 'candidate' WHERE slug = 'songbird-seed-co'").run();
    expect(await s.getSeller("songbird-seed-co")).toBeNull();
    expect((await s.getVariety("sweet-pea-kings-ransom"))!.listings).toHaveLength(0);
    expect((await s.search("songbird", { limit: 10 })).sellers).toHaveLength(0);
    expect(await s.sellerStatus("songbird-seed-co")).toBe("missing");
    await raw("UPDATE sellers SET eligibility = 'removed_by_request' WHERE slug = 'songbird-seed-co'").run();
    expect(await s.sellerStatus("songbird-seed-co")).toBe("gone");
    await raw("UPDATE sellers SET eligibility = 'approved' WHERE slug = 'songbird-seed-co'").run();
    expect(await s.sellerStatus("songbird-seed-co")).toBe("ok");
  });
});

describe("search (R12)", () => {
  const slugsFor = async (q: string) => {
    const matches = await searchVarieties(t.db, q, { limit: 50 });
    const rows = await raw(`SELECT id, slug FROM varieties`).all<{ id: number; slug: string }>();
    const bySlug = new Map(rows.results.map((r) => [r.id, r.slug]));
    return matches.map((m) => bySlug.get(m.varietyId));
  };

  it("matches crop names, partial and mid-word, and Latin names", async () => {
    const r = await slugsFor("sweet pea");
    expect(r.length).toBeGreaterThan(5);
    expect(r.every((s) => s?.startsWith("sweet-pea-"))).toBe(true);
    expect(await slugsFor("ransom")).toContain("sweet-pea-kings-ransom");
    expect(await slugsFor("ansom")).toContain("sweet-pea-kings-ransom");
    expect(await slugsFor("matthiola")).toContain("stock-katz-mix");
  });

  it("two typed characters return matches (prefix path)", async () => {
    expect(await slugsFor("ka")).toContain("stock-katz-mix");
    expect(await slugsFor("ki")).toContain("sweet-pea-kings-ransom");
    expect(await slugsFor("zz")).toEqual([]);
    expect(await slugsFor("k")).toEqual([]);
  });

  it("treats FTS syntax and LIKE wildcards as literal text", async () => {
    await expect(slugsFor('"OR * NEAR(')).resolves.toBeDefined();
    await expect(slugsFor("%_")).resolves.toEqual([]);
  });

  it("ranks exact name first, then prefix; varieties with listings first on ties", async () => {
    const r = await svc().search("king's ransom", { limit: 10 });
    expect(r.varieties[0]!.slug).toBe("sweet-pea-kings-ransom");
    const z = await svc().search("zinnia", { limit: 50 });
    z.varieties = z.varieties.filter((v) => v.href.startsWith("/variety/zinnia-")); // the prefix tier
    const firstNoSeller = z.varieties.findIndex((v) => v.subtitle.includes("no farm listing yet"));
    const lastWithSeller = z.varieties.map((v) => !v.subtitle.includes("no farm listing yet")).lastIndexOf(true);
    expect(firstNoSeller).toBeGreaterThan(-1);
    expect(lastWithSeller).toBeLessThan(firstNoSeller);
  });

  it("synonym matches are flagged (also sold as) and tracked through triggers", async () => {
    await raw(
      "INSERT INTO variety_aliases (variety_id, alias, name_normalized, kind) SELECT id, 'Zebulon Pastels', 'zebulon pastels', 'synonym' FROM varieties WHERE slug = 'zinnia-dawn-creek-pastels'",
    ).run();
    const r = await svc().search("zebulon", { limit: 10 });
    expect(r.varieties.map((v) => [v.slug, v.matchedAlias])).toEqual([["zinnia-dawn-creek-pastels", "Zebulon Pastels"]]);
    const two = await svc().search("ze", { limit: 10 });
    expect(two.varieties.find((v) => v.slug === "zinnia-dawn-creek-pastels")?.matchedAlias).toBe("Zebulon Pastels");
    const primary = await svc().search("dawn creek pastels", { limit: 10 });
    expect(primary.varieties[0]).toMatchObject({ slug: "zinnia-dawn-creek-pastels", matchedAlias: null });
    expect((await svc().getVariety("zinnia-dawn-creek-pastels"))!.aliases).toEqual(["Zebulon Pastels"]);
    await raw("DELETE FROM variety_aliases WHERE alias = 'Zebulon Pastels'").run();
    expect(await slugsFor("zebulon")).toEqual([]);
  });

  it("mixed results (crops, series, sellers) and type filtering", async () => {
    const r = await svc().search("dearest", { limit: 10 });
    expect(r.series.map((s) => s.slug)).toEqual(["zinnia-dearest"]);
    const crops = await svc().search("zinnia", { limit: 10, types: ["crop"] });
    expect(crops.crops.map((c) => c.href)).toEqual(["/crop/zinnia"]);
    expect(crops.varieties).toHaveLength(0);
    const sellers = await svc().search("floret", { limit: 10 });
    expect(sellers.sellers.map((s) => s.href)).toContain("/seller/floret");
  });

  it("every logged search writes a search_events row, incl. zero results", async () => {
    const before = (await raw("SELECT count(*) n FROM search_events").first<{ n: number }>())!.n;
    const r = await svc().search("qqqxyz", { limit: 10, logClient: "test" });
    expect(r.results).toHaveLength(0);
    await svc().search("zinnia", { limit: 10, logClient: "test" });
    await svc().search("zinnia", { limit: 10 }); // not logged (no client)
    const rows = await raw("SELECT query_normalized, result_count, client FROM search_events ORDER BY id DESC LIMIT 2").all<Record<string, unknown>>();
    expect((await raw("SELECT count(*) n FROM search_events").first<{ n: number }>())!.n).toBe(before + 2);
    expect(rows.results[1]).toEqual({ query_normalized: "qqqxyz", result_count: 0, client: "test" });
    expect(Number(rows.results[0]!.result_count)).toBeGreaterThan(0);
  });
});

describe("sync (R9)", () => {
  it("snapshot: public shapes, approved sellers, published listings, all live varieties", async () => {
    const s = await createServices(t.db).sync.snapshot();
    expect(s.schema_version).toBe(1);
    expect([s.crops.length, s.series.length, s.varieties.length, s.sellers.length, s.listings.length]).toEqual([124, 32, 778, 25, 17]);
    expect(s.catalog_seq).toBe(await createServices(t.db).catalog.catalogSeq());
  });

  it("changes: since 0 returns everything as upserts; future since → 400; negative → 410 resync_required", async () => {
    const sync = createServices(t.db).sync;
    const seq = await sync.catalogSeq();
    const all = await sync.changes(0, 1000);
    expect(all.has_more).toBe(false);
    expect(all.next_seq).toBe(seq);
    expect(all.upserts.varieties).toHaveLength(778);
    expect(all.upserts.listings).toHaveLength(17);
    const none = await sync.changes(seq, 100);
    expect(none).toMatchObject({ deletes: [], next_seq: seq, has_more: false });
    await expect(sync.changes(seq + 1)).rejects.toMatchObject({ status: 400, code: "invalid_since" });
    await expect(sync.changes(-1)).rejects.toMatchObject({ status: 410, code: "resync_required" });
  });

  it("changes page without splitting a sequence number and walk to the end", async () => {
    const sync = createServices(t.db).sync;
    let since = 0;
    let n = 0;
    for (let i = 0; i < 100; i++) {
      const c = await sync.changes(since, 10);
      n += Object.values(c.upserts).reduce((a, x) => a + (x === c.upserts.names ? 0 : x.length), 0) + c.deletes.length;
      expect(c.next_seq).toBeGreaterThanOrEqual(since);
      since = c.next_seq;
      if (!c.has_more) break;
    }
    expect(n).toBe(124 + 32 + 778 + 25 + 17);
  });
});

describe("variety media read path (media delta R2/R7)", () => {
  const SLUG = "zinnia-queen-lime-blush";
  const insert = (slug: string, key: string, licence: string, credit: string) =>
    raw(
      "INSERT INTO media (variety_id, r2_key, licence, credit, created_at) SELECT id, ?, ?, ?, '2026-11-16T00:00:00.000Z' FROM varieties WHERE slug = ?",
      key,
      licence,
      credit,
      slug,
    ).run();

  it("maps media rows (r2_key → url, licence, credit) ordered by id; no rows → []", async () => {
    const before = (await svc().getVariety(SLUG))!;
    expect(before.media).toEqual([]);
    expect((await svc().getVariety("sweet-pea-albutt-blue"))!.media).toEqual([]);
    try {
      await insert(SLUG, "/artwork/zinnia-queen-lime-blush.webp", "Own work, all rights reserved", "Illustration by Hues Floral Park");
      await insert(SLUG, "/artwork/zinnia-queen-lime-blush-2.webp", "Own work (second)", "Second credit");
      const v = (await svc().getVariety(SLUG))!;
      expect(v.media).toEqual([
        { url: "/artwork/zinnia-queen-lime-blush.webp", licence: "Own work, all rights reserved", credit: "Illustration by Hues Floral Park" },
        { url: "/artwork/zinnia-queen-lime-blush-2.webp", licence: "Own work (second)", credit: "Second credit" },
      ]);
      // Rows on one variety never leak onto another.
      expect((await svc().getVariety("sweet-pea-albutt-blue"))!.media).toEqual([]);
      // Media stays out of the published sync snapshot (allowlist unchanged).
      expect(JSON.stringify(await createServices(t.db).sync.snapshot())).not.toContain("/artwork/");
    } finally {
      await raw("DELETE FROM media WHERE variety_id = (SELECT id FROM varieties WHERE slug = ?)", SLUG).run();
    }
    expect((await svc().getVariety(SLUG))!.media).toEqual([]);
  });
});

describe("plant media read path (plant-media delta R2/R5)", () => {
  const insertPlant = (slug: string, key: string, licence: string, credit: string) =>
    raw(
      "INSERT INTO media (plant_id, r2_key, licence, credit, created_at) SELECT id, ?, ?, ?, '2026-11-16T00:00:00.000Z' FROM plants WHERE slug = ?",
      key,
      licence,
      credit,
      slug,
    ).run();
  const cropMedia = async (slug: string) => (await svc().getCrop(slug, { page: { offset: 0, limit: 1 } }))!.crop.media;

  // Image-CDN migration (2026-11-18): media is the stored row only — no computed thumbUrl any more
  // (card sizes are lib/images transformations of `url`); `url` stays the canonical stored path.
  it("getCrop / listCrops map rows as stored (no thumbUrl), in id order; no rows → []; variety media unchanged", async () => {
    // One unpaged list of every crop (124 > the 100-row API page), so first and last are both in it.
    const everyCrop = { offset: 0, limit: 1000 };
    const all = (await svc().listCrops(everyCrop)).items;
    expect(all).toHaveLength(124);
    for (const c of all) expect(c.media).toEqual([]);
    // First and last crop alphabetically: with 124 ids the bulk loader runs three chunks (50 + 50 + 24).
    const first = all[0]!.slug;
    expect(all.at(-1)!.slug).toBe("zinnia");
    expect(await cropMedia("zinnia")).toEqual([]);
    try {
      await insertPlant("zinnia", "/artwork/crops/zinnia.webp", "Own work, all rights reserved", "Illustration by Hues Floral Park");
      // A second row outside /artwork/crops/ maps the same way.
      await insertPlant("zinnia", "/artwork/zinnia-alt.webp", "Own work (second)", "Second credit");
      await insertPlant(first, `/artwork/crops/${first}.webp`, "Own work", "Illustration by Hues Floral Park");
      // A variety row on a zinnia variety never shows up as crop media (and vice versa).
      await raw(
        "INSERT INTO media (variety_id, r2_key, licence, credit, created_at) SELECT id, '/artwork/zinnia-queen-lime-blush.webp', 'Own work', 'V', '2026-11-16T00:00:00.000Z' FROM varieties WHERE slug = 'zinnia-queen-lime-blush'",
      ).run();

      const zinnia = [
        { url: "/artwork/crops/zinnia.webp", licence: "Own work, all rights reserved", credit: "Illustration by Hues Floral Park" },
        { url: "/artwork/zinnia-alt.webp", licence: "Own work (second)", credit: "Second credit" },
      ];
      expect(await cropMedia("zinnia")).toEqual(zinnia);
      for (const m of await cropMedia("zinnia")) expect(m).not.toHaveProperty("thumbUrl");
      const listed = (await svc().listCrops(everyCrop)).items;
      const bySlug = new Map(listed.map((c) => [c.slug, c.media]));
      expect(bySlug.get("zinnia")).toEqual(zinnia);
      expect(bySlug.get(first)).toEqual([
        { url: `/artwork/crops/${first}.webp`, licence: "Own work", credit: "Illustration by Hues Floral Park" },
      ]);
      expect(listed.filter((c) => c.media.length > 0).map((c) => c.slug).sort()).toEqual([first, "zinnia"].sort());
      expect(await cropMedia("yarrow")).toEqual([]);
      // Variety media: unchanged shape, never a thumbUrl, never the plant's rows.
      expect((await svc().getVariety("zinnia-queen-lime-blush"))!.media).toEqual([
        { url: "/artwork/zinnia-queen-lime-blush.webp", licence: "Own work", credit: "V" },
      ]);
      expect((await svc().getVariety("zinnia-dearest-bubblegum"))!.media).toEqual([]);
      // Media stays out of the published sync snapshot (allowlist unchanged).
      expect(JSON.stringify(await createServices(t.db).sync.snapshot())).not.toContain("/artwork/");
    } finally {
      await raw("DELETE FROM media").run();
    }
    expect(await cropMedia("zinnia")).toEqual([]);
  });
});

describe("season classes (seeds-v2-season)", () => {
  it("import writes season_class + its source; unclassified crops stay NULL", async () => {
    const rows = await raw(
      `SELECT p.slug, p.season_class, s.slug AS source FROM plants p LEFT JOIN sources s ON s.id = p.season_source_id
       WHERE p.slug IN ('sweet-pea', 'zinnia', 'china-aster', 'foxglove') ORDER BY p.slug`,
    ).all<{ slug: string; season_class: string | null; source: string | null }>();
    expect(rows.results).toEqual([
      { slug: "china-aster", season_class: "warm_season_tender_annual", source: "src-floret-library-sowing-notes" },
      { slug: "foxglove", season_class: null, source: null },
      { slug: "sweet-pea", season_class: "cool_season_hardy_annual", source: "src-tgw-cool-season-seeds" },
      { slug: "zinnia", season_class: "warm_season_tender_annual", source: "src-tgw-warm-season-seeds" },
    ]);
    const counts = await raw("SELECT season_class, count(*) n, count(season_source_id) sourced FROM plants GROUP BY season_class ORDER BY season_class").all();
    expect(counts.results).toEqual([
      { season_class: null, n: 36, sourced: 0 },
      { season_class: "cool_season_hardy_annual", n: 52, sourced: 52 },
      { season_class: "warm_season_tender_annual", n: 36, sourced: 36 },
    ]);
    await expect(raw("UPDATE plants SET season_class = 'perennial' WHERE slug = 'foxglove'").run()).rejects.toThrow(/CHECK/);
  });

  it("listCrops filters by season (cool 52, warm 36; unfiltered 124)", async () => {
    const page = { offset: 0, limit: 100 };
    const cool = await svc().listCrops(page, { season: "cool_season_hardy_annual" });
    const warm = await svc().listCrops(page, { season: "warm_season_tender_annual" });
    expect([cool.total, cool.items.length, warm.total, warm.items.length]).toEqual([52, 52, 36, 36]);
    expect(cool.items.every((c) => c.season_class === "cool_season_hardy_annual" && c.season_source_label)).toBe(true);
    expect(warm.items.every((c) => c.season_class === "warm_season_tender_annual")).toBe(true);
    expect(cool.items.map((c) => c.slug)).toContain("sweet-pea");
    expect(warm.items.map((c) => c.slug)).toEqual(expect.arrayContaining(["zinnia", "china-aster"]));
    const all = await svc().listCrops(page);
    expect(all.total).toBe(124);
    expect(all.items.find((c) => c.slug === "foxglove")).toMatchObject({ season_class: null, season_source_label: null });
  });

  it("listVarieties filters by the crop's season (cool 335, warm 286; unclassified crops never match)", async () => {
    const page = { offset: 0, limit: 100 };
    const cool = await svc().listVarieties({ filters: { season: ["cool_season_hardy_annual"] }, page });
    const warm = await svc().listVarieties({ filters: { season: ["warm_season_tender_annual"] }, page });
    expect([cool.total, warm.total]).toEqual([335, 286]);
    expect(cool.items.every((v) => v.plant.season_class === "cool_season_hardy_annual")).toBe(true);
    expect(warm.items.every((v) => v.plant.season_class === "warm_season_tender_annual")).toBe(true);
    const both = await svc().listVarieties({ filters: { season: ["cool_season_hardy_annual", "warm_season_tender_annual"] }, page });
    expect(both.total).toBe(621); // 778 − 157 varieties of unclassified crops
    const combined = await svc().listVarieties({ filters: { season: ["warm_season_tender_annual"], plant: ["sweet-pea"] }, page });
    expect(combined.total).toBe(0);
  });

  it("variety detail + listings carry the crop's season class and source label", async () => {
    const sp = await svc().getVariety("sweet-pea-emma");
    expect(sp!.plant.season_class).toBe("cool_season_hardy_annual");
    expect(sp!.plant.season_source_label).toMatch(/^The Gardener's Workshop/);
    expect(sp!.listings.every((l) => l.variety.plant.season_class === "cool_season_hardy_annual")).toBe(true);
    const aster = await svc().getVariety("china-aster-harlekin-violet");
    expect(aster!.plant.season_source_label).toMatch(/^Floret Library/);
    const fox = await svc().getVariety("foxglove-alba");
    expect(fox!.plant).toMatchObject({ season_class: null, season_source_label: null });
    const series = await svc().getSeries("zinnia-dearest");
    expect(series!.crop.season_class).toBe("warm_season_tender_annual");
  });

  it("search filters crops, series and varieties by season; sellers are unaffected", async () => {
    const warm = await svc().search("zinnia", { limit: 50, season: "warm_season_tender_annual" });
    expect(warm.crops.map((c) => c.slug)).toEqual(["zinnia"]);
    expect(warm.varieties.length).toBeGreaterThan(0);
    const cool = await svc().search("zinnia", { limit: 50, season: "cool_season_hardy_annual" });
    expect([cool.crops, cool.series, cool.varieties]).toEqual([[], [], []]);
    expect((await svc().search("dearest", { season: "warm_season_tender_annual" })).series.map((s) => s.slug)).toEqual(["zinnia-dearest"]);
    expect((await svc().search("dearest", { season: "cool_season_hardy_annual" })).series).toEqual([]);
    const sweet = await svc().search("sweet pea", { limit: 50, season: "cool_season_hardy_annual" });
    expect(sweet.varieties.length).toBeGreaterThan(0);
    const coolSlugs = new Set((await svc().listVarieties({ filters: { season: ["cool_season_hardy_annual"] }, page: { offset: 0, limit: 400 } })).items.map((v) => v.slug));
    expect(sweet.varieties.every((v) => coolSlugs.has(v.slug))).toBe(true);
    const sellers = await svc().search("floret", { types: ["seller"], season: "warm_season_tender_annual" });
    expect(sellers.sellers.map((s) => s.slug)).toContain("floret");
  });

  it("sync crops carry season_class + season_source_id", async () => {
    const snap = await createServices(t.db).sync.snapshot();
    const bySlug = new Map(snap.crops.map((c) => [c.slug, c]));
    const src = await raw("SELECT id FROM sources WHERE slug = 'src-tgw-cool-season-seeds'").first<{ id: number }>();
    expect(bySlug.get("sweet-pea")).toMatchObject({ season_class: "cool_season_hardy_annual", season_source_id: src!.id });
    expect(bySlug.get("foxglove")).toMatchObject({ season_class: null, season_source_id: null });
  });
});

describe("sowing methods + hue (seeds-v2 brief #2)", () => {
  const all = { offset: 0, limit: 1000 };

  it("import writes crop sowing methods + their source; crops without methods have no rows", async () => {
    const rows = await raw(
      `SELECT p.slug, (SELECT group_concat(m.method) FROM (SELECT method FROM plant_sowing_methods WHERE plant_id = p.id ORDER BY method) m) AS methods,
              s.slug AS source
       FROM plants p LEFT JOIN sources s ON s.id = p.sowing_method_source_id
       WHERE p.slug IN ('larkspur', 'breadseed-poppy', 'dahlia', 'eucalyptus') ORDER BY p.slug`,
    ).all<{ slug: string; methods: string | null; source: string | null }>();
    expect(rows.results).toEqual([
      { slug: "breadseed-poppy", methods: "direct_sow", source: "src-floret-library-sowing-notes" },
      { slug: "dahlia", methods: "transplant", source: "src-floret-library-sowing-notes" },
      { slug: "eucalyptus", methods: null, source: null },
      { slug: "larkspur", methods: "direct_sow,transplant", source: "src-floret-library-sowing-notes" },
    ]);
    const counts = await raw("SELECT method, count(*) n FROM plant_sowing_methods GROUP BY method ORDER BY method").all();
    expect(counts.results).toEqual([
      { method: "direct_sow", n: 50 },
      { method: "transplant", n: 114 },
    ]);
    // Provenance is set exactly when a crop has methods (120 of 124).
    const sourced = await raw(
      "SELECT count(*) n FROM plants WHERE (sowing_method_source_id IS NOT NULL) <> (id IN (SELECT plant_id FROM plant_sowing_methods))",
    ).first<{ n: number }>();
    expect(sourced!.n).toBe(0);
    await expect(raw("INSERT INTO plant_sowing_methods (plant_id, method) VALUES (1, 'broadcast')").run()).rejects.toThrow(/CHECK/);
  });

  it("re-import replaces method rows instead of accumulating them", async () => {
    await importCatalog(t.db, loadCatalogJson());
    const n = await raw("SELECT count(*) n FROM plant_sowing_methods").first<{ n: number }>();
    expect(n!.n).toBe(164);
  });

  it("PlantRef carries sowing_methods in canonical order (never omitted) + the source label", async () => {
    const lark = (await svc().getCrop("larkspur", { page: { offset: 0, limit: 1 } }))!.crop;
    expect(lark.sowing_methods).toEqual(["direct_sow", "transplant"]);
    expect(lark.sowing_method_source_label).toMatch(/^Floret Library — Sowing & Growing Notes/);
    const euc = (await svc().getCrop("eucalyptus", { page: { offset: 0, limit: 1 } }))!.crop;
    expect(euc).toMatchObject({ sowing_methods: [], sowing_method_source_label: null });
    const dahlia = (await svc().listVarieties({ filters: { plant: ["dahlia"] }, page: { offset: 0, limit: 1 } })).items[0]!;
    expect(dahlia.plant.sowing_methods).toEqual(["transplant"]);
    const sp = await svc().getVariety("sweet-pea-emma");
    expect(sp!.listings.every((l) => Array.isArray(l.variety.plant.sowing_methods))).toBe(true);
    expect((await svc().getSeries("zinnia-dearest"))!.crop.sowing_methods.length).toBeGreaterThan(0);
  });

  it("colour families land on varieties; absent → 'unknown'", async () => {
    const fam = async (slug: string) => (await raw("SELECT color_family c FROM varieties WHERE slug = ?", slug).first<{ c: string }>())!.c;
    expect(await fam("zinnia-queen-lime-blush")).toBe("green");
    expect(await fam("cosmos-cupcakes-blush")).toBe("blush");
    const known = await raw("SELECT count(*) n FROM varieties WHERE color_family <> 'unknown'").first<{ n: number }>();
    expect(known!.n).toBeGreaterThanOrEqual(550);
    expect(known!.n).toBe(714);
    const v = await svc().getVariety("cosmos-cupcakes-blush");
    expect(v!.facts.color_family).toBe("blush");
  });

  it("listCrops filters by method (ANY-of; a crop with both appears under either)", async () => {
    const direct = await svc().listCrops(all, { methods: ["direct_sow"] });
    const trays = await svc().listCrops(all, { methods: ["transplant"] });
    expect([direct.total, trays.total]).toEqual([50, 114]);
    expect(direct.items.every((c) => c.sowing_methods.includes("direct_sow"))).toBe(true);
    expect(trays.items.every((c) => c.sowing_methods.includes("transplant"))).toBe(true);
    expect(direct.items.map((c) => c.slug)).toEqual(expect.arrayContaining(["larkspur", "breadseed-poppy"]));
    expect(trays.items.map((c) => c.slug)).toEqual(expect.arrayContaining(["larkspur", "dahlia"]));
    expect(direct.items.map((c) => c.slug)).not.toContain("dahlia");
    const either = await svc().listCrops(all, { methods: ["direct_sow", "transplant"] });
    expect(either.total).toBe(120);
    expect(either.items.map((c) => c.slug)).not.toContain("eucalyptus");
    const coolDirect = await svc().listCrops(all, { season: "cool_season_hardy_annual", methods: ["direct_sow"] });
    expect(coolDirect.total).toBe(21);
    expect(coolDirect.items.every((c) => c.season_class === "cool_season_hardy_annual" && c.sowing_methods.includes("direct_sow"))).toBe(true);
  });

  it("listVarieties filters by the crop's method, combines with season, and by colour family", async () => {
    const direct = await svc().listVarieties({ filters: { methods: ["direct_sow"] }, page: all });
    expect(direct.total).toBe(347);
    expect(direct.items.every((v) => v.plant.sowing_methods.includes("direct_sow"))).toBe(true);
    const trays = await svc().listVarieties({ filters: { methods: ["transplant"] }, page: all });
    expect(trays.total).toBe(734);

    const cool = new Set((await svc().listVarieties({ filters: { season: ["cool_season_hardy_annual"] }, page: all })).items.map((v) => v.slug));
    const both = await svc().listVarieties({ filters: { season: ["cool_season_hardy_annual"], methods: ["direct_sow"] }, page: all });
    expect(both.total).toBe(75);
    expect(both.items.map((v) => v.slug)).toEqual(direct.items.map((v) => v.slug).filter((s) => cool.has(s)));

    const blush = await svc().listVarieties({ filters: { colorFamily: ["blush"] }, page: all });
    expect(blush.total).toBe(19);
    expect(blush.items.every((v) => v.colorFamily === "blush")).toBe(true);
    expect(blush.items.map((v) => v.slug)).toContain("cosmos-cupcakes-blush");
  });

  it("search filters crops, series and varieties by method and varieties by colour family", async () => {
    // Zinnia is transplant-or-direct; dahlia is transplant only.
    const dahliaDirect = await svc().search("dahlia", { limit: 50, methods: ["direct_sow"] });
    expect([dahliaDirect.crops, dahliaDirect.series, dahliaDirect.varieties]).toEqual([[], [], []]);
    const dahliaTrays = await svc().search("dahlia", { limit: 50, methods: ["transplant"] });
    expect(dahliaTrays.crops.map((c) => c.slug)).toEqual(["dahlia"]);
    const directSlugs = new Set((await svc().listVarieties({ filters: { methods: ["direct_sow"] }, page: all })).items.map((v) => v.slug));
    const lark = await svc().search("larkspur", { limit: 50, methods: ["direct_sow"] });
    expect(lark.varieties.length).toBeGreaterThan(0);
    expect(lark.varieties.every((v) => directSlugs.has(v.slug))).toBe(true);

    const blushSlugs = new Set((await svc().listVarieties({ filters: { colorFamily: ["blush"] }, page: all })).items.map((v) => v.slug));
    const cosmos = await svc().search("cosmos", { limit: 50, colorFamily: ["blush"] });
    expect(cosmos.varieties.map((v) => v.slug)).toContain("cosmos-cupcakes-blush");
    expect(cosmos.varieties.every((v) => blushSlugs.has(v.slug))).toBe(true);
    expect(cosmos.crops.map((c) => c.slug)).toContain("cosmos"); // hue is variety-level
    const sellers = await svc().search("floret", { types: ["seller"], methods: ["direct_sow"], colorFamily: ["blue"] });
    expect(sellers.sellers.map((s) => s.slug)).toContain("floret");
  });

  it("sync crops carry sowing_methods + sowing_method_source_id", async () => {
    const snap = await createServices(t.db).sync.snapshot();
    const bySlug = new Map(snap.crops.map((c) => [c.slug, c]));
    const src = await raw("SELECT id FROM sources WHERE slug = 'src-floret-library-sowing-notes'").first<{ id: number }>();
    expect(bySlug.get("larkspur")).toMatchObject({ sowing_methods: ["direct_sow", "transplant"], sowing_method_source_id: src!.id });
    expect(bySlug.get("eucalyptus")).toMatchObject({ sowing_methods: [], sowing_method_source_id: null });
    expect(snap.varieties.find((v) => v.slug === "cosmos-cupcakes-blush")!.color_family).toBe("blush");
  });
});

describe("grower guide (crop-page grower guide task)", () => {
  it("import writes life cycle, hardiness, the guide JSON + its source for the 14 covered crops only", async () => {
    const rows = await raw(
      `SELECT p.slug, p.life_cycle, p.grower_guide IS NOT NULL AS has_guide, s.slug AS source
       FROM plants p LEFT JOIN sources s ON s.id = p.grower_guide_source_id
       WHERE p.grower_guide IS NOT NULL OR s.slug = 'src-seed-saving-grower-notes'
       ORDER BY p.slug`,
    ).all<{ slug: string; life_cycle: string; has_guide: number; source: string }>();
    expect(rows.results.map((r) => r.slug)).toEqual([
      "breadseed-poppy", "calendula", "celosia", "cornflower", "cosmos", "echinacea", "larkspur", "marigold",
      "nigella", "pincushion-flower", "strawflower", "sunflower", "sweet-pea", "zinnia",
    ]);
    expect(rows.results.every((r) => r.has_guide === 1 && r.source === "src-seed-saving-grower-notes")).toBe(true);
    expect(rows.results.find((r) => r.slug === "sweet-pea")!.life_cycle).toBe("Hardy annual");
  });

  it("getCrop carries the guide (nulls explicit, no source label); uncovered crops carry nulls", async () => {
    const page = { offset: 0, limit: 24 };
    const zinnia = (await svc().getCrop("zinnia", { page }))!.crop;
    expect(zinnia.life_cycle).toBe("Annual");
    expect(zinnia.hardiness).toBe("Annual — plant out after frost; the first frost ends it.");
    expect(zinnia.grower_guide!.growing!.harvest_for_cutting).toBeTruthy();
    expect(zinnia.grower_guide!.growing!.good_to_know).toEqual([]);
    expect(zinnia.grower_guide!.seed_saving!.difficulty).toBe("easy");
    expect(JSON.stringify(zinnia.grower_guide)).not.toMatch(/source/i);
    const poppy = (await svc().getCrop("breadseed-poppy", { page }))!.crop;
    expect(poppy.grower_guide!.growing!.harvest_for_cutting).toBeNull();
    // yarrow: classified (life cycle + hardiness) but no guide content.
    const yarrow = (await svc().getCrop("yarrow", { page }))!.crop;
    expect([yarrow.life_cycle, yarrow.hardiness, yarrow.grower_guide]).toEqual(["Perennial", "Perennial in Zones 3-9.", null]);
    const soapwort = (await svc().getCrop("soapwort", { page }))!.crop;
    expect([soapwort.life_cycle, soapwort.hardiness, soapwort.grower_guide]).toEqual([null, null, null]);
  });

  it("the published snapshot carries the new plants columns (allowlist exports every plants column)", async () => {
    const { readSnapshotRows } = await import("@/lib/repositories/snapshot");
    const plantsRows = (await readSnapshotRows(t.db)).plants!;
    const z = plantsRows.find((r) => r.slug === "zinnia")!;
    expect(z.life_cycle).toBe("Annual");
    expect(typeof z.grower_guide).toBe("string");
    expect(plantsRows.find((r) => r.slug === "yarrow")!.grower_guide).toBeNull();
  });
});

describe("life-cycle classifications + filter (life-cycle filter task)", () => {
  const all = { offset: 0, limit: 700 };
  // Unpaged: the ANY-bucket list (121 crops) is larger than a 100-row page.
  const cropSlugs = async (lifeCycle: ("annual" | "biennial" | "perennial")[], extra = {}) =>
    (await svc().listCrops({ offset: 0, limit: 1000 }, { lifeCycle, ...extra })).items.map((c) => c.slug);

  it("import: 121 crops carry a life cycle (14 guide + 78 classified + 29 new crops, own sources); soapwort, ornamental-grass + trachelium none", async () => {
    const rows = await raw(
      `SELECT s.slug AS source, count(*) AS n FROM plants p JOIN sources s ON s.id = p.grower_guide_source_id
       WHERE p.life_cycle IS NOT NULL GROUP BY s.slug ORDER BY s.slug`,
    ).all<{ source: string; n: number }>();
    expect(rows.results).toEqual([
      { source: "src-new-crops-2026-11-18", n: 29 },
      { source: "src-seed-saving-classifications", n: 78 },
      { source: "src-seed-saving-grower-notes", n: 14 },
    ]);
    // The two held crops, plus trachelium (a 2026-11-18 new crop that ships without a life cycle).
    const held = await raw("SELECT slug, life_cycle, hardiness, grower_guide_source_id FROM plants WHERE slug IN ('soapwort', 'ornamental-grass', 'trachelium') ORDER BY slug").all();
    expect(held.results).toEqual([
      { slug: "ornamental-grass", life_cycle: null, hardiness: null, grower_guide_source_id: null },
      { slug: "soapwort", life_cycle: null, hardiness: null, grower_guide_source_id: null },
      { slug: "trachelium", life_cycle: null, hardiness: null, grower_guide_source_id: null },
    ]);
    expect((await raw("SELECT count(*) n FROM plants WHERE life_cycle IS NULL").first<{ n: number }>())!.n).toBe(3);
    const salvia = await raw("SELECT life_cycle, hardiness FROM plants WHERE slug = 'salvia'").first();
    expect(salvia).toEqual({ life_cycle: "Perennial", hardiness: null });
  });

  it("listCrops by life cycle: perennial has yarrow not cosmos, annual the reverse; or-cases in both; held crops in none", async () => {
    const perennial = await cropSlugs(["perennial"]);
    const annual = await cropSlugs(["annual"]);
    const biennial = await cropSlugs(["biennial"]);
    expect([annual.length, biennial.length, perennial.length]).toEqual([90, 8, 27]);
    expect(perennial).toContain("yarrow");
    expect(perennial).toContain("salvia");
    expect(perennial).not.toContain("cosmos");
    expect(annual).toContain("cosmos");
    expect(annual).toContain("bee-balm");
    expect(annual).toContain("clary-sage");
    expect(annual).not.toContain("yarrow");
    expect(annual).toContain("silene");
    expect(biennial).toContain("silene");
    const any = await cropSlugs(["annual", "biennial", "perennial"]);
    expect(any).toHaveLength(121);
    for (const held of ["soapwort", "ornamental-grass", "trachelium"]) expect(any).not.toContain(held);
  });

  it("listVarieties by life cycle (the crop's), AND-combined with season and method", async () => {
    const perennial = await svc().listVarieties({ filters: { lifeCycle: ["perennial"] }, page: all });
    expect(perennial.total).toBe(91);
    expect(perennial.items.some((v) => v.plant.slug === "yarrow")).toBe(true);
    expect(perennial.items.some((v) => v.plant.slug === "cosmos")).toBe(false);
    const annual = await svc().listVarieties({ filters: { lifeCycle: ["annual"] }, page: all });
    expect(annual.total).toBe(653);
    expect(annual.items.some((v) => v.plant.slug === "yarrow")).toBe(false);
    const cool = await svc().listVarieties({ filters: { lifeCycle: ["perennial"], season: ["cool_season_hardy_annual"] }, page: all });
    expect(cool.total).toBe(10);
    expect(cool.items.every((v) => v.plant.season_class === "cool_season_hardy_annual")).toBe(true);
    // 14 of the 2026-11-18 new perennial crops are direct-sown (before them, no perennial was).
    const direct = await svc().listVarieties({ filters: { lifeCycle: ["perennial"], methods: ["direct_sow"] }, page: all });
    expect(direct.total).toBe(54);
  });
});

describe("imported ratings + seller states (brief #4)", () => {
  const OR = ["peace-seedlings", "summertime-seed-co", "wild-west-seed"];

  it("import writes the six imported_rating columns for 7 sellers; the rest stay NULL; our rating is untouched", async () => {
    const rows = await raw(
      "SELECT slug, imported_rating_source s, imported_rating_place_name n, imported_rating_place_id p, imported_rating_value v, imported_rating_count c, imported_rating_fetched_at f, rating_count, rating_average FROM sellers ORDER BY slug",
    ).all<Record<string, string | number | null>>();
    const withRating = rows.results.filter((r) => r.s !== null);
    expect(withRating).toHaveLength(7);
    expect(rows.results.find((r) => r.slug === "johnnys-selected-seeds")).toMatchObject({
      s: "Google",
      n: "Johnny's Selected Seeds",
      p: "1108259913094783",
      v: 4.7,
      c: 313,
      f: "2026-11-16",
    });
    for (const r of rows.results.filter((x) => x.s === null)) expect([r.n, r.p, r.v, r.c, r.f]).toEqual([null, null, null, null, null]);
    for (const r of rows.results) expect([r.rating_count, r.rating_average]).toEqual([0, null]);
  });

  it("the DB refuses an imported rating outside 0–5 or from an unknown source", async () => {
    await expect(raw("UPDATE sellers SET imported_rating_value = 5.5 WHERE slug = 'floret'").run()).rejects.toThrow(/CHECK/);
    await expect(raw("UPDATE sellers SET imported_rating_source = 'Yelp' WHERE slug = 'floret'").run()).rejects.toThrow(/CHECK/);
  });

  it("seller payloads carry importedRating (null when absent) beside our not_yet_rated rating", async () => {
    const j = await svc().getSeller("johnnys-selected-seeds");
    expect(j!.importedRating).toEqual({
      source: "Google",
      placeName: "Johnny's Selected Seeds",
      placeId: "1108259913094783",
      rating: 4.7,
      reviewCount: 313,
      fetchedDate: "2026-11-16",
    });
    expect(j!.rating).toEqual({ state: "not_yet_rated", average: null, review_count: 0 });
    expect([j!.ratingCount, j!.ratingAverage]).toEqual([0, null]);
    expect((await svc().getSeller("floret"))!.importedRating).toBeNull();
    const list = (await svc().listSellers({ offset: 0, limit: 100 })).items;
    expect(list.filter((s) => s.importedRating).length).toBe(7);
    expect(list.every((s) => s.rating.state === "not_yet_rated")).toBe(true);
  });

  it("a partial imported rating fails loudly instead of rendering", async () => {
    await raw("UPDATE sellers SET imported_rating_count = NULL WHERE slug = 'johnnys-selected-seeds'").run();
    await expect(svc().getSeller("johnnys-selected-seeds")).rejects.toThrow(/Invalid seller detail/);
    await raw("UPDATE sellers SET imported_rating_count = 313 WHERE slug = 'johnnys-selected-seeds'").run();
  });

  it("sync snapshot + changes carry imported_rating (snake_case) or null", async () => {
    const sync = createServices(t.db).sync;
    const snap = await sync.snapshot();
    const j = snap.sellers.find((s) => s.slug === "johnnys-selected-seeds")!;
    expect(j.imported_rating).toEqual({
      source: "Google",
      place_name: "Johnny's Selected Seeds",
      place_id: "1108259913094783",
      rating: 4.7,
      review_count: 313,
      fetched_date: "2026-11-16",
    });
    expect(j.rating.state).toBe("not_yet_rated");
    expect(snap.sellers.find((s) => s.slug === "floret")!.imported_rating).toBeNull();
    const ch = await sync.changes(0, 1000);
    expect(ch.upserts.sellers.filter((s) => s.imported_rating).length).toBe(7);
  });

  it("listSellerStates: the 16 states with sellers, alphabetical, counts summing to 25", async () => {
    const states = await svc().listSellerStates();
    expect(states.map((s) => s.code).sort()).toEqual(["CA", "CO", "CT", "GA", "IA", "ME", "MN", "MT", "NV", "NY", "OR", "UT", "VA", "VT", "WA", "WI"]);
    expect(states.map((s) => s.name)).toEqual([...states.map((s) => s.name)].sort((a, b) => a.localeCompare(b)));
    expect(states.reduce((n, s) => n + s.sellerCount, 0)).toBe(25);
    expect(states.find((s) => s.code === "OR")).toEqual({ code: "OR", name: "Oregon", slug: "oregon", sellerCount: 3 });
    expect(states.find((s) => s.code === "WA")!.sellerCount).toBe(4);
    expect(states.find((s) => s.slug === "texas")).toBeUndefined();
  });

  it("listSellers filters by region: only that state's sellers", async () => {
    const or = (await svc().listSellers({ offset: 0, limit: 100 }, { region: ["OR"] })).items;
    expect(or.map((s) => s.slug).sort()).toEqual(OR);
    expect(or.every((s) => s.region === "OR")).toBe(true);
    const vt = await svc().listSellers({ offset: 0, limit: 100 }, { region: ["VT"] });
    expect(vt.total).toBe(3);
    expect(vt.items.map((s) => s.slug).sort()).toEqual(["american-meadows", "high-mowing-organic-seeds", "jig-bee-flower-farm"]);
    expect((await svc().listSellers({ offset: 0, limit: 100 }, { region: ["TX"] })).total).toBe(0);
  });

  it("a removed seller drops out of its state's count (the state page goes away with its last seller)", async () => {
    await raw("UPDATE sellers SET eligibility = 'removed_by_request' WHERE slug = 'johnnys-selected-seeds'").run();
    expect((await svc().listSellerStates()).find((s) => s.code === "ME")).toBeUndefined();
    expect((await svc().sitemapEntries()).states.map((s) => s.slug)).not.toContain("maine");
    await raw("UPDATE sellers SET eligibility = 'approved' WHERE slug = 'johnnys-selected-seeds'").run();
    const entries = await svc().sitemapEntries();
    expect(entries.states).toHaveLength(16);
    expect(entries.states.map((s) => s.slug)).toContain("maine");
  });
});

describe("Zod output validation fails loudly", () => {
  it("a malformed row throws instead of rendering", async () => {
    await raw("UPDATE varieties SET color_swatch = 'not-a-colour' WHERE slug = 'stock-katz-mix'").run();
    await expect(svc().getVariety("stock-katz-mix")).rejects.toThrow(/Invalid variety/);
    await raw("UPDATE varieties SET color_swatch = '#E8A0BF' WHERE slug = 'stock-katz-mix'").run();
  });
});
