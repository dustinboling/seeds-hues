/**
 * Crop-detail model (ported from v2/lib/crop-detail.ts): the strict param
 * validation (Bea §3.4 — malformed values 404), the forgiving vocabulary,
 * states, counts, hrefs, removers, and lines — asserted against the
 * sunflower fixture set (30 varieties).
 */
import { describe, expect, it } from "vitest";
import { shopCatalogState } from "./shop-catalog";
import {
  CROP_DETAIL_GROUPS,
  CROP_DETAIL_LEGENDS,
  CROP_HUE_ORDER,
  clearCropDetailFilters,
  clearCropGroup,
  cropChipHref,
  cropCountFor,
  cropCountStateFor,
  cropDetailCountLine,
  cropDetailCountsFor,
  cropDetailDocumentTitle,
  cropDetailFiltersFromSearch,
  cropDetailHref,
  cropDetailParamsValid,
  cropDetailTitle,
  cropFilterParams,
  cropHueLabel,
  cropHuesForFamilies,
  cropRemoversFor,
  equalCropDetailFilters,
  hasActiveCropFilters,
  isCropDetailCountsPayload,
  isCropOptionActive,
  narrowCropVarieties,
  readCropDetailFilters,
  removeCropHue,
  toggleCropHue,
  varietyMatchesCrop,
  type CropDetailFilterState,
} from "../../src/lib/crop-detail";

const members = () => shopCatalogState().listItems.filter((v) => v.plant.slug === "sunflower");
const rest = (): CropDetailFilterState => ({ hue: [], series: null, hasSellers: null, sort: "name" });
const HUES = cropHuesForFamilies(["pink", "yellow", "red", "orange", "white", "unknown"]);
const SERIES = ["sunbeam", "moonshadow"];

describe("crop strict param validation (malformed → the route 404s)", () => {
  it("accepts absent, empty, and well-formed params", () => {
    expect(cropDetailParamsValid({})).toBe(true);
    expect(cropDetailParamsValid({ color_family: "pink", has_sellers: "true", series: "sunbeam", sort: "recent" })).toBe(true);
    expect(cropDetailParamsValid({ color_family: "pink,white", has_sellers: "false" })).toBe(true);
    expect(cropDetailParamsValid({ color_family: ["pink", "white"] })).toBe(true);
    expect(cropDetailParamsValid({ color_family: "" })).toBe(true);
    expect(cropDetailParamsValid({ has_sellers: "" })).toBe(true);
    // Pattern-clean but unknown hues are vocabulary-forgiving, never a 404.
    expect(cropDetailParamsValid({ color_family: "mauve" })).toBe(true);
    expect(cropDetailParamsValid({ color_family: "pink,mauve" })).toBe(true);
  });

  it("rejects color_family values failing the API pattern", () => {
    expect(cropDetailParamsValid({ color_family: "PINK!" })).toBe(false);
    expect(cropDetailParamsValid({ color_family: "pink,PINK" })).toBe(false);
    expect(cropDetailParamsValid({ color_family: "pink white" })).toBe(false);
    expect(cropDetailParamsValid({ color_family: "pink123" })).toBe(false);
    expect(cropDetailParamsValid({ color_family: "x".repeat(41) })).toBe(false);
  });

  it("rejects has_sellers values other than exactly true/false", () => {
    expect(cropDetailParamsValid({ has_sellers: "yes" })).toBe(false);
    expect(cropDetailParamsValid({ has_sellers: "1" })).toBe(false);
    expect(cropDetailParamsValid({ has_sellers: "True" })).toBe(false);
    expect(cropDetailParamsValid({ has_sellers: ["yes", "true"] })).toBe(false);
  });
});

