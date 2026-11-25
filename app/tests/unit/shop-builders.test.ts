/**
 * Slice 5 head builders: the m-5 sentence composition, titles, the
 * Organization/PostalAddress rule, the grower-guide tabs, and the four
 * page-head compositions (canonical/noindex/OG per state).
 */
import { describe, expect, it } from "vitest";
import { shopCatalogState } from "./shop-catalog";
import {
  cropDescription,
  sellerDescription,
  sellerTitle,
  seriesDescription,
  seriesTitle,
  stateDescription,
  stateTitle,
} from "../../src/seo/meta";
import { organizationJsonLd, parseLocation } from "../../src/seo/jsonld";
import { growerGuideTabs, lifeCycleFact } from "../../src/lib/grower-guide";
import { shopHead } from "../../pages/seller/@slug/head";
import { cropHead } from "../../pages/crop/@slug/head";
import { seriesHead } from "../../pages/series/@slug/head";
import { stateHead } from "../../pages/state/@slug/head";

const SITE = "https://seeds.hues.flowers";
const sellers = () => shopCatalogState().sellerDetails;

describe("seller title and the m-5 description composition", () => {
  it("titles the shop and composes the head-only branch (long prose)", () => {
    const s = sellers()["blue-ridge-seeds"]!;
    expect(sellerTitle(s)).toBe("Blue Ridge Seeds — Flower Seed Seller");
    // The old clip() would cut into the prose mid-word ("…Will…"); the
    // port ends at the head's sentence boundary instead.
    expect(sellerDescription(s)).toBe(
      "Blue Ridge Seeds in Portland, OR: 30 flower seed varieties listed, each with its stock state and the date it was last checked.",
    );
    expect(sellerDescription(s)).toMatch(/[.!?]$/);
    expect(sellerDescription(s)).not.toContain("Willamette");
  });

  it("admits the first prose sentence whole when it fits", () => {
    const s = sellers()["prairie-seed-house"]!;
    expect(sellerDescription(s)).toBe(
      "Prairie Seed House in Lawrence, KS: 12 flower seed varieties listed, each with its stock state and the date it was last checked. Heirloom seed, plainly grown.",
    );
  });

  it("handles null prose and null location without inventing words", () => {
    const s = sellers()["faraway-seeds"]!;
    expect(sellerDescription(s)).toBe(
      "Faraway Seeds in Online only: 2 flower seed varieties listed, each with its stock state and the date it was last checked.",
    );
    const noLoc = { ...s, location: null };
    expect(sellerDescription(noLoc)).toBe(
      "Faraway Seeds: 2 flower seed varieties listed, each with its stock state and the date it was last checked.",
    );
    const quiet = sellers()["quiet-hollow-farm"]!;
    expect(sellerDescription(quiet)).toBe(
      "Quiet Hollow Farm in Burlington, VT: 0 flower seed varieties listed, each with its stock state and the date it was last checked. A quiet hillside farm.",
    );
  });
});

describe("crop, series, and state titles and descriptions", () => {
  it("words the crop description with counts and the last-updated date", () => {
    expect(
      cropDescription({
        varietyCount: 30,
        commonName: "Sunflower",
        latinName: "Helianthus annuus",
        varietiesWithSellers: 25,
        lastUpdated: "2026-11-21",
      }),
    ).toBe(
      "30 varieties of Sunflower (Helianthus annuus) cataloged; 25 sold by sellers in the directory. Last updated Nov 21, 2026.",
    );
    expect(
      cropDescription({
        varietyCount: 1,
        commonName: "Cosmos",
        latinName: null,
        varietiesWithSellers: 0,
        lastUpdated: null,
      }),
    ).toBe("1 variety of Cosmos cataloged; 0 sold by sellers in the directory.");
  });

  it("words series titles and descriptions with counts and Latin", () => {
    expect(seriesTitle({ name: "Sunbeam", cropCommonName: "Sunflower", varietyCount: 8, varietiesWithSellers: 8 })).toBe(
      "Sunbeam Sunflower Series — 8 Varieties, 8 With Sellers",
    );
    expect(
      seriesDescription({
        name: "Sunbeam",
        cropCommonName: "Sunflower",
        latinName: "Helianthus annuus",
        varietyCount: 8,
        varietiesWithSellers: 8,
      }),
    ).toBe("The Sunbeam series of Sunflower (Helianthus annuus): 8 varieties cataloged, 8 sold by sellers in the directory.");
  });

  it("words the absolute state title and count description", () => {
    expect(stateTitle({ code: "OR", name: "Oregon", slug: "oregon", sellerCount: 2 })).toBe(
      "Seed sellers in Oregon — Seed Directory",
    );
    expect(stateDescription({ code: "OR", name: "Oregon", slug: "oregon", sellerCount: 2 })).toBe(
      "2 farms and seed companies in Oregon list flower seed with the Seed Directory, with the varieties each one carries and when each listing was last checked.",
    );
    expect(stateDescription({ code: "KS", name: "Kansas", slug: "kansas", sellerCount: 1 })).toBe(
      "1 farm or seed company in Kansas lists flower seed with the Seed Directory, with the varieties each one carries and when each listing was last checked.",
    );
  });
});

