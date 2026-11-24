/**
 * Slice 3 builder ports: every expectation is hardcoded from the v2 sources
 * (lib/seo/metadata.ts, lib/seo/jsonld.ts, lib/services/catalog.ts answer
 * sentence, lib/services/template.ts, lib/small-farm.ts, lib/zero-seller.ts,
 * lib/format.ts, lib/color-chip.ts, lib/browse.ts labels) — never computed
 * by the ported code. Length margins on every Template branch are ≥ 11
 * characters, so a branch flip means a port bug, not a miscount.
 */
import { describe, expect, it } from "vitest";
import { imageUrl } from "../../src/lib/images";
import { assertNoProhibitedJsonLd, ProhibitedJsonLdError } from "../../src/lib/jsonld-guard";
import { SEASON_LABELS, SOWING_METHOD_LABELS } from "../../src/lib/browse-labels";
import {
  MIX_GRADIENT,
  MIX_WEDGE_HEXES,
  chipBackground,
  resolveColorChip,
} from "../../src/lib/color-chip";
import { formatCheckedDate, formatHeight, plural, titleCaseTag } from "../../src/lib/format";
import { sellerCounts } from "../../src/lib/seller-counts";
import {
  SMALL_FARM_BADGE_LABEL,
  SMALL_FARM_CHIP_LABEL,
  SMALL_FARM_LEGEND,
  SMALL_FARM_PARAM,
  SMALL_FARM_VARIANT_SEGMENT,
  parseSmallFarmParam,
  sellerFilterView,
  smallFarmEmptyVariety,
  smallFarmOnlyFromSearch,
  smallFarmVariantPath,
  varietyFilterHref,
  varietyListingCountLine,
} from "../../src/lib/small-farm";
import {
  ZERO_SELLER_SHORT,
  ZERO_SELLER_TITLE,
  zeroSellerSentence,
} from "../../src/lib/zero-seller";
import { answerSentence, templateDescription } from "../../src/lib/variety-text";
import { mediaOgImage, ogImage, varietyDescription, varietyTitle } from "../../src/seo/meta";
import { breadcrumbJsonLd, varietySellersJsonLd } from "../../src/seo/jsonld";
import { varietyHead } from "../../pages/variety/@slug/head";
import { fakeCatalogState } from "./fake-catalog";

const fixtures = () => fakeCatalogState().details;
const kingsRansom = () => fixtures()["sweet-pea-kings-ransom"]!;
const lonelyBloom = () => fixtures()["cosmos-lonely-bloom"]!;
const candyStripe = () => fixtures()["cosmos-candy-stripe"]!;
const mysteryBloom = () => fixtures()["cosmos-mystery-bloom"]!;

describe("varietyTitle", () => {
  it("counts distinct sellers (fixture i: 3 listings, 2 sellers)", () => {
    expect(varietyTitle(kingsRansom())).toBe("King's Ransom Sweet Pea Seeds — Where to Buy (2 Sellers)");
  });

  it("uses the zero-seller parenthetical (fixture ii)", () => {
    expect(varietyTitle(lonelyBloom())).toBe("Lonely Bloom Cosmos Seeds — Where to Buy (No Seller Found Yet)");
  });

  it("agrees in the singular (fixtures iii, v)", () => {
    expect(varietyTitle(candyStripe())).toBe("Candy Stripe Cosmos Seeds — Where to Buy (1 Seller)");
    expect(varietyTitle(mysteryBloom())).toBe("Mystery Bloom Cosmos Seeds — Where to Buy (1 Seller)");
  });
});

