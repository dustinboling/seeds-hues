/**
 * Seller State-cloud model + paging + life-cycle + names unit tests.
 * Expectations are hardcoded from the v2 sources (lib/seller-browse.ts,
 * lib/paging.ts, lib/life-cycle.ts, lib/names.ts).
 */
import { describe, expect, it } from "vitest";
import { pageFromSearch, pageInRange, pagePath, pageTitleSuffix, parsePageParam, totalPages } from "../../src/lib/paging";
import { lifeCycleBuckets, lifeCycleMatches } from "../../src/lib/life-cycle";
import { damerauLevenshtein, foldText, normalizeName, pickDidYouMean } from "../../src/lib/names";
import {
  clearSellerBrowseFilters,
  equalSellerBrowseFilters,
  hasActiveSellerFilters,
  isSellerOptionActive,
  parseSellerStateParam,
  readSellerBrowseFilters,
  sellerBrowseCountText,
  sellerBrowseFiltersFromSearch,
  sellerBrowseHref,
  sellerBrowseTitle,
  sellerChipHref,
  sellerCountFor,
  sellerCountStateFor,
  sellerFilterParams,
  sellerRemoversFor,
  type SellerStateOption,
} from "../../src/lib/seller-browse";

const STATES: SellerStateOption[] = [
  { code: "CA", name: "California", slug: "california" },
  { code: "KS", name: "Kansas", slug: "kansas" },
  { code: "OR", name: "Oregon", slug: "oregon" },
];

describe("paging", () => {
  it("parses ?page= strictly (missing → 1, garbage → 404-null)", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("2")).toBe(2);
    for (const bad of ["0", "-1", "abc", "2.5", "", " 2"]) {
      expect(parsePageParam(bad), JSON.stringify(bad)).toBeNull();
    }
    // A repeat's first value wins (v2's rule): valid first → its page.
    expect(parsePageParam(["2", "3"])).toBe(2);
    expect(parsePageParam(["abc", "2"])).toBeNull();
  });

  it("ranges pages past the end as 404 (an empty set still serves page 1)", () => {
    expect(totalPages(55)).toBe(3);
    expect(totalPages(0)).toBe(1);
    expect(pageInRange(3, 55)).toBe(true);
    expect(pageInRange(4, 55)).toBe(false);
    expect(pageInRange(1, 0)).toBe(true);
    expect(pageInRange(2, 0)).toBe(false);
  });

  it("builds page paths and title suffixes (page 1 is the bare path)", () => {
    expect(pagePath("/variety", 1)).toBe("/variety");
    expect(pagePath("/variety", 2)).toBe("/variety?page=2");
    expect(pageTitleSuffix(1)).toBe("");
    expect(pageTitleSuffix(2)).toBe(" — page 2");
  });

  it("mirrors ?page= forgivingly from a live search string", () => {
    expect(pageFromSearch("?page=2")).toBe(2);
    expect(pageFromSearch("")).toBe(1);
    expect(pageFromSearch("?page=abc")).toBe(1);
  });
});

describe("life-cycle buckets", () => {
  it("buckets how the plant is grown (grown-as decides alone)", () => {
    expect(lifeCycleBuckets("Annual")).toEqual(["annual"]);
    expect(lifeCycleBuckets("Perennial")).toEqual(["perennial"]);
    expect(lifeCycleBuckets("Tender perennial, grown as an annual")).toEqual(["annual"]);
    expect(lifeCycleBuckets("Annual or biennial")).toEqual(["annual", "biennial"]);
    expect(lifeCycleBuckets("Biennial or short-lived perennial")).toEqual(["biennial", "perennial"]);
    expect(lifeCycleBuckets("Hardy annual")).toEqual(["annual"]);
  });

  it("buckets nothing it does not recognise (null, empty, or off-grammar)", () => {
    expect(lifeCycleBuckets(null)).toEqual([]);
    expect(lifeCycleBuckets(undefined)).toEqual([]);
    expect(lifeCycleBuckets("")).toEqual([]);
    expect(lifeCycleBuckets("Ephemeral")).toEqual([]);
    expect(lifeCycleMatches("Annual", ["annual"])).toBe(true);
    expect(lifeCycleMatches("Annual", ["perennial"])).toBe(false);
    expect(lifeCycleMatches(null, ["annual"])).toBe(false);
  });
});

