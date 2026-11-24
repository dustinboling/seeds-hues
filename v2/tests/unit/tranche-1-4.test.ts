/**
 * Tranche 1.4 — friendly dates everywhere + one canonical zero-seller sentence
 * (full audit 2026-11-21 §6 item 1.4; Batch 0.1 + 0.2) plus the standing-rule
 * deletion of the future-sales hint on /about/data (audit M2).
 *
 * Rendered through the real pages against a fake in-process catalog
 * (tests/unit/route-not-found.test.ts pattern): every date assertion reads the
 * static markup, so a raw ISO date reaching reader prose fails the run. The
 * zero-seller assertions compare page body, meta title/description and the OG
 * payload against the shared constant module — and fail if any retired variant
 * returns.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONFLICT_OF_INTEREST } from "@/lib/config";
import { formatFriendlyDate } from "@/lib/format";
import { varietyDescription, varietyTitle } from "@/lib/seo/metadata";
import { ogCardFor } from "@/lib/seo/og-card";
import { answerSentence } from "@/lib/services/catalog";
import { availabilityPhrase, templateDescription } from "@/lib/services/template";
import {
  SELLER_NO_LISTINGS,
  ZERO_SELLER_SHORT,
  ZERO_SELLER_TITLE,
  zeroSellerSentence,
} from "@/lib/zero-seller";
import type {
  BrowseCounts,
  CoverageItem,
  CropDetail,
  CropDetailCounts,
  CropListItem,
  PublicListing,
  RecentItem,
  VarietyDetail,
} from "@/lib/validators";

const ISO = /\d{4}-\d{2}-\d{2}/;

/** Every retired zero-seller wording the audit found (M3): none may return. */
const RETIRED = [
  "No seller in this directory lists it yet",
  "No Seller Listing Yet",
  "currently unavailable",
  "No seller in this directory is selling",
  "No sellers listed yet",
  "No seller found selling this yet",
  "No sellers yet for this crop",
  "supplier",
];

const fake = vi.hoisted(() => ({
  counts: { varieties: 0, sellers: 0, listings: 0, plants: 0 },
  crops: { items: [] as unknown[], total: 0 },
  coverage: [] as unknown[],
  recent: [] as unknown[],
  variety: null as unknown,
  varieties: { items: [] as unknown[], total: 0 },
  crop: null as unknown,
  seller: null as unknown,
}));
const store = vi.hoisted(() => ({ services: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => store.services }));
// The search widget needs router context; the hero line and Recent list do not.
vi.mock("@/components/search/SearchBox", () => ({ SearchBox: () => null }));

import { fakeServices } from "../helpers/services-context";

// Imported after the mocks are registered (vi.mock is hoisted above these too).
const { default: HomePage } = await import("@/app/page");
const { VarietyView } = await import("@/app/variety/[slug]/variety-view");
const { default: CropPage, generateMetadata: cropMetadata } = await import("@/app/crop/[slug]/page");
const { default: SellerPage } = await import("@/app/seller/[slug]/page");
const { default: AboutDataPage } = await import("@/app/about/data/page");
const { default: TermsPage } = await import("@/app/terms/page");
const { default: PrivacyPage } = await import("@/app/privacy/page");
const { VarietyCard } = await import("@/components/variety/VarietyCard");
const { ImportedRatingPanel } = await import("@/components/seller/ImportedRatingPanel");

store.services = fakeServices({
  catalog: {
    counts: async () => fake.counts,
    // Tranche 3.1b-1: home renders from the browse payload (items + total + counts),
    // the identical contract GET /api/browse/crops serves the in-place layer.
    browseCrops: async () => ({ ...fake.crops, page: 1, pages: 1, counts: zeroBrowseCounts() }),
    coverage: async () => fake.coverage,
    recent: async () => fake.recent,
    getVariety: async () => fake.variety,
    listVarieties: async () => fake.varieties,
    getCrop: async () => fake.crop,
    getSeller: async () => fake.seller,
    // Tranche 3.1b-2: the crop page renders from the browse payload (items + total + counts),
    // the identical contract GET /api/browse/crops/[slug] serves the in-place layer.
    browseCrop: async () =>
      fake.crop === null
        ? null
        : {
            ...(fake.crop as { crop: CropDetail; total: number; colorFamilies: string[] }),
            page: 1,
            pages: 1,
            counts: zeroCropDetailCounts(),
          },
  },
});