describe("Organization JSON-LD and the location parser", () => {
  it("parses City, ST and nothing else", () => {
    expect(parseLocation("Portland, OR")).toEqual({ "@type": "PostalAddress", addressLocality: "Portland", addressRegion: "OR" });
    expect(parseLocation("St. Louis, MO")).toEqual({
      "@type": "PostalAddress",
      addressLocality: "St. Louis",
      addressRegion: "MO",
    });
    expect(parseLocation("Online only")).toBeNull();
    expect(parseLocation("Austin, TX 78723")).toBeNull();
    expect(parseLocation(null)).toBeNull();
  });

  it("emits the address only from a parseable location, never inventing one", () => {
    const org = organizationJsonLd(sellers()["blue-ridge-seeds"]!);
    expect(org["name"]).toBe("Blue Ridge Seeds");
    expect(org["url"]).toBe("https://blueridgeseeds.example.com");
    expect(org["address"]).toEqual({ "@type": "PostalAddress", addressLocality: "Portland", addressRegion: "OR" });
    expect(org["mainEntityOfPage"]).toBe(`${SITE}/seller/blue-ridge-seeds`);
    const far = organizationJsonLd(sellers()["faraway-seeds"]!);
    expect(far).not.toHaveProperty("address");
    expect(far).not.toHaveProperty("url");
    expect(far).not.toHaveProperty("description");
  });
});

describe("grower guide tabs and the life-cycle fact", () => {
  it("joins life cycle and hardiness, or shows the hardy text alone", () => {
    expect(lifeCycleFact("Annual", "Tolerates light frost once established.")).toBe(
      "Annual · Tolerates light frost once established.",
    );
    expect(lifeCycleFact("Annual", "Hardy annual — seedlings tolerate light frost.")).toBe(
      "Hardy annual — seedlings tolerate light frost.",
    );
    expect(lifeCycleFact(null, "Tolerates light frost.")).toBe("Tolerates light frost.");
    expect(lifeCycleFact(null, null)).toBeNull();
  });

  it("builds life-arc tabs only for content the crop has", () => {
    const tabs = growerGuideTabs(shopCatalogState().cropExtras["sunflower"]!.grower_guide);
    expect(tabs.map((t) => t.id)).toEqual(["growing", "harvest", "seed-saving"]);
    const growing = tabs[0]!;
    expect(growing.id).toBe("growing");
    if (growing.id === "growing") {
      expect(growing.items.map((i) => i.label)).toEqual(["Sowing", "Germination", "Days to bloom", "Spacing", "Growing"]);
      expect(growing.goodToKnow).toHaveLength(2);
    }
    expect(growerGuideTabs(null)).toEqual([]);
    expect(growerGuideTabs({ growing: null, seed_saving: null })).toEqual([]);
  });
});

describe("page-head compositions", () => {
  it("self-canonicalizes unfiltered shop pages and noindexes stated views", () => {
    const s = sellers()["blue-ridge-seeds"]!;
    const clean = shopHead(s, 1, false);
    expect(clean.title).toBe("Blue Ridge Seeds — Flower Seed Seller | seeds.hues.flowers");
    expect(clean.canonical).toBe(`${SITE}/seller/blue-ridge-seeds`);
    expect(clean.robots).toBe("index, follow");
    expect(clean.og.image).toBe(`${SITE}/og/seller/blue-ridge-seeds`);
    const page2 = shopHead(s, 2, false);
    expect(page2.title).toBe("Blue Ridge Seeds — Flower Seed Seller — page 2 | seeds.hues.flowers");
    expect(page2.canonical).toBe(`${SITE}/seller/blue-ridge-seeds?page=2`);
    const stated = shopHead(s, 1, true);
    expect(stated.canonical).toBe(`${SITE}/seller/blue-ridge-seeds`);
    expect(stated.robots).toBe("noindex, follow");
    expect(stated.title).toBe(clean.title);
  });

  it("self-canonicalizes unfiltered crop pages and noindexes filtered views", () => {
    const facts = {
      commonName: "Sunflower",
      latinName: "Helianthus annuus",
      varietyCount: 30,
      varietiesWithSellers: 25,
      lastUpdated: "2026-11-21",
      slug: "sunflower",
    };
    const clean = cropHead(facts, 1, false);
    expect(clean.title).toBe("Sunflower Seeds (Helianthus annuus) — 30 Varieties, 25 With Sellers | seeds.hues.flowers");
    expect(clean.canonical).toBe(`${SITE}/crop/sunflower`);
    expect(clean.robots).toBe("index, follow");
    expect(clean.og.image).toBe(`${SITE}/og/crop/sunflower`);
    const filtered = cropHead(facts, 1, true);
    expect(filtered.canonical).toBe(`${SITE}/crop/sunflower`);
    expect(filtered.robots).toBe("noindex, follow");
  });

  it("self-canonicalizes series pages with v2's inherited site card (Slice 8: live-exact)", () => {
    const head = seriesHead({
      slug: "sunbeam",
      name: "Sunbeam",
      cropCommonName: "Sunflower",
      cropSlug: "sunflower",
      latinName: "Helianthus annuus",
      varietyCount: 8,
      varietiesWithSellers: 8,
    });
    expect(head.canonical).toBe(`${SITE}/series/sunbeam`);
    expect(head.robots).toBe("index, follow");
    expect(head.og.image).toBe(`${SITE}/og/site/default`);
  });

  it("renders absolute state titles with self-canonicals", () => {
    const head = stateHead({ code: "OR", name: "Oregon", slug: "oregon", sellerCount: 2 }, 1);
    expect(head.title).toBe("Seed sellers in Oregon — Seed Directory");
    expect(head.canonical).toBe(`${SITE}/state/oregon`);
    expect(head.robots).toBe("index, follow");
    expect(head.og.image).toBe(`${SITE}/og/site/default`);
    expect(stateHead({ code: "OR", name: "Oregon", slug: "oregon", sellerCount: 2 }, 2).canonical).toBe(
      `${SITE}/state/oregon?page=2`,
    );
  });
});
