/**
 * No-price JSON-LD guard: one case per prohibited @type/key (Bea's list first),
 * nesting/edge cases, and a clean-payload pass. Exercised on real payloads
 * from Slice 2 on; here the utility + its tests land.
 */
import { describe, expect, it } from "vitest";
import {
  assertNoProhibitedJsonLd,
  PROHIBITED_JSONLD,
  ProhibitedJsonLdError,
} from "../../src/lib/jsonld-guard.js";

describe("assertNoProhibitedJsonLd", () => {
  it("covers Bea's prohibited list", () => {
    for (const name of ["Product", "Offer", "AggregateOffer", "AggregateRating", "Review", "price"]) {
      expect(PROHIBITED_JSONLD).toContain(name);
    }
  });

  it.each(["Product", "Offer", "AggregateOffer", "AggregateRating", "Review"])(
    "throws on prohibited @type %s",
    (type) => {
      expect(() => assertNoProhibitedJsonLd({ "@context": "https://schema.org", "@type": type })).toThrow(
        ProhibitedJsonLdError,
      );
    },
  );

  it("throws on a prohibited @type inside an @type array", () => {
    expect(() =>
      assertNoProhibitedJsonLd({ "@type": ["CreativeWork", "Review"] }),
    ).toThrow(ProhibitedJsonLdError);
  });

  it.each(["price", "offers", "lowPrice", "aggregateRating", "review", "priceValidUntil"])(
    "throws on prohibited key %s anywhere in the payload",
    (key) => {
      // Nested three levels deep with an array hop: the walk must reach it.
      expect(() =>
        assertNoProhibitedJsonLd({
          "@type": "ItemList",
          itemListElement: [{ item: { extra: { [key]: "1" } } }],
        }),
      ).toThrow(ProhibitedJsonLdError);
    },
  );

  it("throws on FAQPage (shipped v2 extension)", () => {
    expect(() => assertNoProhibitedJsonLd({ "@type": "FAQPage" })).toThrow(ProhibitedJsonLdError);
  });

  it("throws on a prohibited @type nested under arrays", () => {
    expect(() =>
      assertNoProhibitedJsonLd({
        "@context": "https://schema.org",
        "@graph": [{ "@type": "WebSite" }, { "@type": "Product", name: "x" }],
      }),
    ).toThrow(ProhibitedJsonLdError);
  });

  it("reports the offending path", () => {
    expect(() =>
      assertNoProhibitedJsonLd({ a: [{ b: { price: "9.99" } }] }),
    ).toThrow(/price at \$\.a\[0\]\.b/);
  });

  it("passes clean payloads (the carried-over inventory shapes)", () => {
    const website = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "seeds.hues.flowers",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: "https://seeds.hues.flowers/search?q={query}" },
      },
    };
    const breadcrumbs = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [{ "@type": "ListItem", position: 1, name: "Crops", item: "https://seeds.hues.flowers/crop" }],
    };
    const organization = { "@context": "https://schema.org", "@type": "Organization", name: "Hues Floral Park" };
    expect(() => assertNoProhibitedJsonLd(website)).not.toThrow();
    expect(() => assertNoProhibitedJsonLd(breadcrumbs)).not.toThrow();
    expect(() => assertNoProhibitedJsonLd(organization)).not.toThrow();
  });

  it("ignores scalars, nulls, and near-miss names", () => {
    expect(() => assertNoProhibitedJsonLd(null)).not.toThrow();
    expect(() => assertNoProhibitedJsonLd("Product")).not.toThrow();
    expect(() => assertNoProhibitedJsonLd({ priceless: true, reprice: 1, products: [] })).not.toThrow();
  });
});
