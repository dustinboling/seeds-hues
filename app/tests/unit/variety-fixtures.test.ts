/**
 * Slice 3 fixture guards: the fake variety catalog is the contract suite's
 * oracle, so its own consistency is asserted here — counts match the
 * listings, slugs are well-formed, every referenced crop/seller/merge
 * target exists, and (load-bearing for the price guard) the fixture JSON
 * carries none of the prohibited strings or price patterns. A dirty fixture
 * would make the suite's no-price assertions vacuous; this file proves the
 * fixtures are clean. Green before and after the surface lands.
 */
import { describe, expect, it } from "vitest";
import { PROHIBITED_JSONLD } from "../../src/lib/jsonld-guard";
import type { ApiVarietyDetail } from "../../src/data/types";
import { fakeCatalogState } from "./fake-catalog";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRICE = /\$\s*\d/;
const PRICE_LABEL = /("[Pp]rice"|\b[Pp]rices?)\s*:/;

const details = (): ApiVarietyDetail[] => Object.values(fakeCatalogState().details);

describe("variety fixtures", () => {
  it("covers the five brief kinds by slug", () => {
    const state = fakeCatalogState();
    expect(Object.keys(state.details).sort()).toEqual([
      "cosmos-candy-stripe",
      "cosmos-lonely-bloom",
      "cosmos-mystery-bloom",
      "sweet-pea-kings-ransom",
    ]);
    expect(state.details["sweet-pea-kings-ransom"]!.listings.length).toBeGreaterThanOrEqual(3);
    expect(state.details["cosmos-lonely-bloom"]!.listings).toHaveLength(0);
    expect(
      state.details["cosmos-candy-stripe"]!.listings.filter((l) => l.seller.isSmallFarm),
    ).toHaveLength(0);
    expect(state.merged).toEqual({ "sweet-pea-old-ransom": "sweet-pea-kings-ransom" });
  });

  it("keeps every slug well-formed", () => {
    const state = fakeCatalogState();
    for (const slug of [...Object.keys(state.details), ...Object.keys(state.merged), ...Object.values(state.merged)]) {
      expect(slug, `slug ${slug}`).toMatch(SLUG);
    }
    for (const item of state.listItems) expect(item.slug, `sibling ${item.slug}`).toMatch(SLUG);
  });

  it("keeps counts consistent with the listings", () => {
    for (const detail of details()) {
      expect(detail.listingCount, `${detail.slug} listingCount`).toBe(detail.listings.length);
      const sellers = new Set(detail.listings.map((l) => l.seller.slug));
      expect(detail.sellerCount, `${detail.slug} sellerCount`).toBe(sellers.size);
      expect(detail.inStockCount, `${detail.slug} inStockCount`).toBe(
        detail.listings.filter((l) => l.availability === "in_stock").length,
      );
      const latest = detail.listings
        .map((l) => l.lastCheckedAt?.slice(0, 10))
        .filter((d): d is string => Boolean(d))
        .sort()
        .at(-1);
      expect(detail.lastCheckedAt?.slice(0, 10) ?? null, `${detail.slug} lastCheckedAt`).toBe(latest ?? null);
    }
  });

  it("references only crops, sellers, and merge targets that exist", () => {
    const state = fakeCatalogState();
    const crops = new Set(state.crops.map((c) => c.slug));
    const sellers = new Set(state.sellers.map((s) => s.slug));
    for (const detail of details()) {
      expect(crops.has(detail.plant.slug), `${detail.slug} crop`).toBe(true);
      for (const listing of detail.listings) {
        expect(sellers.has(listing.seller.slug), `${detail.slug} seller ${listing.seller.slug}`).toBe(true);
        expect(listing.variety.slug, "listing variety ref").toBe(detail.slug);
      }
    }
    for (const item of state.listItems) expect(crops.has(item.plant.slug), `sibling ${item.slug} crop`).toBe(true);
    for (const target of Object.values(state.merged)) {
      expect(Object.hasOwn(state.details, target), `merge target ${target}`).toBe(true);
    }
  });

  it("carries no prohibited JSON-LD string and no price pattern anywhere", () => {
    const state = fakeCatalogState();
    // review_count is the API's documented rating field (v2 RatingSchema) —
    // real wire data, never emitted into JSON-LD (the builder-level guard
    // proves that). Scrub the known-good key, then scan for real dirt.
    const json = JSON.stringify({ details: state.details, listItems: state.listItems }).replace(
      /"review_count":\d+/g,
      '"RATING_COUNT"',
    );
    for (const forbidden of PROHIBITED_JSONLD) {
      expect(json.includes(forbidden), `fixture contains ${JSON.stringify(forbidden)}`).toBe(false);
    }
    expect(PRICE.test(json), "fixture contains a dollar amount").toBe(false);
    expect(PRICE_LABEL.test(json), "fixture contains a price label").toBe(false);
  });

  it("shows packet sizes without prices (the non-price strings the guard must pass)", () => {
    const json = JSON.stringify(fakeCatalogState().details);
    expect(json).toContain("25 seeds");
    expect(json).toContain("1 g");
  });
});