beforeEach(() => {
  fake.counts = { varieties: 0, sellers: 0, listings: 0, plants: 0 };
  fake.crops = { items: [], total: 0 };
  fake.coverage = [];
  fake.recent = [];
  fake.variety = null;
  fake.varieties = { items: [], total: 0 };
  fake.crop = null;
  fake.seller = null;
});

const plant = {
  slug: "stock",
  commonName: "Stock",
  latinName: "Matthiola incana",
  lifeCycle: null,
  season_class: null,
  season_source_label: null,
  sowing_methods: [],
  sowing_method_source_label: null,
} as const;

function listing(
  id: number,
  checked: string,
  seller: { slug: string; name: string } = { slug: "songbird-seed-co", name: "Songbird Seed Co." },
): PublicListing {
  return {
    id,
    variety: {
      slug: "stock-katz-mix",
      varietyName: "Katz Mix",
      plant: { ...plant, sowing_methods: [] },
      colorSwatch: null,
      colorFamily: "unknown",
      media: [],
      cropMedia: [],
    },
    seller: { slug: seller.slug, name: seller.name, location: "Skagit Valley, WA", region: "WA", country: "US", isSmallFarm: false },
    availability: "in_stock",
    lastCheckedAt: checked,
    firstSeenAt: checked,
    goUrl: `https://seeds.hues.flowers/go/${id}`,
    productUrl: null,
    notes: null,
    status: "published",
    packetSizes: [],
    provenance: { source_url: null, retrieved_at: checked, method: "human", confidence: 1 },
    sourceLabel: null,
  };
}

