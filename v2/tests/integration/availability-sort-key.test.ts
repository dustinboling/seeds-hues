/**
 * Tranche 3.4 B-1 follow-up, item 5 — the availability within-tier key through the real
 * query (coordinator ruling, 2026-11-23): within a tier, distinct-seller count desc,
 * tiebreak in-stock listings desc, then listings desc, then name asc. Five crafted
 * same-tier varieties carry adversarial names so every chain link beats name order; the
 * >50-ids variant proves the chunking merge (summaryComparator) agrees with the SQL.
 *
 * Non-vacuity: fails on pre-build code — the shipped key orders within-tier by listing
 * count, so the crafted set lands V5,V1,V4,V3,V2 instead of V1,V2,V5,V4,V3.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import { listings, sellers, sources, varieties, categories, plants } from "@/lib/db/schema";

let t: TestD1;
beforeAll(async () => {
  t = await createTestD1();
});
afterAll(async () => {
  await t?.dispose();
});

const svc = () => createServices(t.db).catalog;

interface Crafted {
  ids: number[];
  slugs: string[];
}

/** Insert the five-variety tiebreak set; resolves their ids + slugs in expected order. */
async function craftTiebreakSet(): Promise<Crafted> {
  const [plant] = await t.db.select({ id: plants.id }).from(plants).limit(1);
  const [category] = await t.db.select({ id: categories.id }).from(categories).limit(1);
  const [source] = await t.db.select({ id: sources.id }).from(sources).limit(1);
  if (!plant || !category || !source) throw new Error("sort-key test: seed catalog has no plant/category/source");
  const sellerRows = await t.db.select().from(sellers).limit(25);
  const visible = sellerRows.filter(
    (s) => s.status === "active" && s.eligibility === "approved" && s.listingPolicy !== "removed" && s.deletedAt === null,
  );
  let sellerIds = visible.slice(0, 3).map((s) => s.id);
  for (let i = sellerIds.length; i < 3; i++) {
    const [r] = await t.db
      .insert(sellers)
      .values({
        slug: `b1-sortkey-seller-${i}`,
        name: `B1 Sortkey Seller ${i}`,
        type: "retail",
        provenance: "owner-named",
        status: "active",
        eligibility: "approved",
        listingPolicy: "full",
      })
      .returning({ id: sellers.id });
    if (!r) throw new Error("sort-key test: seller insert returned no row");
    sellerIds = [...sellerIds, r.id];
  }
  const [s1, s2, s3] = sellerIds as [number, number, number];

  // name / sellers / in-stock / listings — every link adversarial to name order:
  // V2 (Zulu) beats V5/V4/V3 on in-stock; V4 (Oscar) beats V3 (Alpha) on listings;
  // V5 (Aaron) beats V4 (Oscar) on the full-tie name rule.
  const defs: { slug: string; name: string; offers: { seller: number; inStock: boolean }[] }[] = [
    {
      slug: "b1-sortkey-v1",
      name: "Testwort Mike",
      offers: [
        { seller: s1, inStock: true },
        { seller: s2, inStock: true },
        { seller: s3, inStock: true },
      ],
    },
    {
      slug: "b1-sortkey-v2",
      name: "Testwort Zulu",
      offers: [
        { seller: s1, inStock: true },
        { seller: s2, inStock: true },
      ],
    },
    {
      slug: "b1-sortkey-v5",
      name: "Testwort Aaron",
      offers: [
        { seller: s1, inStock: true },
        { seller: s2, inStock: false },
        { seller: s2, inStock: false },
      ],
    },
    {
      slug: "b1-sortkey-v4",
      name: "Testwort Oscar",
      offers: [
        { seller: s1, inStock: true },
        { seller: s1, inStock: false },
        { seller: s2, inStock: false },
      ],
    },
    {
      slug: "b1-sortkey-v3",
      name: "Testwort Alpha",
      offers: [
        { seller: s1, inStock: true },
        { seller: s2, inStock: false },
      ],
    },
  ];
  const ids: number[] = [];
  for (const d of defs) {
    const [v] = await t.db
      .insert(varieties)
      .values({ plantId: plant.id, categoryId: category.id, sourceId: source.id, slug: d.slug, varietyName: d.name })
      .returning({ id: varieties.id });
    if (!v) throw new Error(`sort-key test: variety insert returned no row (${d.slug})`);
    ids.push(v.id);
    for (const o of d.offers) {
      await t.db.insert(listings).values({
        varietyId: v.id,
        sellerId: o.seller,
        sourceId: source.id,
        status: "published",
        availability: o.inStock ? "in_stock" : "sold_out",
      });
    }
  }
  return { ids, slugs: defs.map((d) => d.slug) };
}

let crafted: Crafted;
beforeAll(async () => {
  crafted = await craftTiebreakSet();
});

describe("availability within-tier key through listVarieties (B-1 ruling)", () => {
  it("orders the crafted set V1,V2,V5,V4,V3 (sellers, in-stock, listings, name)", async () => {
    const r = await svc().listVarieties({ filters: { ids: crafted.ids }, sort: "availability", page: { offset: 0, limit: 10 } });
    expect(r.items.map((v) => v.slug)).toEqual(crafted.slugs);
  });

  it("the >50-ids chunking merge agrees with the SQL order", async () => {
    const real = await t.db.select({ id: varieties.id }).from(varieties).limit(60);
    const pad = real.map((r) => r.id).filter((id) => !crafted.ids.includes(id)).slice(0, 50);
    const ids = [...crafted.ids, ...pad];
    expect(ids.length).toBeGreaterThan(50);
    const r = await svc().listVarieties({ filters: { ids }, sort: "availability", page: { offset: 0, limit: ids.length } });
    const got = r.items.map((v) => v.slug).filter((s) => crafted.slugs.includes(s));
    expect(got).toEqual(crafted.slugs);
  });
});
