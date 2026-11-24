/**
 * Tranche 3.4 B-1 follow-up, item 5 — the availability within-tier key (coordinator ruling,
 * 2026-11-23): within a tier, distinct-seller count desc, tiebreak in-stock listings desc,
 * then listings desc, then name asc. Tier order itself is unchanged. Pins the repository's
 * summaryComparator (the ids-chunking merge); the SQL sortOrder's identical chain is pinned
 * through the service by tests/integration/availability-sort-key.test.ts.
 *
 * Non-vacuity: fails on pre-build code — summaryComparator is not exported there, and the
 * shipped key orders within-tier by listing count (the drive's Bouquet/Cinnamon pair ties
 * at 17 listings and falls through to name order).
 */
import { describe, expect, it } from "vitest";
import { summaryComparator, type VarietySummaryRow } from "@/lib/repositories/catalog-read";

function row(over: Partial<VarietySummaryRow> & { slug: string; varietyName: string }): VarietySummaryRow {
  return {
    id: 0,
    colorSwatch: null,
    colorFamily: "pink",
    indexable: true,
    plantId: 0,
    plantSlug: "sweet-pea",
    commonName: "Sweet Pea",
    latinName: null,
    lifeCycle: null,
    seasonClass: null,
    seasonSourceLabel: null,
    sowingMethods: null,
    sowingMethodSourceLabel: null,
    categorySlug: "flowers",
    categoryName: "Flowers",
    subcategorySlug: null,
    subcategoryName: null,
    seriesSlug: null,
    seriesName: null,
    listingCount: 0,
    sellerCount: 0,
    inStockCount: 0,
    lastChecked: null,
    ...over,
  };
}

const byAvailability = summaryComparator("availability");
const slugs = (rows: VarietySummaryRow[]): string[] => [...rows].sort(byAvailability).map((r) => r.slug);

describe("availability within-tier key: distinct sellers first (B-1 ruling)", () => {
  it("the drive's pair: equal listings, different sellers — Cinnamon (17 sellers) before Bouquet (16)", () => {
    const bouquet = row({ slug: "dill-bouquet", varietyName: "Bouquet", listingCount: 17, sellerCount: 16, inStockCount: 14 });
    const cinnamon = row({ slug: "basil-cinnamon", varietyName: "Cinnamon", listingCount: 17, sellerCount: 17, inStockCount: 16 });
    expect(slugs([bouquet, cinnamon])).toEqual(["basil-cinnamon", "dill-bouquet"]);
  });

  it("equal sellers → in-stock listings desc (beats name order)", () => {
    const few = row({ slug: "v-few", varietyName: "Alpha", listingCount: 4, sellerCount: 2, inStockCount: 1 });
    const many = row({ slug: "v-many", varietyName: "Zulu", listingCount: 2, sellerCount: 2, inStockCount: 2 });
    expect(slugs([few, many])).toEqual(["v-many", "v-few"]);
  });

  it("equal sellers + in-stock → listing count desc (beats name order)", () => {
    const few = row({ slug: "v-few", varietyName: "Alpha", listingCount: 2, sellerCount: 2, inStockCount: 1 });
    const many = row({ slug: "v-many", varietyName: "Zulu", listingCount: 3, sellerCount: 2, inStockCount: 1 });
    expect(slugs([few, many])).toEqual(["v-many", "v-few"]);
  });

  it("full count tie → name ascending, slug last", () => {
    const b = row({ slug: "v-b", varietyName: "Zulu", listingCount: 2, sellerCount: 2, inStockCount: 2 });
    const a = row({ slug: "v-a", varietyName: "Alpha", listingCount: 2, sellerCount: 2, inStockCount: 2 });
    expect(slugs([b, a])).toEqual(["v-a", "v-b"]);
    const same1 = row({ slug: "v-1", varietyName: "Same", listingCount: 1, sellerCount: 1, inStockCount: 1 });
    const same2 = row({ slug: "v-2", varietyName: "Same", listingCount: 1, sellerCount: 1, inStockCount: 1 });
    expect(slugs([same2, same1])).toEqual(["v-1", "v-2"]);
  });

  it("tiers still dominate: any in-stock variety beats any listed-only one, whatever the sellers", () => {
    const listed = row({ slug: "v-listed", varietyName: "Alpha", listingCount: 50, sellerCount: 40, inStockCount: 0 });
    const stocked = row({ slug: "v-stocked", varietyName: "Zulu", listingCount: 1, sellerCount: 1, inStockCount: 1 });
    const bare = row({ slug: "v-bare", varietyName: "Aaron", listingCount: null, sellerCount: null, inStockCount: null });
    expect(slugs([listed, bare, stocked])).toEqual(["v-stocked", "v-listed", "v-bare"]);
  });
});
