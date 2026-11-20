/**
 * Seller batch (brief #4) unit checks: state code ↔ slug mapping, the StateShape component,
 * importedRating validation (catalog input + public schema) and its separation from our rating.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { US_STATES, stateByCode, stateBySlug, stateCodeOf, stateSlugOf } from "@/lib/data/states";
import { STATE_SHAPES } from "@/lib/data/state-paths";
import { StateShape } from "@/components/seller/StateShape";
import { CatalogImportedRatingInput } from "@/lib/catalog/input";
import { ImportedRatingSchema, SellerDetailSchema, type SellerDetail } from "@/lib/validators";
import { organizationJsonLd } from "@/lib/seo/jsonld";
import { stateDescription, stateTitle } from "@/lib/seo/metadata";
import { parseCatalog } from "@/lib/catalog/importer";
import { loadCatalogJson } from "../helpers/d1";

const SELLER_STATES = ["CA", "CO", "CT", "GA", "IA", "ME", "MN", "MT", "NV", "NY", "OR", "UT", "VA", "VT", "WA", "WI"];

describe("state slug ↔ code mapping", () => {
  it("maps codes to kebab-case name slugs and back", () => {
    expect(stateByCode("OR")).toEqual({ code: "OR", name: "Oregon", slug: "oregon" });
    expect(stateSlugOf("NY")).toBe("new-york");
    expect(stateCodeOf("new-york")).toBe("NY");
    expect(stateCodeOf("texas")).toBe("TX"); // a real state; whether it has a page is the service's call
    expect(stateByCode(" vt ")?.slug).toBe("vermont"); // codes are case-insensitive
  });

  it("covers the 50 states, one slug each, and round-trips every one", () => {
    expect(US_STATES).toHaveLength(50);
    expect(new Set(US_STATES.map((s) => s.slug)).size).toBe(50);
    for (const s of US_STATES) {
      expect(s.slug).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(stateCodeOf(stateSlugOf(s.code))).toBe(s.code);
    }
  });

  it("unknown or malformed values map to null (slugs are exact)", () => {
    for (const v of ["", "XX", "Oregon", "ORE", null, undefined]) expect(stateByCode(v)).toBeNull();
    for (const v of ["", "Oregon", "new york", "newyork", "atlantis", null, undefined]) expect(stateBySlug(v)).toBeNull();
  });

  it("the generated outlines cover exactly the 16 seller states, consistent with the mapping", () => {
    expect(Object.keys(STATE_SHAPES).sort()).toEqual(SELLER_STATES);
    for (const [code, shape] of Object.entries(STATE_SHAPES)) {
      expect(shape.code).toBe(code);
      expect(shape.slug).toBe(stateSlugOf(code));
      expect(shape.name).toBe(stateByCode(code)!.name);
      expect(shape.paths.length).toBeGreaterThan(0);
      expect(shape.viewBox).toMatch(/^0 0 100 \d+$/);
    }
  });
});

describe("StateShape", () => {
  const html = (region: string | null | undefined, size?: number) => renderToStaticMarkup(createElement(StateShape, { region, size }));

  it("renders nothing for an unknown, empty or shapeless region", () => {
    for (const r of ["TX", "XX", "", null, undefined]) {
      expect(StateShape({ region: r })).toBeNull();
      expect(html(r)).toBe("");
    }
  });

  it("renders a decorative inline svg (aria-hidden, unfocusable) with leaf-deep 8% fill + stroke", () => {
    const h = html("or", 140);
    expect(h).toMatch(/^<svg /);
    expect(h).toContain('aria-hidden="true"');
    expect(h).toContain('focusable="false"');
    expect(h).toContain('viewBox="0 0 100 74"');
    expect(h).toContain('width="140"');
    expect(h).toMatch(/class="[^"]*fill-leaf\/8[^"]*stroke-leaf/);
    expect(h.match(/<path /g)).toHaveLength(STATE_SHAPES.OR!.paths.length);
    expect(h).not.toMatch(/Oregon|<title/); // the name is printed as text by the caller, never inside the shape
  });

  describe("art variant", () => {
    const artHtml = (region: string, size?: number) => renderToStaticMarkup(createElement(StateShape, { region, size, art: true }));

    it("clips the state-flower artwork to the outline and draws the outline over it", () => {
      const h = artHtml("or", 140);
      // Image-CDN migration (2026-11-18): an 800-wide scale-down transformation of the R2 original.
      expect(h).toContain('href="https://images.seeds.hues.flowers/cdn-cgi/image/width=800,quality=80,format=auto,fit=scale-down/artwork/states/oregon.png"');
      expect(h).toMatch(/<clipPath id="state-art-clip-OR">/);
      expect(h).toMatch(/<image [^>]*clip-path="url\(#state-art-clip-OR\)"/);
      expect(h).toMatch(/<image [^>]*preserveAspectRatio="xMidYMid slice"/);
      expect(h).toMatch(/<image [^>]*width="100"[^>]*height="74"/);
      const n = STATE_SHAPES.OR!.paths.length;
      expect(h.match(/<path [^>]*fill="none"/g)).toHaveLength(n);
      expect(h.match(/<path /g)).toHaveLength(2 * n);
      expect(h.indexOf("<image")).toBeGreaterThan(h.indexOf("</defs>"));
      expect(h.indexOf('fill="none"')).toBeGreaterThan(h.indexOf("<image"));
      expect(h).not.toMatch(/fill-leaf\/8/);
      expect(h).toMatch(/class="[^"]*stroke-leaf/);
    });

    it("stays decorative: aria-hidden, unfocusable, data-state-shape, sized, no name or caption", () => {
      const h = artHtml("or", 140);
      expect(h).toMatch(/^<svg /);
      expect(h).toContain('aria-hidden="true"');
      expect(h).toContain('focusable="false"');
      expect(h).toContain('data-state-shape="OR"');
      expect(h).toContain('width="140"');
      expect(h).not.toMatch(/Oregon|<title|<text/);
    });

    it("the default (no art) rendering has no artwork", () => {
      const h = html("or", 140);
      expect(h).not.toContain("<image");
      expect(h).not.toContain("artwork/states");
    });
  });
});

describe("importedRating validation", () => {
  const ok = { source: "Google", placeName: "Farm", placeId: "123", rating: 4.7, reviewCount: 313, fetchedDate: "2026-11-16" };

  it("accepts the 0–5 bounds and rejects anything outside them", () => {
    for (const rating of [0, 2.5, 5]) {
      expect(CatalogImportedRatingInput.safeParse({ ...ok, rating }).success).toBe(true);
      expect(ImportedRatingSchema.safeParse({ ...ok, rating }).success).toBe(true);
    }
    for (const rating of [-0.1, 5.01, 10, Number.NaN]) {
      expect(CatalogImportedRatingInput.safeParse({ ...ok, rating }).success).toBe(false);
      expect(ImportedRatingSchema.safeParse({ ...ok, rating }).success).toBe(false);
    }
  });

  it("source is the enum (Google only); count is a non-negative integer; date is YYYY-MM-DD; no extra keys", () => {
    for (const bad of [
      { source: "Yelp" },
      { source: "google" },
      { reviewCount: -1 },
      { reviewCount: 1.5 },
      { fetchedDate: "16/11/2026" },
      { placeId: "" },
      { text: "Great seeds!" }, // review text is never stored
    ]) {
      expect(CatalogImportedRatingInput.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
    expect(ImportedRatingSchema.safeParse({ ...ok, source: "Yelp" }).success).toBe(false);
  });

  it("the seed data carries 7 imported ratings (all Google) and 18 nulls", () => {
    const c = parseCatalog(loadCatalogJson());
    const withRating = c.sellers.filter((s) => s.importedRating);
    expect(withRating.map((s) => s.slug).sort()).toEqual([
      "3-porch-farm",
      "botanical-interests",
      "high-mowing-organic-seeds",
      "hudson-valley-seed-co",
      "johnnys-selected-seeds",
      "prairie-moon-nursery",
      "seed-savers-exchange",
    ]);
    expect(withRating.every((s) => s.importedRating!.source === "Google")).toBe(true);
    expect(c.sellers.filter((s) => s.importedRating === null)).toHaveLength(18);
  });

  it("never blends into our rating or the Organization JSON-LD", () => {
    const seller: SellerDetail = {
      slug: "johnnys-selected-seeds",
      name: "Johnny's Selected Seeds",
      type: "retail",
      location: "Winslow, ME",
      region: "ME",
      country: "US",
      homepage: "https://www.johnnyseeds.com/",
      ratingCount: 0,
      ratingAverage: null,
      rating: { state: "not_yet_rated", average: null, review_count: 0 },
      importedRating: { ...ok, source: "Google" },
      isSmallFarm: false,
      description: null,
      orderingNotes: null,
      varietyCount: 0,
      updatedAt: "2026-11-17T00:00:00.000Z",
      claimStatus: "unclaimed",
      shipsTo: ["US"],
      isSiteOwner: false,
      listings: [],
    };
    expect(SellerDetailSchema.safeParse(seller).success).toBe(true);
    const ld = JSON.stringify(organizationJsonLd(seller));
    expect(ld).not.toMatch(/rating|review|4\.7|313/i);
  });
});

describe("state page SEO copy", () => {
  it("title + description come from data", () => {
    const st = { code: "OR", name: "Oregon", slug: "oregon", sellerCount: 3 };
    expect(stateTitle(st)).toBe("Seed sellers in Oregon — Seed Directory");
    expect(stateDescription(st)).toMatch(/^3 farms and seed companies in Oregon list flower seed with the Seed Directory/);
    expect(stateDescription({ ...st, sellerCount: 1 })).toMatch(/^1 farm or seed company in Oregon lists /);
    expect(stateDescription(st).length).toBeLessThanOrEqual(160);
  });
});