describe("names + did-you-mean", () => {
  it("folds text (accents, case, apostrophes, punctuation)", () => {
    expect(foldText("King's Ransom")).toBe("kings ransom");
    expect(foldText("  Sweet   Pea ")).toBe("sweet pea");
    expect(foldText("Papaver — somniferum")).toBe("papaver somniferum");
  });

  it("normalizes names (crop phrases and pack words stripped, fallback to folded)", () => {
    expect(normalizeName("King's Ransom Sweet Pea Seeds", "Sweet Pea")).toBe("kings ransom");
    expect(normalizeName("Seeds", null)).toBe("seeds");
  });

  it("measures Damerau-Levenshtein (a transposition counts as 1)", () => {
    expect(damerauLevenshtein("testbloom", "testbloom")).toBe(0);
    expect(damerauLevenshtein("testbloom", "testbloomx")).toBe(1);
    expect(damerauLevenshtein("testbloom", "testbolom")).toBe(1);
    expect(damerauLevenshtein("testbloom", "testblom")).toBe(1);
    expect(damerauLevenshtein("testbloom", "xyz")).toBeGreaterThan(2);
  });

  it("picks the closest same-letter name within distance 2 (exact never suggests)", () => {
    const corpus = [
      { name: "Testbloom", hasSellers: true },
      { name: "Testbloom 01", hasSellers: true },
      { name: "Blue Ribbon", hasSellers: true },
    ];
    expect(pickDidYouMean("testbloomx", corpus)).toBe("Testbloom");
    expect(pickDidYouMean("testbloom", corpus)).toBeNull();
    expect(pickDidYouMean("zxqv", corpus)).toBeNull();
    expect(pickDidYouMean("", corpus)).toBeNull();
  });

  it("breaks ties to the name with sellers, then alphabetical", () => {
    expect(
      pickDidYouMean("cat", [
        { name: "bat", hasSellers: false },
        { name: "cot", hasSellers: true },
      ]),
    ).toBe("cot");
    expect(
      pickDidYouMean("cat", [
        { name: "cot", hasSellers: true },
        { name: "cut", hasSellers: true },
      ]),
    ).toBe("cot");
  });
});

describe("seller state-cloud parsing (forgiving — unknown codes are All, never a 404)", () => {
  it("parses codes any-case and ignores everything else", () => {
    expect(parseSellerStateParam("OR", STATES)).toBe("OR");
    expect(parseSellerStateParam("or", STATES)).toBe("OR");
    expect(parseSellerStateParam("  ks ", STATES)).toBe("KS");
    expect(parseSellerStateParam("XX", STATES)).toBeNull();
    expect(parseSellerStateParam(undefined, STATES)).toBeNull();
    expect(parseSellerStateParam(["OR", "KS"], STATES)).toBe("OR");
    expect(readSellerBrowseFilters({ state: "ca" }, STATES)).toEqual({ state: "CA" });
    expect(readSellerBrowseFilters({}, STATES)).toEqual({ state: null });
  });

  it("mirrors parsing from a live location.search string", () => {
    expect(sellerBrowseFiltersFromSearch("?state=or", STATES)).toEqual({ state: "OR" });
    expect(sellerBrowseFiltersFromSearch("", STATES)).toEqual({ state: null });
  });

  it("compares, clears, and assigns states", () => {
    expect(equalSellerBrowseFilters({ state: null }, clearSellerBrowseFilters())).toBe(true);
    expect(hasActiveSellerFilters({ state: null })).toBe(false);
    expect(hasActiveSellerFilters({ state: "OR" })).toBe(true);
    expect(isSellerOptionActive({ state: "OR" }, "OR")).toBe(true);
    expect(isSellerOptionActive({ state: "OR" }, null)).toBe(false);
    expect(sellerCountStateFor({ state: "OR" }, "OR")).toEqual({ state: "OR" });
    expect(sellerCountStateFor({ state: "OR" }, null)).toEqual({ state: null });
  });
});

describe("seller URLs, count text, titles, removers", () => {
  it("links states without ?page= (a changed filter starts at page 1)", () => {
    expect(sellerFilterParams({ state: null })).toEqual({});
    expect(sellerFilterParams({ state: "OR" })).toEqual({ state: "OR" });
    expect(sellerBrowseHref("/seller", { state: "OR" })).toBe("/seller?state=OR");
    expect(sellerBrowseHref("/seller", { state: null })).toBe("/seller");
    expect(sellerChipHref("/seller", { state: "KS" }, "OR")).toBe("/seller?state=OR");
    expect(sellerChipHref("/seller", { state: "KS" }, null)).toBe("/seller");
  });

  it("words the count text (unfiltered posture + filtered state form)", () => {
    expect(sellerBrowseCountText({ state: null }, 26, STATES)).toBe(
      "26 sellers — US farms and seed companies of every size. Sellers do not pay for placement.",
    );
    expect(sellerBrowseCountText({ state: "OR" }, 9, STATES)).toBe("9 sellers in Oregon.");
    expect(sellerBrowseCountText({ state: "CA" }, 1, STATES)).toBe("1 seller in California.");
  });

  it("titles the index at rest and state views by name (unknown reads as rest)", () => {
    expect(sellerBrowseTitle({ state: null }, STATES, 1)).toBe("Flower seed sellers");
    expect(sellerBrowseTitle({ state: null }, STATES, 2)).toBe("Flower seed sellers — page 2");
    expect(sellerBrowseTitle({ state: "OR" }, STATES, 1)).toBe("Seed sellers in Oregon");
  });

  it("emits at most the single State remover", () => {
    expect(sellerRemoversFor({ state: null }, STATES)).toEqual([]);
    const [remover] = sellerRemoversFor({ state: "OR" }, STATES);
    expect([remover!.key, remover!.label, remover!.removeLabel]).toEqual([
      "state",
      "State: Oregon",
      "Remove the State filter, Oregon",
    ]);
    expect(remover!.clear({ state: "OR" })).toEqual({ state: null });
  });

  it("reads cloud counts (All + per-state, unknown codes fail closed to 0)", () => {
    const counts = { all: 26, options: { OR: 9, KS: 9, CA: 8 } };
    expect(sellerCountFor(counts, null)).toBe(26);
    expect(sellerCountFor(counts, "OR")).toBe(9);
    expect(sellerCountFor(counts, "XX")).toBe(0);
  });
});