describe("varietyDescription", () => {
  it("composes Template A (fixture i: prose fits, directory clause dropped at 171 > 160)", () => {
    const description = varietyDescription(kingsRansom());
    expect(description).toBe(
      "King's Ransom Sweet Pea seeds (Lathyrus odoratus). King's Ransom bears large, ruffled blooms in deep rose on strong stems.",
    );
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("composes Template C with prose (fixture ii: 149 chars)", () => {
    const description = varietyDescription(lonelyBloom());
    expect(description).toBe(
      "Lonely Bloom Cosmos seeds (Cosmos bipinnatus). No US sellers currently list this variety. Join the waitlist. Lonely Bloom opens single white flowers.",
    );
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("composes Template C without prose when none fits", () => {
    expect(varietyDescription({ ...lonelyBloom(), description: null })).toBe(
      "Lonely Bloom Cosmos seeds (Cosmos bipinnatus). No US sellers currently list this variety. Join the waitlist.",
    );
  });

  it("composes Template B with packet range + closing (fixture iii: 141 chars)", () => {
    const description = varietyDescription(candyStripe());
    expect(description).toBe(
      "Candy Stripe Cosmos seeds (Cosmos bipinnatus). Listed by 1 US seller in the Seed Directory. Packets of 25 seeds. Each listing links out to buy.",
    );
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("composes Template B without Latin (fixture v: 122 chars)", () => {
    expect(varietyDescription(mysteryBloom())).toBe(
      "Mystery Bloom Cosmos seeds. Listed by 1 US seller in the Seed Directory. Packets of 25 seeds. Each listing links out to buy.",
    );
  });

  it("falls back to the directory clause when no seed count exists (Template B, no range)", () => {
    const detail = {
      varietyName: "Test Bloom",
      plant: { commonName: "Cosmos", latinName: "Cosmos bipinnatus" },
      description: null,
      listings: [{ seller: { slug: "a" }, packetSizes: [{ label: "Packet", seedCount: null }] }],
    };
    expect(varietyDescription(detail)).toBe(
      "Test Bloom Cosmos seeds (Cosmos bipinnatus). Listed by 1 US seller in the Seed Directory. Sellers list packet sizes in the Seed Directory.",
    );
  });

  it("never splits a sentence at an abbreviation period (the 'Seed Co.' rule)", () => {
    const detail = {
      varietyName: "Test Bloom",
      plant: { commonName: "Cosmos", latinName: null },
      description: "Offered by Hudson Valley Seed Co. in its spring line. A second sentence follows here.",
      listings: [
        { seller: { slug: "a" }, packetSizes: [] },
        { seller: { slug: "b" }, packetSizes: [] },
      ],
    };
    expect(varietyDescription(detail)).toBe(
      "Test Bloom Cosmos seeds. Offered by Hudson Valley Seed Co. in its spring line. Sellers list packet sizes in the Seed Directory.",
    );
  });

  it("never splits a sentence at a decimal point", () => {
    const detail = {
      varietyName: "Test Bloom",
      plant: { commonName: "Cosmos", latinName: null },
      description: "Grows 2.5 in tall. Needs sun.",
      listings: [{ seller: { slug: "a" }, packetSizes: [] }],
    };
    expect(varietyDescription(detail)).toBe(
      "Test Bloom Cosmos seeds. Grows 2.5 in tall. Sellers list packet sizes in the Seed Directory.",
    );
  });

  it("omits the crop word when the variety name already ends with it", () => {
    const detail = {
      varietyName: "Cinnamon Basil",
      plant: { commonName: "Basil", latinName: null },
      description: null,
      listings: [],
    };
    expect(varietyDescription(detail).startsWith("Cinnamon Basil seeds.")).toBe(true);
  });
});

describe("answerSentence + templateDescription + sellerCounts + zero-seller", () => {
  it("matches the fixtures' carried answer sentences (the live builders' outputs)", () => {
    for (const detail of [kingsRansom(), lonelyBloom(), candyStripe(), mysteryBloom()]) {
      expect(answerSentence(detail.varietyName, detail.listings), detail.slug).toBe(detail.answer);
    }
  });

  it("matches the fixtures' carried template descriptions", () => {
    for (const detail of [kingsRansom(), lonelyBloom(), candyStripe(), mysteryBloom()]) {
      const sellers = new Set(detail.listings.map((l) => l.seller.slug)).size;
      expect(
        templateDescription({
          varietyName: detail.varietyName,
          commonName: detail.plant.commonName,
          latinName: detail.plant.latinName,
          sellerCount: sellers,
        }),
        detail.slug,
      ).toBe(detail.templateDescription);
    }
  });

  it("joins three sellers without an Oxford comma and dates the latest check", () => {
    expect(
      answerSentence("X", [
        { seller: { name: "A" }, lastCheckedAt: "2026-01-05T00:00:00.000Z" },
        { seller: { name: "B" }, lastCheckedAt: null },
        { seller: { name: "C" }, lastCheckedAt: "2025-12-01T00:00:00.000Z" },
      ]),
    ).toBe("As of Jan 5, 2026, 3 sellers list X: A, B and C.");
  });

  it("omits the date lead with no checked date and the extra dot after an abbreviated name", () => {
    expect(answerSentence("X", [{ seller: { name: "Solo Farm" }, lastCheckedAt: null }])).toBe(
      "1 seller lists X: Solo Farm.",
    );
    expect(answerSentence("X", [{ seller: { name: "Songbird Seed Co." }, lastCheckedAt: null }])).toBe(
      "1 seller lists X: Songbird Seed Co.",
    );
  });

  it("counts distinct sellers, never listings", () => {
    expect(
      sellerCounts([
        { seller: { slug: "a" }, availability: "in_stock" },
        { seller: { slug: "a" }, availability: "sold_out" },
        { seller: { slug: "b" }, availability: "sold_out" },
      ]),
    ).toEqual({ sellers: 2, inStockSellers: 1 });
  });

  it("keeps the zero-seller family verbatim", () => {
    expect(zeroSellerSentence("Y")).toBe("No seller found selling Y yet.");
    expect(ZERO_SELLER_SHORT).toBe("No sellers yet");
    expect(ZERO_SELLER_TITLE).toBe("No Seller Found Yet");
  });
});

describe("small-farm vocabulary", () => {
  it("keeps every shared string verbatim", () => {
    expect(SMALL_FARM_BADGE_LABEL).toBe("Small farm");
    expect(SMALL_FARM_CHIP_LABEL).toBe("Small farms only");
    expect(SMALL_FARM_LEGEND).toBe(
      "The Small farm badge marks a seller we judge to be a small family farm — it's our call, so you can spot them and choose to buy from them.",
    );
    expect(SMALL_FARM_PARAM).toBe("small_farm");
    expect(SMALL_FARM_VARIANT_SEGMENT).toBe("small-farms");
    expect(smallFarmVariantPath("x")).toBe("/variety/x/small-farms");
    expect(smallFarmEmptyVariety("Y")).toBe("No seller with the Small farm badge lists Y yet.");
    expect(varietyFilterHref("x", false)).toBe("/variety/x");
    expect(varietyFilterHref("x", true)).toBe("/variety/x?small_farm=true");
  });

  it("parses the filter forgivingly: exactly one 'true' is on, everything else is off", () => {
    expect(parseSmallFarmParam("true")).toBe(true);
    for (const raw of [undefined, "false", "yes", "1", "", ["true"], ["true", "true"], ["false"]]) {
      expect(parseSmallFarmParam(raw), JSON.stringify(raw)).toBe(false);
    }
    expect(smallFarmOnlyFromSearch("?small_farm=true")).toBe(true);
    for (const search of ["", "?", "?small_farm=false", "?small_farm=yes", "?small_farm=true&small_farm=true", "?other=1"]) {
      expect(smallFarmOnlyFromSearch(search), search).toBe(false);
    }
  });

  it("writes the count line with the required 'of N' after narrowing", () => {
    expect(varietyListingCountLine(3, 3, false)).toBe("3 listings.");
    expect(varietyListingCountLine(3, 2, true)).toBe("2 of 3 listings · Small farms only.");
    expect(varietyListingCountLine(1, 1, false)).toBe("1 listing.");
  });

  it("narrows without re-sorting; the control renders only for mixed pages", () => {
    const listings = kingsRansom().listings;
    const all = sellerFilterView(listings, false);
    expect(all.total).toBe(3);
    expect(all.badged).toBe(2);
    expect(all.showControl).toBe(true);
    expect(all.showLegend).toBe(true);
    expect(all.shown.map((l) => l.id)).toEqual([1, 2, 3]);
    const narrowed = sellerFilterView(listings, true);
    expect(narrowed.shown.map((l) => l.id)).toEqual([1, 3]);
    const unbadged = sellerFilterView(candyStripe().listings, false);
    expect(unbadged.showControl).toBe(false);
    expect(unbadged.showLegend).toBe(false);
  });
});

describe("format + labels", () => {
  it("renders friendly checked dates against a fixed now", () => {
    const now = new Date(2026, 10, 24, 12, 0, 0);
    expect(formatCheckedDate("2026-11-24T08:00:00.000Z", now)).toBe("today");
    expect(formatCheckedDate("2026-11-23T23:59:59.000Z", now)).toBe("yesterday");
    expect(formatCheckedDate("2026-11-20T08:00:00.000Z", now)).toBe("Nov 20");
    expect(formatCheckedDate(null, now)).toBeNull();
    expect(formatCheckedDate("garbage", now)).toBeNull();
    expect(formatCheckedDate("2026-13-45", now)).toBeNull();
  });

  it("formats heights, plurals, and tags", () => {
    expect(formatHeight(180)).toBe("180 cm (about 71 in)");
    expect(formatHeight(120)).toBe("120 cm (about 47 in)");
    expect(plural(1, "seller")).toBe("1 seller");
    expect(plural(2, "seller")).toBe("2 sellers");
    expect(titleCaseTag("direct-sow")).toBe("Direct Sow");
    expect(titleCaseTag("pink")).toBe("Pink");
  });

  it("keeps the season and sowing labels verbatim", () => {
    expect(SEASON_LABELS.cool_season_hardy_annual).toBe("Cool Season Hardy Annuals");
    expect(SEASON_LABELS.warm_season_tender_annual).toBe("Warm Season Tender Annuals");
    expect(SOWING_METHOD_LABELS.direct_sow).toBe("Direct Sow");
    expect(SOWING_METHOD_LABELS.transplant).toBe("Start indoors");
  });
});

describe("color chip", () => {
  it("resolves mix, unknown, representative, and agreement per policy", () => {
    expect(resolveColorChip({ colorFamily: "mix", colorSwatch: "#FFFFFF" })).toEqual({ kind: "gradient" });
    expect(resolveColorChip({ colorFamily: "unknown", colorSwatch: "#E87A9E" })).toEqual({ kind: "none" });
    expect(resolveColorChip({ colorFamily: null, colorSwatch: "#E87A9E" })).toEqual({ kind: "none" });
    expect(resolveColorChip({ colorFamily: "pink", colorSwatch: null })).toEqual({ kind: "hex", hex: "#E87A9E" });
    expect(resolveColorChip({ colorFamily: "pink", colorSwatch: "#E87A9E" })).toEqual({ kind: "hex", hex: "#E87A9E" });
    // A swatch measuring nearest to another family falls back to the filed family's representative.
    expect(resolveColorChip({ colorFamily: "pink", colorSwatch: "#5B7FBF" })).toEqual({ kind: "hex", hex: "#E87A9E" });
    // A family outside the vocabulary cannot be judged: the swatch renders as-is.
    expect(resolveColorChip({ colorFamily: "legacy-chartreuse", colorSwatch: "#123456" })).toEqual({
      kind: "hex",
      hex: "#123456",
    });
    expect(resolveColorChip({ colorFamily: "legacy-chartreuse", colorSwatch: null })).toEqual({ kind: "none" });
  });

  it("maps chips to backgrounds and wedges in the shared order", () => {
    expect(chipBackground({ kind: "gradient" })).toBe(MIX_GRADIENT);
    expect(chipBackground({ kind: "hex", hex: "#E87A9E" })).toBe("#E87A9E");
    expect(chipBackground({ kind: "none" })).toBeNull();
    expect(MIX_WEDGE_HEXES).toEqual(["#E87A9E", "#E8813A", "#EFC93F", "#7A9A4D", "#5B7FBF", "#8B6BAE"]);
  });
});

describe("variety JSON-LD + head", () => {
  it("lists sellers deduplicated by slug with absolute URLs", () => {
    const jsonld = varietySellersJsonLd(kingsRansom()) as {
      "@type": string;
      name: string;
      numberOfItems: number;
      itemListElement: { position: number; url: string; name: string }[];
    };
    expect(jsonld["@type"]).toBe("ItemList");
    expect(jsonld.name).toBe("Where to buy King's Ransom seed");
    expect(jsonld.numberOfItems).toBe(2);
    expect(jsonld.itemListElement.map((item) => [item.position, item.name, item.url])).toEqual([
      [1, "Blue Ridge Seeds", "https://seeds.hues.flowers/seller/blue-ridge-seeds"],
      [2, "Prairie Seed House", "https://seeds.hues.flowers/seller/prairie-seed-house"],
    ]);
  });

  it("emits an empty sellers list for zero-seller varieties", () => {
    const jsonld = varietySellersJsonLd(lonelyBloom()) as { numberOfItems: number; itemListElement: unknown[] };
    expect(jsonld.numberOfItems).toBe(0);
    expect(jsonld.itemListElement).toEqual([]);
  });

  it("passes the no-price guard on everything the template emits (and the guard still fires)", () => {
    for (const detail of [kingsRansom(), lonelyBloom()]) {
      expect(() =>
        assertNoProhibitedJsonLd([
          breadcrumbJsonLd([{ name: "Home", href: "/" }]),
          varietySellersJsonLd(detail),
        ]),
      ).not.toThrow();
    }
    expect(() => assertNoProhibitedJsonLd({ "@type": "Product" })).toThrow(ProhibitedJsonLdError);
    expect(() => assertNoProhibitedJsonLd({ offers: [] })).toThrow(ProhibitedJsonLdError);
    expect(() => assertNoProhibitedJsonLd([{ item: { "@type": ["ItemList", "Review"] } }])).toThrow(
      ProhibitedJsonLdError,
    );
  });

  it("builds the with-sellers head: media share image, indexable, self canonical", () => {
    const head = varietyHead(kingsRansom(), false);
    expect(head.title).toBe("King's Ransom Sweet Pea Seeds — Where to Buy (2 Sellers) | seeds.hues.flowers");
    expect(head.description).toBe(varietyDescription(kingsRansom()));
    expect(head.canonical).toBe("https://seeds.hues.flowers/variety/sweet-pea-kings-ransom");
    expect(head.robots).toBe("index, follow");
    expect(head.og.url).toBe(head.canonical);
    expect(head.og.image).toBe(imageUrl("/artwork/sweet-pea-kings-ransom.webp", { width: 1120 }));
    expect([head.og.width, head.og.height]).toEqual([1120, 2240]);
    expect(head.og.type).toBeUndefined();
    expect(head.og.image).not.toBe(head.og.url);
    expect(head.twitter.card).toBe("summary_large_image");
    expect(head.twitter.image).toBe(head.og.image);
  });

  it("builds the variant head: same facts, noindex, canonical to the clean URL", () => {
    const head = varietyHead(kingsRansom(), true);
    expect(head.title).toBe(varietyHead(kingsRansom(), false).title);
    expect(head.description).toBe(varietyHead(kingsRansom(), false).description);
    expect(head.canonical).toBe("https://seeds.hues.flowers/variety/sweet-pea-kings-ransom");
    expect(head.canonical).not.toContain("small_farm");
    expect(head.robots).toBe("noindex, follow");
  });

  it("builds the zero-seller head: generated card, still indexable (decision 27)", () => {
    const head = varietyHead(lonelyBloom(), false);
    expect(head.robots).toBe("index, follow");
    expect(head.og.image).toBe("https://seeds.hues.flowers/og/variety/cosmos-lonely-bloom");
    expect([head.og.width, head.og.height]).toEqual([1200, 630]);
    expect(head.og.type).toBe("image/png");
  });

  it("noindexes non-indexable varieties without changing the canonical", () => {
    const head = varietyHead({ ...lonelyBloom(), indexable: false }, false);
    expect(head.robots).toBe("noindex, follow");
    expect(head.canonical).toBe("https://seeds.hues.flowers/variety/cosmos-lonely-bloom");
  });

  it("keeps the share-image builders' dimensions", () => {
    const media = mediaOgImage("/artwork/x.webp", "Label");
    expect([media.width, media.height]).toEqual([1120, 2240]);
    expect(media.type).toBeUndefined();
    const card = ogImage("variety", "x", "Label");
    expect([card.width, card.height]).toEqual([1200, 630]);
    expect(card.type).toBe("image/png");
  });
});
