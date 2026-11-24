import { describe, expect, it } from "vitest";
import {
  assertNoProhibitedJsonLd,
  breadcrumbJsonLd,
  organizationJsonLd,
  parseLocation,
  ProhibitedJsonLdError,
  siteOrganizationJsonLd,
  varietySellersJsonLd,
  websiteJsonLd,
} from "@/lib/seo/jsonld";
import { varietyDescription, varietyTitle } from "@/lib/seo/metadata";
import { answerSentence } from "@/lib/services/catalog";
import { templateDescription } from "@/lib/services/template";
import { ZERO_SELLER_TITLE, zeroSellerSentence } from "@/lib/zero-seller";
import type { PublicListing, VarietyDetail } from "@/lib/validators";
import { fakeSellerDetail } from "../helpers/seller-detail";

const listing = (id: number, sellerSlug: string, sellerName: string, checked: string): PublicListing => ({
  id,
  variety: { slug: "test-variety", varietyName: "Test", plant: { slug: "p", commonName: "Sweet Pea", latinName: "Lathyrus odoratus", lifeCycle: null, season_class: null, season_source_label: null, sowing_methods: [], sowing_method_source_label: null }, colorSwatch: null, colorFamily: "unknown", media: [], cropMedia: [] },
  seller: { slug: sellerSlug, name: sellerName, location: null, region: "WA", country: "US", isSmallFarm: false },
  availability: "in_stock",
  lastCheckedAt: checked,
  firstSeenAt: checked,
  goUrl: `https://seeds.hues.flowers/go/${id}`,
  productUrl: null,
  notes: null,
  status: "published",
  packetSizes: [{ label: "Packet", seedCount: 10 }],
  provenance: { source_url: null, retrieved_at: checked, method: "human", confidence: 1 },
  sourceLabel: "Shop check",
});

function variety(listings: PublicListing[]): VarietyDetail {
  return {
    slug: "test-variety",
    varietyName: "Test",
    plant: { slug: "p", commonName: "Sweet Pea", latinName: "Lathyrus odoratus", lifeCycle: null, season_class: null, season_source_label: null, sowing_methods: [], sowing_method_source_label: null, description: null, sowingNotes: null },
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: null,
    colorSwatch: null,
    colorFamily: "unknown",
    listingCount: listings.length,
    sellerCount: new Set(listings.map((l) => l.seller.slug)).size,
    inStockCount: listings.length,
    lastCheckedAt: listings[0]?.lastCheckedAt ?? null,
    indexable: true, // owner ruling 2026-11-16: every active variety is indexable
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    description: null,
    templateDescription: "t",
    answer: answerSentence("Test", listings),
    sowingNotes: null,
    heightCm: null,
    facts: { color_family: "unknown", pollination: "unknown", height_cm: { min: null, max: null }, days_to_bloom: { min: null, max: null } },
    tags: [],
    aliases: [],
    protection: "unknown",
    protectionNote: null,
    contentLevel: "thin",
    updatedAt: "2026-11-16",
    listings,
    media: [],
  };
}

