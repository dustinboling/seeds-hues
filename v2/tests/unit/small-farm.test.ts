/**
 * "Small farm" badge + "Small farms" filter rules (Open Directory, 2026-11-19; ux-spec §3/§4).
 * The pure rules live in lib/small-farm.ts: the forgiving param parse, the variety-page count
 * line, and sellerFilterView — the chip-pair rendering rules (mixed sellers only; the B = 0
 * deep link's filtered-empty state; all-badged pages render no control).
 */
import { describe, expect, it } from "vitest";
import {
  parseSmallFarmParam,
  sellerFilterView,
  SMALL_FARM_BADGE_LABEL,
  SMALL_FARM_CHIP_LABEL,
  SMALL_FARM_FILTER_LABEL,
  varietyListingCountLine,
} from "@/lib/small-farm";
import { SNAPSHOT_ALLOWLIST } from "@/lib/repositories/snapshot-allowlist";
import type { PublicListing } from "@/lib/validators";

const listing = (id: number, isSmallFarm: boolean): PublicListing =>
  ({
    id,
    seller: { slug: `s${id}`, name: `Seller ${id}`, location: null, region: "WA", country: "US", isSmallFarm },
  }) as unknown as PublicListing;

describe("shared strings (copy deck: one constant per string)", () => {
  it("badge label, filter label and chip label are the deck's words", () => {
    expect(SMALL_FARM_BADGE_LABEL).toBe("Small farm");
    expect(SMALL_FARM_FILTER_LABEL).toBe("Small farms");
    expect(SMALL_FARM_CHIP_LABEL).toBe("Small farms only");
  });
});

describe("parseSmallFarmParam (ux §3.2: forgiving page-level parse)", () => {
  it('exactly "true" is on; everything else is off', () => {
    expect(parseSmallFarmParam("true")).toBe(true);
    expect(parseSmallFarmParam(undefined)).toBe(false);
    expect(parseSmallFarmParam("false")).toBe(false);
    expect(parseSmallFarmParam("garbage")).toBe(false);
    expect(parseSmallFarmParam("")).toBe(false);
    // A repeated param arrives as an array and is off (middleware applies the same rule).
    expect(parseSmallFarmParam(["true", "true"])).toBe(false);
  });
});

describe("varietyListingCountLine (ux §4.4, slot COUNT-VARIETY)", () => {
  it("off: the plain total; on: shown of total, with the of-N always present", () => {
    expect(varietyListingCountLine(5, 5, false)).toBe("5 listings.");
    expect(varietyListingCountLine(1, 1, false)).toBe("1 listing.");
    expect(varietyListingCountLine(5, 2, true)).toBe("2 of 5 listings · Small farms only.");
    expect(varietyListingCountLine(5, 0, true)).toBe("0 of 5 listings · Small farms only.");
  });
});

describe("sellerFilterView (ux §4.3 rendering rules)", () => {
  const mixed = [listing(1, true), listing(2, false), listing(3, true)];

  it("mixed sellers (0 < B < N): the control renders; narrowing keeps the original order", () => {
    const off = sellerFilterView(mixed, false);
    expect(off).toMatchObject({ total: 3, badged: 2, showControl: true, showLegend: true });
    expect(off.shown.map((l) => l.id)).toEqual([1, 2, 3]);
    const on = sellerFilterView(mixed, true);
    expect(on.shown.map((l) => l.id)).toEqual([1, 3]); // badged rows only, never re-sorted
    expect(on.countLine).toBe("2 of 3 listings · Small farms only.");
  });

  it("all badged (B = N): no control — the two states would show identical lists", () => {
    const v = sellerFilterView([listing(1, true), listing(2, true)], true);
    expect(v).toMatchObject({ total: 2, badged: 2, showControl: false, showLegend: true });
    expect(v.shown).toHaveLength(2);
  });

  it("no badged sellers (B = 0): no control and no legend; a deep-linked on-state shows nothing", () => {
    const off = sellerFilterView([listing(1, false), listing(2, false)], false);
    expect(off).toMatchObject({ total: 2, badged: 0, showControl: false, showLegend: false });
    expect(off.shown).toHaveLength(2);
    const deepLink = sellerFilterView([listing(1, false), listing(2, false)], true);
    expect(deepLink.shown).toEqual([]); // the page renders the filtered-empty state + Show all sellers
    expect(deepLink.countLine).toBe("0 of 2 listings · Small farms only.");
  });

  it("zero listings: nothing renders (the zero-seller state owns the page)", () => {
    expect(sellerFilterView([], true)).toMatchObject({ total: 0, badged: 0, showControl: false, showLegend: false, shown: [] });
  });
});

describe("snapshot allowlist (data-spec §2.3)", () => {
  it("the published snapshot carries sellers.isSmallFarm beside isSiteOwner", () => {
    const sellers = SNAPSHOT_ALLOWLIST.find((t) => t.name === "sellers")!;
    expect(sellers.columns).toContain("isSmallFarm");
    expect(sellers.columns).toContain("isSiteOwner");
  });
});
