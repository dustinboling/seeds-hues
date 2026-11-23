/**
 * B-1 item 3 — the browse document-title builders: the exact titles the server renders
 * for each committed state, shared by generateMetadata (SSR) and the in-place title sync
 * (hydrated commits), so the two can never disagree. Every expected string below is
 * pinned literally: the pre-template title, the root template suffix, and the page echo.
 *
 * Non-vacuity: fails on PR #59's head — the builders do not exist there.
 */
import { describe, expect, it } from "vitest";
import {
  titlePageSuffix,
  varietyBrowseTitle,
  varietyDocumentTitle,
  type BrowseFilterState,
} from "@/lib/browse";
import { cropDetailDocumentTitle, cropDetailTitle } from "@/lib/crop-detail";
import { sellerBrowseTitle, sellerDocumentTitle } from "@/lib/seller-browse";

const resting = (over: Partial<BrowseFilterState> = {}): BrowseFilterState => ({
  season: null,
  method: null,
  lifeCycle: null,
  hue: [],
  smallFarm: false,
  sort: "name",
  ...over,
});

describe("titlePageSuffix", () => {
  it("echoes the page only past page 1 (the pageTitleSuffix mirror)", () => {
    expect(titlePageSuffix(1)).toBe("");
    expect(titlePageSuffix(2)).toBe(" — page 2");
    expect(titlePageSuffix(7)).toBe(" — page 7");
  });
});

describe("variety titles", () => {
  it("rests on the unfiltered title; filters join with ·; sort never appears", () => {
    expect(varietyBrowseTitle(resting(), 1)).toBe("All flower seed varieties");
    expect(varietyBrowseTitle(resting({ season: "cool" }), 1)).toBe(
      "Cool Season Hardy Annuals — flower seed varieties",
    );
    expect(varietyBrowseTitle(resting({ hue: ["pink", "peach"] }), 1)).toBe(
      "Pink · Peach — flower seed varieties",
    );
    expect(varietyBrowseTitle(resting({ sort: "availability" }), 1)).toBe("All flower seed varieties");
  });

  it("carries the page suffix past page 1; the document title adds the root template", () => {
    expect(varietyBrowseTitle(resting(), 2)).toBe("All flower seed varieties — page 2");
    expect(varietyDocumentTitle(resting(), 1)).toBe("All flower seed varieties | seeds.hues.flowers");
    expect(varietyDocumentTitle(resting({ season: "cool" }), 1)).toBe(
      "Cool Season Hardy Annuals — flower seed varieties | seeds.hues.flowers",
    );
    expect(varietyDocumentTitle(resting(), 2)).toBe("All flower seed varieties — page 2 | seeds.hues.flowers");
  });
});

describe("seller titles", () => {
  const states = [
    { code: "OR", name: "Oregon", slug: "oregon" },
    { code: "TX", name: "Texas", slug: "texas" },
  ];

  it("names the selected state, or the unfiltered title at rest (unknown codes read as All)", () => {
    expect(sellerBrowseTitle({ state: null }, states, 1)).toBe("Flower seed sellers");
    expect(sellerBrowseTitle({ state: "OR" }, states, 1)).toBe("Seed sellers in Oregon");
    expect(sellerBrowseTitle({ state: "XX" }, states, 1)).toBe("Flower seed sellers");
  });

  it("carries the page suffix; the document title adds the root template", () => {
    expect(sellerDocumentTitle({ state: null }, states, 1)).toBe("Flower seed sellers | seeds.hues.flowers");
    expect(sellerDocumentTitle({ state: "TX" }, states, 2)).toBe(
      "Seed sellers in Texas — page 2 | seeds.hues.flowers",
    );
  });
});

describe("crop-detail titles", () => {
  const facts = { commonName: "Sweet Pea", latinName: "Lathyrus odoratus", varietyCount: 12, varietiesWithSellers: 9 };

  it("renders the crop seed line with the latin name and the coverage counts", () => {
    expect(cropDetailTitle(facts, 1)).toBe(
      "Sweet Pea Seeds (Lathyrus odoratus) — 12 Varieties, 9 With Sellers",
    );
  });

  it("shortens slash-joined names, omits a missing latin name, singularizes one variety", () => {
    expect(
      cropDetailTitle(
        { commonName: "Cornflower / Bachelor's Buttons", latinName: null, varietyCount: 1, varietiesWithSellers: 0 },
        1,
      ),
    ).toBe("Cornflower Seeds — 1 Variety, 0 With Sellers");
  });

  it("carries the page suffix; the document title adds the root template", () => {
    expect(cropDetailDocumentTitle(facts, 2)).toBe(
      "Sweet Pea Seeds (Lathyrus odoratus) — 12 Varieties, 9 With Sellers — page 2 | seeds.hues.flowers",
    );
  });
});
