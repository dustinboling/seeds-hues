/**
 * Dustin's ruling, 2026-11-21: any count the site labels as sellers or shops counts
 * distinct sellers, never listings. One seller can legitimately hold several listings for
 * the same variety — reverting any of these sites to listing counts must fail these tests.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VarietyCard } from "@/components/variety/VarietyCard";
import { sellerCounts } from "@/lib/seller-counts";
import { templateDescription } from "@/lib/services/template";
import type { PublicListing, VarietyListItem } from "@/lib/validators";

const plant = {
  slug: "sweet-pea",
  commonName: "Sweet Pea",
  latinName: "Lathyrus odoratus",
  lifeCycle: null,
  season_class: null,
  season_source_label: null,
  sowing_methods: [],
  sowing_method_source_label: null,
} as const;

function listing(id: number, sellerSlug: string, sellerName: string, availability: PublicListing["availability"]): PublicListing {
  return {
    id,
    variety: { slug: "sweet-pea-kings-ransom", varietyName: "King's Ransom", plant: { ...plant, sowing_methods: [] }, colorSwatch: null, colorFamily: "pink", media: [], cropMedia: [] },
    seller: { slug: sellerSlug, name: sellerName, location: null, region: "WA", country: "US", isSmallFarm: false },
    availability,
    lastCheckedAt: "2026-11-15",
    firstSeenAt: "2026-11-15",
    goUrl: `https://seeds.hues.flowers/go/${id}`,
    productUrl: `https://example.test/${sellerSlug}/${id}`,
    notes: null,
    status: "published",
    packetSizes: [{ label: "Packet", seedCount: 10 }],
    provenance: { source_url: null, retrieved_at: "2026-11-15", method: "human", confidence: 1 },
    sourceLabel: "Shop check",
  };
}

/** 3 listings across 2 sellers: one seller holds an in-stock and a sold-out listing. */
const threeAcrossTwo = [
  listing(1, "songbird-seed-co", "Songbird Seed Co.", "in_stock"),
  listing(2, "songbird-seed-co", "Songbird Seed Co.", "sold_out"),
  listing(3, "floret", "Floret", "sold_out"),
];

function summary(over: Partial<VarietyListItem> = {}): VarietyListItem {
  return {
    slug: "sweet-pea-kings-ransom",
    varietyName: "King's Ransom",
    plant: { ...plant, sowing_methods: [] },
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: null,
    colorSwatch: null,
    colorFamily: "pink",
    listingCount: 3,
    sellerCount: 2,
    inStockCount: 1,
    lastCheckedAt: "2026-11-15",
    indexable: true,
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    media: [],
    cropMedia: [],
    ...over,
  };
}

describe("sellerCounts (variety header: 'N shops · M in stock')", () => {
  it("counts distinct sellers, and distinct sellers with an in-stock listing", () => {
    expect(sellerCounts(threeAcrossTwo)).toEqual({ sellers: 2, inStockSellers: 1 });
  });

  it("counts a lone seller with two listings once", () => {
    expect(sellerCounts(threeAcrossTwo.slice(0, 2))).toEqual({ sellers: 1, inStockSellers: 1 });
  });

  it("is zero with no listings", () => {
    expect(sellerCounts([])).toEqual({ sellers: 0, inStockSellers: 0 });
  });
});

describe("template description seller sentence", () => {
  it("names the distinct-seller count, not the listing count", () => {
    const d = templateDescription({ varietyName: "King's Ransom", commonName: "Sweet Pea", latinName: "Lathyrus odoratus", sellerCount: 2 });
    expect(d).toBe("King's Ransom is a Sweet Pea variety (Lathyrus odoratus). It is listed by 2 seed sellers in this directory.");
    expect(d).not.toContain("3 seed sellers");
  });

  it("keeps the 0 / 1 sentence shapes", () => {
    expect(templateDescription({ varietyName: "X", commonName: "Stock", latinName: null, sellerCount: 0 })).toContain(
      "No seller found selling X yet.",
    );
    expect(templateDescription({ varietyName: "X", commonName: "Stock", latinName: null, sellerCount: 1 })).toContain(
      "It is listed by 1 seed seller in this directory.",
    );
  });
});

describe("VarietyCard seller label", () => {
  it("shows distinct sellers, not listings", () => {
    const html = renderToStaticMarkup(createElement(VarietyCard, { v: summary({ listingCount: 3, sellerCount: 2 }) }));
    expect(html).toContain("2 sellers");
    expect(html).not.toContain("3 sellers");
  });

  it("shows the empty state only when no seller lists it", () => {
    expect(renderToStaticMarkup(createElement(VarietyCard, { v: summary({ listingCount: 0, sellerCount: 0 }) }))).toContain("No sellers yet");
    expect(renderToStaticMarkup(createElement(VarietyCard, { v: summary({ listingCount: 2, sellerCount: 1 }) }))).toContain("1 seller");
  });
});