describe("crop forgiving parse (v2 semantics)", () => {
  it("ignores unknown hues, keeps unknown series, first has_sellers wins", () => {
    expect(readCropDetailFilters({ color_family: "mauve" })).toEqual(rest());
    expect(readCropDetailFilters({ color_family: "pink,mauve,white" }).hue).toEqual(["white", "pink"]);
    expect(readCropDetailFilters({ series: "no-such-series" }).series).toBe("no-such-series");
    expect(readCropDetailFilters({ series: "BAD SLUG" }).series).toBeNull();
    expect(readCropDetailFilters({ has_sellers: "yes" }).hasSellers).toBeNull();
    expect(readCropDetailFilters({ has_sellers: ["true", "false"] }).hasSellers).toBe(true);
    expect(readCropDetailFilters({ sort: "bogus" }).sort).toBe("name");
    expect(cropDetailFiltersFromSearch("?color_family=pink&series=sunbeam&has_sellers=true&sort=recent")).toEqual({
      hue: ["pink"],
      series: "sunbeam",
      hasSellers: true,
      sort: "recent",
    });
  });

  it("orders hues canonically with unknown last", () => {
    expect(CROP_HUE_ORDER).toEqual([
      "white",
      "blush",
      "pink",
      "peach",
      "orange",
      "yellow",
      "red",
      "burgundy",
      "purple",
      "blue",
      "green",
      "chocolate",
      "mix",
      "unknown",
    ]);
    expect(cropHueLabel("unknown")).toBe("Unknown");
    expect(cropHueLabel("pink")).toBe("Pink");
    expect(HUES).toEqual(["white", "pink", "orange", "yellow", "red", "unknown"]);
  });
});

describe("crop narrowing and counts", () => {
  it("narrows AND across groups, OR within hue", () => {
    expect(narrowCropVarieties(members(), { ...rest(), hasSellers: true })).toHaveLength(25);
    expect(narrowCropVarieties(members(), { ...rest(), hasSellers: false })).toHaveLength(5);
    expect(narrowCropVarieties(members(), { ...rest(), hue: ["pink"] })).toHaveLength(5);
    expect(narrowCropVarieties(members(), { ...rest(), hue: ["pink", "white"] })).toHaveLength(10);
    expect(narrowCropVarieties(members(), { ...rest(), series: "sunbeam" })).toHaveLength(8);
    expect(narrowCropVarieties(members(), { ...rest(), series: "no-such-series" })).toHaveLength(0);
    expect(narrowCropVarieties(members(), { ...rest(), hue: ["pink"], hasSellers: true }).map((v) => v.varietyName)).toEqual(
      ["Autumn Beauty", "Florenza", "Moulin Rouge", "ProCut Orange", "Strawberry Blonde"],
    );
    // White holds the two zero-seller whites (Italian, Velvet Queen).
    expect(narrowCropVarieties(members(), { ...rest(), hue: ["white"], hasSellers: true })).toHaveLength(3);
    const italian = members().find((v) => v.varietyName === "Italian White")!;
    expect(varietyMatchesCrop(italian, { ...rest(), hasSellers: true })).toBe(false);
    expect(varietyMatchesCrop(italian, { ...rest(), hasSellers: false })).toBe(true);
  });

  it("counts every rendered chip under its count state", () => {
    const counts = cropDetailCountsFor(members(), rest(), HUES, SERIES);
    expect(isCropDetailCountsPayload(counts)).toBe(true);
    expect(cropCountFor(counts, "sellers", null)).toBe(30);
    expect(cropCountFor(counts, "sellers", "true")).toBe(25);
    expect(cropCountFor(counts, "sellers", "false")).toBe(5);
    expect(cropCountFor(counts, "hue", "pink")).toBe(5);
    expect(cropCountFor(counts, "hue", "unknown")).toBe(5);
    expect(cropCountFor(counts, "series", "sunbeam")).toBe(8);
    expect(cropCountFor(counts, "series", "moonshadow")).toBe(3);
    // Held groups compose: hue white under hasSellers=true drops the
    // two zero-seller whites.
    const held = cropDetailCountsFor(members(), { ...rest(), hasSellers: true }, HUES, SERIES);
    expect(cropCountFor(held, "hue", "white")).toBe(3);
    expect(cropCountFor(held, "hue", "pink")).toBe(5);
    expect(cropCountFor(held, "sellers", null)).toBe(30);
  });
});