describe("JSON-LD per the canonical §5 table (R4)", () => {
  it("variety: ItemList of sellers (deduplicated), never Product/Offer", () => {
    const v = variety([listing(1, "a", "Farm A", "2026-11-15"), listing(2, "b", "Farm B", "2026-11-14"), listing(3, "a", "Farm A", "2026-11-13")]);
    const ld = varietySellersJsonLd(v);
    expect(ld["@type"]).toBe("ItemList");
    expect((ld.itemListElement as { url: string }[]).map((i) => i.url)).toEqual([
      "https://seeds.hues.flowers/seller/a",
      "https://seeds.hues.flowers/seller/b",
    ]);
    const json = JSON.stringify(ld);
    for (const banned of ["Product", "Offer", "price", "priceValidUntil", "AggregateRating", "Review", "FAQPage"]) expect(json).not.toContain(banned);
    expect(() => assertNoProhibitedJsonLd(ld)).not.toThrow();
  });

  it("home: WebSite + Organization; seller: Organization at the singular URL", () => {
    expect(websiteJsonLd()["@type"]).toBe("WebSite");
    expect(siteOrganizationJsonLd()["@type"]).toBe("Organization");
    const s = fakeSellerDetail({ slug: "floret", name: "Floret", homepage: "https://www.floretflowers.com", description: null, location: "Skagit Valley, WA" });
    expect(organizationJsonLd(s)).toMatchObject({ "@type": "Organization", mainEntityOfPage: "https://seeds.hues.flowers/seller/floret" });
    expect(breadcrumbJsonLd([{ name: "Home", href: "/" }])).toMatchObject({ "@type": "BreadcrumbList" });
  });

  it("guard throws on Product, Offer, prices and rating types/keys", () => {
    for (const bad of [
      { "@type": "Product" },
      { "@type": "AggregateOffer" },
      { a: [{ "@type": "Offer" }] },
      { "@type": "FAQPage" },
      { a: [{ "@type": "AggregateRating" }] },
      { offers: {} },
      { x: { priceValidUntil: "2027-01-01" } },
      { review: [] },
      { price: "6.00" },
    ]) {
      expect(() => assertNoProhibitedJsonLd(bad)).toThrow(ProhibitedJsonLdError);
    }
    expect(() => assertNoProhibitedJsonLd(websiteJsonLd())).not.toThrow();
    expect(() => assertNoProhibitedJsonLd(siteOrganizationJsonLd())).not.toThrow();
  });

  it("parses only City, ST locations into a PostalAddress", () => {
    expect(parseLocation("Accord, NY")).toEqual({ "@type": "PostalAddress", addressLocality: "Accord", addressRegion: "NY" });
    expect(parseLocation("Wisconsin")).toBeNull();
    expect(parseLocation("Southwest WA / Portland, OR area")).toBeNull();
  });
});

describe("answer sentence + titles (canonical §5 GEO/SEO) — data only, no prices", () => {
  it("names the date, the count and the sellers", () => {
    expect(answerSentence("King's Ransom", [listing(1, "a", "Farm A", "2026-11-15"), listing(2, "b", "Farm B", "2026-11-14")])).toBe(
      "As of Nov 15, 2026, 2 sellers list King's Ransom: Farm A and Farm B.",
    );
    expect(answerSentence("Emma", [listing(1, "a", "Farm A", "2026-11-15T09:12:00Z")])).toBe("As of Nov 15, 2026, 1 seller lists Emma: Farm A.");
    expect(answerSentence("Katz Mix", [])).toBe(zeroSellerSentence("Katz Mix"));
    expect(answerSentence("Katz Mix", [])).toBe("No seller found selling Katz Mix yet.");
  });

  it("titles aim at where-to-buy intent with the seller count; descriptions carry no price", () => {
    const v = variety([listing(1, "a", "Farm A", "2026-11-15")]);
    expect(varietyTitle(v)).toBe("Test Sweet Pea Seeds — Where to Buy (1 Seller)");
    expect(varietyTitle(variety([]))).toBe(`Test Sweet Pea Seeds — Where to Buy (${ZERO_SELLER_TITLE})`);
    expect(varietyTitle(variety([]))).toBe("Test Sweet Pea Seeds — Where to Buy (No Seller Found Yet)");
    expect(varietyDescription(v)).not.toMatch(/\$\d/);
  });
});

describe("template descriptions", () => {
  it("are deterministic and use only sourced facts", () => {
    const a = templateDescription({ varietyName: "Katz Mix", commonName: "Stock", latinName: "Matthiola incana", sellerCount: 0 });
    expect(a).toBe(`Katz Mix is a Stock variety (Matthiola incana). ${zeroSellerSentence("Katz Mix")}`);
    const b = templateDescription({ varietyName: "Juliet", commonName: "Iceland Poppy", latinName: "Papaver nudicaule", sellerCount: 2 });
    expect(b).toBe("Juliet is an Iceland Poppy variety (Papaver nudicaule). It is listed by 2 seed sellers in this directory.");
    expect(templateDescription({ varietyName: "X", commonName: "Cornflower / Bachelor's Buttons", latinName: "Centaurea cyanus", sellerCount: 1 })).toContain(
      "a Cornflower (Bachelor's Buttons) variety",
    );
  });
});
