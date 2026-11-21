/**
 * Seller-labelled counts over a variety with several listings per seller (Dustin's ruling,
 * 2026-11-21). The seed catalog keeps variety×seller unique, so this suite adds a second
 * Songbird listing and a Floret listing to King's Ransom (3 listings, 2 sellers) and pins
 * every public seller-labelled count to the distinct-seller number. Own D1: the inserts
 * never leak into other suites.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import { visibleListingCounts, visibleSellerCounts } from "@/lib/repositories/waitlist";
import { sellerCounts } from "@/lib/seller-counts";

let t: TestD1;
beforeAll(async () => {
  t = await createTestD1();
  const raw = (sql: string, ...binds: unknown[]) => t.env.DB.prepare(sql).bind(...binds);
  const first = async <T>(sql: string, ...binds: unknown[]): Promise<T> => (await raw(sql, ...binds).first<T>())!;
  const varietyId = (await first<{ id: number }>("SELECT id FROM varieties WHERE slug = 'sweet-pea-kings-ransom'")).id;
  const songbirdId = (await first<{ id: number }>("SELECT id FROM sellers WHERE slug = 'songbird-seed-co'")).id;
  const floretId = (await first<{ id: number }>("SELECT id FROM sellers WHERE slug = 'floret'")).id;
  const sourceId = (await first<{ id: number }>("SELECT id FROM sources LIMIT 1")).id;
  // A second Songbird listing (another packet size) plus a Floret listing, both sold out; the
  // seeded Songbird listing stays the only in-stock one.
  await raw(
    "INSERT INTO listings (variety_id, seller_id, source_id, product_url, variant_key, status, availability, match_method, confidence, first_seen_at, last_checked_at, created_at, updated_at) VALUES (?, ?, ?, ?, '', 'active', 'sold_out', 'human', 1, '2026-11-15', '2026-11-15', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')",
    varietyId,
    songbirdId,
    sourceId,
    "https://www.songbirdseeds.com/seedshop/p/kingsransom-large",
  ).run();
  await raw(
    "INSERT INTO listings (variety_id, seller_id, source_id, product_url, variant_key, status, availability, match_method, confidence, first_seen_at, last_checked_at, created_at, updated_at) VALUES (?, ?, ?, ?, '', 'active', 'sold_out', 'human', 1, '2026-11-15', '2026-11-15', '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z')",
    varietyId,
    floretId,
    sourceId,
    "https://www.floretflowers.com/kings-ransom",
  ).run();
});
afterAll(async () => {
  await t?.dispose();
});

const svc = () => createServices(t.db).catalog;

describe("variety seller counts with 3 listings across 2 sellers", () => {
  it("the summary reports sellerCount 2 beside listingCount 3", async () => {
    const v = (await svc().getVariety("sweet-pea-kings-ransom"))!;
    expect(v.listings).toHaveLength(3);
    expect(v.listingCount).toBe(3);
    expect(v.sellerCount).toBe(2);
    const row = (await svc().listVarieties({ filters: { plant: ["sweet-pea"] }, page: { offset: 0, limit: 100 } })).items.find(
      (x) => x.slug === "sweet-pea-kings-ransom",
    )!;
    expect(row.listingCount).toBe(3);
    expect(row.sellerCount).toBe(2);
  });

  it("the About sentence names 2 seed sellers", async () => {
    const v = (await svc().getVariety("sweet-pea-kings-ransom"))!;
    expect(v.templateDescription).toContain("It is listed by 2 seed sellers in this directory.");
  });

  it("the search subtitle names 2 sellers", async () => {
    const r = await svc().search("king's ransom", { limit: 10 });
    expect(r.varieties[0]?.subtitle).toBe("Sweet Pea · 2 sellers");
  });

  it("the header counts are 2 shops with 1 in stock", async () => {
    const v = (await svc().getVariety("sweet-pea-kings-ransom"))!;
    expect(sellerCounts(v.listings)).toEqual({ sellers: 2, inStockSellers: 1 });
  });

  it("waitlist seller counts are distinct sellers, listing counts stay listings", async () => {
    const varietyId = (await t.env.DB.prepare("SELECT id FROM varieties WHERE slug = 'sweet-pea-kings-ransom'").first<{ id: number }>())!.id;
    expect((await visibleListingCounts(t.db, [varietyId])).get(varietyId)).toBe(3);
    expect((await visibleSellerCounts(t.db, [varietyId])).get(varietyId)).toBe(2);
  });
});