function variety(listings: PublicListing[]): VarietyDetail {
  const sellerCount = new Set(listings.map((l) => l.seller.slug)).size;
  return {
    slug: "stock-katz-mix",
    varietyName: "Katz Mix",
    plant: { ...plant, sowing_methods: [], description: null, sowingNotes: null },
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: null,
    colorSwatch: null,
    colorFamily: "mix",
    listingCount: listings.length,
    sellerCount,
    inStockCount: listings.length,
    lastCheckedAt: listings[0]?.lastCheckedAt ?? null,
    indexable: true,
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    description: null,
    templateDescription: templateDescription({ varietyName: "Katz Mix", commonName: "Stock", latinName: "Matthiola incana", sellerCount }),
    answer: answerSentence("Katz Mix", listings),
    sowingNotes: null,
    heightCm: null,
    facts: { color_family: "mix", pollination: "unknown", height_cm: { min: null, max: null }, days_to_bloom: { min: null, max: null } },
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

/** Zeroed per-option counts for the home browse fake (chip counts render, nothing narrows). */
function zeroBrowseCounts(): BrowseCounts {
  const counts: BrowseCounts = {
    season: { all: 0, options: { cool: 0, warm: 0 } },
    method: { all: 0, options: { direct: 0, trays: 0 } },
    lifeCycle: { all: 0, options: { annual: 0, biennial: 0, perennial: 0 } },
    hue: {
      all: 0,
      options: {
        white: 0,
        blush: 0,
        pink: 0,
        peach: 0,
        orange: 0,
        yellow: 0,
        red: 0,
        burgundy: 0,
        purple: 0,
        blue: 0,
        green: 0,
        chocolate: 0,
        mix: 0,
      },
    },
    smallFarm: { all: 0, on: 0 },
  };
  return counts;
}

/** Zeroed crop-detail counts in the schema's shape (chips render, nothing narrows). */
function zeroCropDetailCounts(): CropDetailCounts {
  return { sellers: { all: 0, has: 0, none: 0 }, hue: { all: 0, options: {} }, series: { all: 0, options: {} } };
}

function cropListItem(): CropListItem {
  return {
    ...plant,
    sowing_methods: [],
    category: { slug: "flowers", name: "Flowers" },
    varietyCount: 4,
    varietiesWithSellers: 0,
    lastUpdated: "2026-11-20",
    media: [],
  };
}

function cropDetail(): CropDetail {
  return {
    ...cropListItem(),
    description: null,
    sowingNotes: null,
    life_cycle: null,
    hardiness: null,
    grower_guide: null,
    series: [],
    varieties: [],
  };
}

describe("formatFriendlyDate (lib/format.ts)", () => {
  it('renders "Mon D, YYYY" from an ISO date or timestamp', () => {
    expect(formatFriendlyDate("2026-11-20")).toBe("Nov 20, 2026");
    expect(formatFriendlyDate("2026-11-20T09:12:00Z")).toBe("Nov 20, 2026");
    expect(formatFriendlyDate("2026-01-05")).toBe("Jan 5, 2026");
  });

  it("returns null for a missing or unparseable value (callers omit the date, never print ISO)", () => {
    expect(formatFriendlyDate(null)).toBeNull();
    expect(formatFriendlyDate("unknown")).toBeNull();
    expect(formatFriendlyDate("2026-13-40")).toBeNull();
  });
});

describe("friendly dates in rendered output (Batch 0.1)", () => {
  it("home hero line: no ISO, friendly updated date", async () => {
    fake.counts = { varieties: 10, sellers: 3, listings: 5, plants: 2 };
    fake.crops = { items: [cropListItem()], total: 1 };
    const coverage: CoverageItem[] = [
      { crop: { slug: "stock", name: "Stock" }, varieties: 10, varieties_with_sellers: 4, last_updated: "2026-11-21" },
    ];
    fake.coverage = coverage;
    fake.recent = [];
    const h = renderToStaticMarkup((await HomePage({ searchParams: Promise.resolve({}) })) as ReactElement);
    // The fixture really is ISO: rendering it raw would fail the assertion below.
    expect(JSON.stringify(coverage)).toMatch(ISO);
    expect(h).toContain("updated Nov 21, 2026");
    expect(h).not.toMatch(ISO);
  });

  it("home Recent list: no ISO, friendly event dates", async () => {
    fake.counts = { varieties: 10, sellers: 3, listings: 5, plants: 2 };
    fake.crops = { items: [], total: 0 };
    fake.coverage = [];
    const recent: RecentItem[] = [{ event: "restocked", at: "2026-11-20", listing: listing(7, "2026-11-20") }];
    fake.recent = recent;
    const h = renderToStaticMarkup((await HomePage({ searchParams: Promise.resolve({}) })) as ReactElement);
    expect(JSON.stringify(recent)).toMatch(ISO);
    expect(h).toContain("Restocked Nov 20, 2026");
    expect(h).not.toMatch(ISO);
  });

  it("seller variety page: no header answer line, seller cards stay, no ISO", async () => {
    // Dustin 2026-11-22: the visible seller-list sentence under the H1 is removed. The
    // data-layer answer field still feeds the meta description, so it stays intact.
    const listings = [listing(1, "2026-11-20"), listing(2, "2026-11-19", { slug: "eden-brothers", name: "Eden Brothers" })];
    fake.variety = variety(listings);
    expect((fake.variety as VarietyDetail).answer).toBe(
      "As of Nov 20, 2026, 2 sellers list Katz Mix: Songbird Seed Co. and Eden Brothers.",
    );
    const h = renderToStaticMarkup((await VarietyView({ slug: "stock-katz-mix", smallFarmOnly: false })) as ReactElement);
    // The header answer element is gone entirely: no element, no sentence, no seller list.
    expect(h).not.toContain('data-testid="answer"');
    expect(h).not.toContain("As of Nov 20, 2026, 2 sellers list Katz Mix");
    // The seller cards below stay exactly as they are.
    expect(h).toContain("Where to buy");
    expect(h).toContain("Songbird Seed Co.");
    expect(h).toContain("Eden Brothers");
    expect(h).toContain("Visit shop");
    expect(h).not.toMatch(ISO);
  });

  it("crop header + meta description: no ISO, friendly last-updated date", async () => {
    fake.crop = { crop: cropDetail(), total: 0, colorFamilies: [] };
    const h = renderToStaticMarkup(
      (await CropPage({ params: Promise.resolve({ slug: "stock" }), searchParams: Promise.resolve({}) })) as ReactElement,
    );
    expect(h).toContain("last updated Nov 20, 2026");
    expect(h).not.toMatch(ISO);
    const meta = await cropMetadata({ params: Promise.resolve({ slug: "stock" }), searchParams: Promise.resolve({}) });
    expect(meta.description).toContain("Last updated Nov 20, 2026.");
    expect(meta.description).not.toMatch(ISO);
  });

  it("sweep extras: terms, privacy and the imported-rating fetched line carry no ISO", () => {
    const terms = renderToStaticMarkup(TermsPage() as ReactElement);
    expect(terms).toContain("Last updated Nov 16, 2026.");
    expect(terms).not.toMatch(ISO);
    const privacy = renderToStaticMarkup(PrivacyPage() as ReactElement);
    expect(privacy).toContain("Last updated Nov 17, 2026.");
    expect(privacy).not.toMatch(ISO);
    const panel = renderToStaticMarkup(
      ImportedRatingPanel({
        rating: { source: "Google", placeName: "Farm", placeId: "123", rating: 4.7, reviewCount: 313, fetchedDate: "2026-11-16" },
      }) as ReactElement,
    );
    expect(panel).toContain("fetched Nov 16, 2026");
    expect(panel).not.toMatch(ISO);
  });
});

describe("one canonical zero-seller sentence (Batch 0.2)", () => {
  it("the shared module pins the canonical sentence and its labeled forms", () => {
    expect(zeroSellerSentence("Katz Mix")).toBe("No seller found selling Katz Mix yet.");
    expect(ZERO_SELLER_SHORT).toBe("No sellers yet");
    expect(ZERO_SELLER_TITLE).toBe("No Seller Found Yet");
    expect(SELLER_NO_LISTINGS).toBe("No listings for this seller yet.");
  });

  it("zero-seller page body carries the canonical sentence; no retired variant returns", async () => {
    fake.variety = variety([]);
    const h = renderToStaticMarkup((await VarietyView({ slug: "stock-katz-mix", smallFarmOnly: false })) as ReactElement);
    // The header answer element survives for zero-seller pages (Dustin 2026-11-22 ruled on
    // the seller-list string only, and this sentence names no sellers).
    expect(h).toContain('data-testid="answer"');
    expect(h).toContain(zeroSellerSentence("Katz Mix"));
    for (const old of RETIRED) expect(h, old).not.toContain(old);
    // The rest of the body paragraph survives the replacement.
    expect(h).toContain("Browse");
    expect(h).toContain("Know a seller who sells it?");
  });

  it("zero-seller meta title uses the shared constant; description uses the Template C clause", () => {
    const v = variety([]);
    expect(varietyTitle(v)).toContain(ZERO_SELLER_TITLE);
    // Item ANS completion (Dustin 2026-11-23): the meta/OG/Twitter description no longer carries
    // the on-page zero-seller sentence — it renders Wren's Template C honesty + waitlist clause.
    expect(varietyDescription(v)).toContain("No US sellers currently list this variety. Join the waitlist.");
    for (const old of RETIRED) {
      expect(varietyTitle(v), old).not.toContain(old);
      expect(varietyDescription(v), old).not.toContain(old);
    }
  });

  it("zero-seller OG payload carries the canonical sentence", async () => {
    fake.variety = variety([]);
    const card = await ogCardFor("variety", "stock-katz-mix");
    expect(card?.subtitle).toBe(zeroSellerSentence("Katz Mix"));
    for (const old of RETIRED) expect(card?.subtitle ?? "", old).not.toContain(old);
    // The route draws this payload (not its own wording): the copy lives in
    // lib/seo/og-card.ts, sourced from the shared constant.
    const route = readFileSync(join(process.cwd(), "app/og/[kind]/[slug]/route.tsx"), "utf8");
    const copy = readFileSync(join(process.cwd(), "lib/seo/og-card.ts"), "utf8");
    expect(route).toContain("ogCardFor(kind, slug)");
    expect(copy).toContain("zeroSellerSentence(v.varietyName)");
    for (const old of RETIRED) {
      expect(route, old).not.toContain(old);
      expect(copy, old).not.toContain(old);
    }
  });

  it("template description + availability fragment derive from the canonical sentence", () => {
    expect(templateDescription({ varietyName: "Katz Mix", commonName: "Stock", latinName: "Matthiola incana", sellerCount: 0 })).toContain(
      zeroSellerSentence("Katz Mix"),
    );
    expect(availabilityPhrase(0, "Katz Mix")).toBe(zeroSellerSentence("Katz Mix"));
    expect(availabilityPhrase(1, "Katz Mix")).toBe("Available from 1 seller");
    expect(availabilityPhrase(2, "Katz Mix")).toBe("Available from 2 sellers");
    for (const old of RETIRED) {
      expect(templateDescription({ varietyName: "Katz Mix", commonName: "Stock", latinName: null, sellerCount: 0 }), old).not.toContain(old);
      expect(availabilityPhrase(0, "Katz Mix"), old).not.toContain(old);
    }
  });

  it("crop empty state uses the canonical sentence with the crop's name, then the waitlist pointer", async () => {
    fake.crop = { crop: cropDetail(), total: 0, colorFamilies: [] };
    const h = renderToStaticMarkup(
      (await CropPage({ params: Promise.resolve({ slug: "stock" }), searchParams: Promise.resolve({ has_sellers: "true" }) })) as ReactElement,
    );
    expect(h).toContain(zeroSellerSentence("Stock"));
    expect(h).toContain("Join a waiting list on any variety page and we will let you know when a seller lists one.");
    for (const old of RETIRED) expect(h, old).not.toContain(old);
  });

  it("card short form and seller-surface form render from the shared module, verbatim", async () => {
    const card = renderToStaticMarkup(
      VarietyCard({
        v: {
          slug: "stock-katz-mix",
          varietyName: "Katz Mix",
          plant: { ...plant, sowing_methods: [] },
          category: { slug: "flowers", name: "Flowers" },
          subcategory: null,
          series: null,
          colorSwatch: null,
          colorFamily: "mix",
          listingCount: 0,
          sellerCount: 0,
          inStockCount: 0,
          lastCheckedAt: null,
          indexable: true,
          rating: { state: "not_yet_rated", average: null, review_count: 0 },
          media: [],
          cropMedia: [],
        },
      }) as ReactElement,
    );
    expect(card).toContain(ZERO_SELLER_SHORT);
    fake.seller = {
      slug: "hollyhock-test-farm",
      name: "Hollyhock Test Farm",
      type: "specialty",
      location: "Junction City, OR",
      region: "OR",
      country: "US",
      homepage: null,
      ratingCount: 0,
      ratingAverage: null,
      rating: { state: "not_yet_rated", average: null, review_count: 0 },
      importedRating: null,
      isSmallFarm: false,
      description: null,
      orderingNotes: null,
      varietyCount: 0,
      updatedAt: "2026-11-20T00:00:00.000Z",
      claimStatus: "unclaimed",
      shipsTo: ["US"],
      isSiteOwner: false,
      listings: [],
      customerServicePhone: null,
      customerServiceEmail: null,
      locations: [],
    };
    const h = renderToStaticMarkup(
      (await SellerPage({ params: Promise.resolve({ slug: "hollyhock-test-farm" }), searchParams: Promise.resolve({}) })) as ReactElement,
    );
    expect(h).toContain(SELLER_NO_LISTINGS);
  });
});

describe("/about/data: future-sales hint deleted (audit M2)", () => {
  it("no longer hints that Hues will sell seed; the conflict-of-interest line is byte-unchanged", () => {
    expect(CONFLICT_OF_INTEREST).toBe("Hues Floral Park grows flowers and buys seed from some listed sellers. Sellers do not pay for placement.");
    const h = renderToStaticMarkup(AboutDataPage() as ReactElement);
    expect(h).not.toContain("If Hues ever lists its own seed");
    expect(h).toContain("Sellers do not pay for placement.");
  });
});