describe("crop state, hrefs, removers, and lines", () => {
  it("transitions hue sets, groups, and Clear All (sort survives)", () => {
    expect(CROP_DETAIL_GROUPS).toEqual(["sellers", "hue", "series"]);
    expect(CROP_DETAIL_LEGENDS).toEqual({ sellers: "Sellers", hue: "Hue", series: "Series" });
    const s: CropDetailFilterState = { hue: ["pink"], series: "sunbeam", hasSellers: true, sort: "recent" };
    expect(hasActiveCropFilters(s)).toBe(true);
    expect(hasActiveCropFilters({ ...rest(), sort: "recent" })).toBe(false);
    expect(isCropOptionActive(s, "sellers", "true")).toBe(true);
    expect(isCropOptionActive(s, "hue", "pink")).toBe(true);
    expect(toggleCropHue(s, "pink").hue).toEqual([]);
    expect(toggleCropHue(s, "white").hue).toEqual(["white", "pink"]);
    expect(removeCropHue(s, "white")).toBe(s);
    expect(clearCropGroup(s, "series").series).toBeNull();
    expect(clearCropDetailFilters(s)).toEqual({ hue: [], series: null, hasSellers: null, sort: "recent" });
    expect(equalCropDetailFilters(s, { ...s })).toBe(true);
    expect(equalCropDetailFilters(s, rest())).toBe(false);
  });

  it("serializes states to shareable hrefs (page dropped, resting sort absent)", () => {
    expect(cropDetailHref("/crop/sunflower", rest())).toBe("/crop/sunflower");
    expect(cropFilterParams({ hue: ["pink"], series: null, hasSellers: true, sort: "recent" })).toEqual({
      color_family: "pink",
      has_sellers: "true",
      sort: "recent",
    });
    expect(cropChipHref("/crop/sunflower", rest(), "hue", "pink")).toBe("/crop/sunflower?color_family=pink");
    expect(cropChipHref("/crop/sunflower", { ...rest(), hue: ["pink"] }, "hue", "pink")).toBe("/crop/sunflower");
    expect(cropCountStateFor(rest(), "sellers", "true")).toEqual({ hue: [], series: null, hasSellers: true, sort: "name" });
  });

  it("builds removers in group order", () => {
    const removers = cropRemoversFor(
      { hue: ["pink"], series: "sunbeam", hasSellers: true, sort: "name" },
      { seriesName: (slug) => (slug === "sunbeam" ? "Sunbeam" : slug) },
    );
    expect(removers.map((r) => r.label)).toEqual(["Sellers: Has sellers", "Hue: Pink", "Series: Sunbeam"]);
    expect(removers[0]!.removeLabel).toBe("Remove the Sellers filter, Has sellers");
  });

  it("words the count line and titles", () => {
    expect(cropDetailCountLine(rest(), 30, 1, 2)).toBe("30 varieties, alphabetical. Page 1 of 2.");
    expect(cropDetailCountLine({ ...rest(), hasSellers: true }, 25, 1, 2)).toBe("25 varieties match, alphabetical. Page 1 of 2.");
    expect(
      cropDetailTitle({ commonName: "Sunflower", latinName: "Helianthus annuus", varietyCount: 30, varietiesWithSellers: 25 }, 1),
    ).toBe("Sunflower Seeds (Helianthus annuus) — 30 Varieties, 25 With Sellers");
    expect(
      cropDetailTitle({ commonName: "Sunflower", latinName: "Helianthus annuus", varietyCount: 30, varietiesWithSellers: 25 }, 2),
    ).toBe("Sunflower Seeds (Helianthus annuus) — 30 Varieties, 25 With Sellers — page 2");
    expect(
      cropDetailDocumentTitle(
        { commonName: "Sunflower", latinName: "Helianthus annuus", varietyCount: 30, varietiesWithSellers: 25 },
        1,
      ),
    ).toBe("Sunflower Seeds (Helianthus annuus) — 30 Varieties, 25 With Sellers | seeds.hues.flowers");
  });
});
