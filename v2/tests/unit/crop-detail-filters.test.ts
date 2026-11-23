/**
 * Crop-detail filter model pins (lib/crop-detail.ts): the CropDetailCounts schema mirrors the
 * vocabulary (the pin lib/validators promises), and the ?sort= half of the 3.4 sort control
 * (parse, URL encoding, count-line phrases). Mirrors browse-filters.test.ts's schema pin.
 *
 * Non-vacuity: fails on pre-build code — this file does not exist there (the validators
 * comment cites it), and CropDetailFilterState carries no sort.
 */
import { describe, expect, it } from "vitest";
import {
  CROP_DETAIL_GROUPS,
  CROP_HUE_ORDER,
  clearCropDetailFilters,
  clearCropGroup,
  cropChipHref,
  cropCountStateFor,
  cropDetailCountLine,
  cropDetailFiltersFromSearch,
  cropFilterParams,
  cropHuesForFamilies,
  equalCropDetailFilters,
  readCropDetailFilters,
  removeCropHue,
  toggleCropHue,
  type CropDetailFilterState,
} from "@/lib/crop-detail";
import { CropDetailCountsSchema } from "@/lib/validators";

const state = (over: Partial<CropDetailFilterState> = {}): CropDetailFilterState => ({
  hue: [],
  series: null,
  hasSellers: null,
  sort: "name",
  ...over,
});

describe("CropDetailCountsSchema (the counts contract mirrors the vocabulary)", () => {
  it("requires the three groups: fixed sellers tri-state, dynamic hue/series records", () => {
    expect(CROP_DETAIL_GROUPS).toEqual(["sellers", "hue", "series"]);
    const shape = CropDetailCountsSchema.shape;
    expect(Object.keys(shape)).toEqual(["sellers", "hue", "series"]);
    expect(Object.keys(shape.sellers.shape)).toEqual(["all", "has", "none"]);
    for (const g of ["hue", "series"] as const) {
      expect(Object.keys(shape[g].shape)).toEqual(["all", "options"]);
    }
  });

  it("rejects a missing sellers cell and a negative count", () => {
    const good = { sellers: { all: 7, has: 5, none: 2 }, hue: { all: 7, options: { pink: 3 } }, series: { all: 7, options: {} } };
    expect(CropDetailCountsSchema.safeParse(good).success).toBe(true);
    expect(CropDetailCountsSchema.safeParse({ ...good, sellers: { all: 7, has: 5 } }).success).toBe(false);
    expect(CropDetailCountsSchema.safeParse({ ...good, sellers: { all: -1, has: 5, none: 2 } }).success).toBe(false);
  });

  it("hue options render in canonical order (shared vocabulary, unknown last)", () => {
    expect(CROP_HUE_ORDER[CROP_HUE_ORDER.length - 1]).toBe("unknown");
    expect(cropHuesForFamilies(["unknown", "bogus", "pink"])).toEqual(["pink", "unknown"]);
  });
});

describe("crop-detail transitions keep their shipped forms", () => {
  it("toggles, removers and group clears compose on sets", () => {
    expect(toggleCropHue(state(), "pink").hue).toEqual(["pink"]);
    expect(toggleCropHue(state({ hue: ["pink"] }), "pink").hue).toEqual([]);
    expect(removeCropHue(state({ hue: ["pink"] }), "pink").hue).toEqual([]);
    expect(clearCropGroup(state({ hue: ["pink"], sort: "recent" }), "hue")).toEqual(state({ sort: "recent" }));
    expect(cropCountStateFor(state(), "hue", "pink").hue).toEqual(["pink"]);
    expect(clearCropDetailFilters()).toEqual(state());
  });
});

describe("?sort= on the crop surface (PB-1 fallback: absent is Name A–Z)", () => {
  it("parses ?sort= forgivingly (absent/garbage is name, never a 404)", () => {
    expect(readCropDetailFilters({ sort: "availability" }).sort).toBe("availability");
    expect(readCropDetailFilters({ sort: "recent" }).sort).toBe("recent");
    expect(readCropDetailFilters({}).sort).toBe("name");
    expect(readCropDetailFilters({ sort: "bogus" }).sort).toBe("name");
    expect(cropDetailFiltersFromSearch("?sort=recent&color_family=pink").sort).toBe("recent");
    expect(cropDetailFiltersFromSearch("?color_family=pink").sort).toBe("name");
  });

  it("carries a non-resting sort on links; resting name serializes to the absent param", () => {
    expect(cropFilterParams(state({ sort: "availability" }))).toEqual({ sort: "availability" });
    expect(cropFilterParams(state())).toEqual({});
    expect(cropChipHref("/crop/zinnia", state(), "hue", "pink")).toBe("/crop/zinnia?color_family=pink");
    expect(cropChipHref("/crop/zinnia", state({ sort: "recent" }), "hue", "pink")).toBe(
      "/crop/zinnia?color_family=pink&sort=recent",
    );
  });

  it("equality distinguishes sorts (a sort tap is a real commit; re-taps are no-ops)", () => {
    expect(equalCropDetailFilters(state(), state())).toBe(true);
    expect(equalCropDetailFilters(state(), state({ sort: "recent" }))).toBe(false);
  });

  it("the count line's ordering phrase follows the active sort", () => {
    expect(cropDetailCountLine(state(), 24, 1, 1)).toBe("24 varieties, alphabetical.");
    expect(cropDetailCountLine(state({ sort: "availability" }), 24, 1, 1)).toBe("24 varieties, most sellers first.");
    expect(cropDetailCountLine(state({ sort: "recent", hue: ["pink"] }), 3, 1, 1)).toBe(
      "3 varieties match, most recently checked first.",
    );
    expect(cropDetailCountLine(state({ hasSellers: true }), 48, 2, 3)).toBe("48 varieties match, alphabetical. Page 2 of 3.");
  });
});
