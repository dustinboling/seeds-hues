/**
 * Tranche 3.4 §5.2 — the sort control's model (lib/browse.ts): the ?sort= vocabulary
 * (absent = Name A–Z, the PB-1 fallback), URL encoding, state equality, and the count
 * line's ordering phrases. The crop-detail half lives in crop-detail-filters.test.ts.
 * The F-4 follow-up pins Clear All keeping the shopper's sort (both non-resting sorts,
 * plus resting byte-equivalence).
 *
 * Non-vacuity: fails on pre-build code — parseSortParam, BrowseSortParam and the sort
 * phrases do not exist there (and resting states carry no sort). The F-4 pins fail on
 * the shipped PR #57 code too — its Clear All resets the sort to name.
 */
import { describe, expect, it } from "vitest";
import {
  BROWSE_SORT_OPTIONS,
  BROWSE_SORT_PHRASE,
  BROWSE_SORT_REPO,
  browseCountLine,
  browseHref,
  clearAllFilters,
  equalBrowseFilters,
  filterParams,
  parseSortParam,
  readBrowseFilters,
  readBrowseFiltersForGroups,
  scopedBrowseFiltersFromSearch,
  type BrowseFilterState,
  type BrowseSortParam,
} from "@/lib/browse";

const state = (over: Partial<BrowseFilterState> = {}): BrowseFilterState => ({
  season: null,
  method: null,
  lifeCycle: null,
  hue: [],
  smallFarm: false,
  sort: "name",
  ...over,
});

describe("?sort= vocabulary (PB-1 fallback: absent is Name A–Z)", () => {
  it("offers exactly the three options, in display order", () => {
    expect(BROWSE_SORT_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["availability", "Most sellers first"],
      ["name", "Name A–Z"],
      ["recent", "Recently checked"],
    ]);
  });

  it("parses the three values; absent/garbage/repeats forgive to name (never a 404)", () => {
    expect(parseSortParam("availability")).toBe("availability");
    expect(parseSortParam("name")).toBe("name");
    expect(parseSortParam("recent")).toBe("recent");
    expect(parseSortParam(undefined)).toBe("name");
    expect(parseSortParam("price-asc")).toBe("name");
    expect(parseSortParam(["recent", "availability"])).toBe("recent");
    expect(parseSortParam(["bogus", "recent"])).toBe("name");
  });

  it("maps to the repository sorts (recent is the existing -recently_checked)", () => {
    expect(BROWSE_SORT_REPO).toEqual({ availability: "availability", name: "name", recent: "-recently_checked" });
  });

  it("the full /variety parse reads ?sort=; the resting state sorts by name", () => {
    expect(readBrowseFilters({ sort: "availability" }, "multi").sort).toBe("availability");
    expect(readBrowseFilters({ sort: "recent" }, "multi").sort).toBe("recent");
    expect(readBrowseFilters({}, "multi").sort).toBe("name");
    expect(clearAllFilters(state()).sort).toBe("name");
  });

  it("scoped surfaces ignore ?sort= unless they carry the control", () => {
    const groups = ["season", "method"] as const;
    expect(readBrowseFiltersForGroups({ sort: "availability" }, [...groups], "single").sort).toBe("name");
    expect(readBrowseFiltersForGroups({ sort: "availability" }, [...groups], "single", true).sort).toBe("availability");
    expect(scopedBrowseFiltersFromSearch("?sort=recent", [...groups], "single").sort).toBe("name");
    expect(scopedBrowseFiltersFromSearch("?sort=recent", [...groups], "single", true).sort).toBe("recent");
  });
});

describe("sort in URLs and state equality", () => {
  it("a non-resting sort rides filter params; resting name serializes to the absent param", () => {
    expect(filterParams(state({ sort: "availability" }))).toEqual({ sort: "availability" });
    expect(filterParams(state({ sort: "recent", season: "cool" }))).toEqual({ season: "cool", sort: "recent" });
    expect(filterParams(state())).toEqual({});
    expect(filterParams(state({ sort: "name", hue: ["pink"] }))).toEqual({ color_family: "pink" });
  });

  it("browseHref carries the sort and still drops ?page=", () => {
    expect(browseHref("/variety", state({ sort: "availability" }), { page: "3" })).toBe("/variety?sort=availability");
    expect(browseHref("/variety", state({ sort: "name" }))).toBe("/variety");
    expect(browseHref("/variety", state({ sort: "recent", season: "cool" }))).toBe("/variety?season=cool&sort=recent");
  });

  it("equality distinguishes sorts (a sort tap is a real commit; re-taps are no-ops)", () => {
    expect(equalBrowseFilters(state(), state())).toBe(true);
    expect(equalBrowseFilters(state(), state({ sort: "availability" }))).toBe(false);
    expect(equalBrowseFilters(state({ sort: "recent" }), state({ sort: "recent" }))).toBe(true);
  });
});

describe("Clear All keeps the shopper's sort (F-4: §2.6 — sort is an ordering, not a group)", () => {
  const filtered = (sort: BrowseSortParam): BrowseFilterState =>
    state({ season: "cool", method: "direct", lifeCycle: "perennial", hue: ["pink", "peach"], smallFarm: true, sort });

  it("resets every group to All and leaves availability untouched", () => {
    expect(clearAllFilters(filtered("availability"))).toEqual(state({ sort: "availability" }));
  });

  it("resets every group to All and leaves recent untouched", () => {
    expect(clearAllFilters(filtered("recent"))).toEqual(state({ sort: "recent" }));
  });

  it("at the resting default Clear All is byte-equivalent to the resting state", () => {
    expect(clearAllFilters(state())).toEqual(state());
    expect(clearAllFilters(filtered("name"))).toEqual(state());
  });

  it("a cleared sorted state carries only ?sort= and states the true order", () => {
    const cleared = clearAllFilters(filtered("availability"));
    expect(filterParams(cleared)).toEqual({ sort: "availability" });
    expect(browseHref("/variety", cleared)).toBe("/variety?sort=availability");
    expect(browseCountLine(cleared, 48, 1, 1)).toBe("48 varieties, most sellers first.");
    const resting = clearAllFilters(filtered("name"));
    expect(filterParams(resting)).toEqual({});
    expect(browseHref("/variety", resting)).toBe("/variety");
  });
});

describe("the /variety count line's ordering phrase", () => {
  it("follows the active sort — and never claims alphabetical under another order", () => {
    expect(browseCountLine(state(), 48, 1, 2)).toBe("48 varieties, alphabetical. Page 1 of 2.");
    expect(browseCountLine(state({ sort: "availability" }), 48, 1, 2)).toBe("48 varieties, most sellers first. Page 1 of 2.");
    expect(browseCountLine(state({ sort: "recent" }), 1, 1, 1)).toBe("1 variety, most recently checked first.");
    expect(browseCountLine(state({ sort: "availability", hue: ["pink", "peach"] }), 12, 1, 1)).toBe(
      "12 varieties · Pink · Peach, most sellers first.",
    );
    expect(BROWSE_SORT_PHRASE).toEqual({
      availability: "most sellers first",
      name: "alphabetical",
      recent: "most recently checked first",
    });
  });
});
