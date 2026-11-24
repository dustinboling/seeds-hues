/**
 * Browse-filter model unit tests: vocabulary, parsing (forgiving, never a
 * 404), transitions (multi-select Hue toggles, Clear All keeps the sort),
 * URLs, labels, count lines, titles, removers, and the count-matrix
 * states. Expectations are hardcoded from v2's lib/browse.ts behavior.
 */
import { describe, expect, it } from "vitest";
import {
  BROWSE_OPTIONS,
  activeFilterLabels,
  browseCountLine,
  browseFiltersFromSearch,
  browseCountStates,
  browseHref,
  chipHref,
  clearAllFilters,
  clearGroup,
  countFor,
  countStateFor,
  equalBrowseFilters,
  filterParams,
  hasActiveFilters,
  isGroupActive,
  isOptionActive,
  parseHueParam,
  parseHueParamSingle,
  parseLifeCycleParam,
  parseMethodParam,
  parseSeasonParam,
  parseSortParam,
  readBrowseFilters,
  readBrowseFiltersForGroups,
  removersFor,
  removeHue,
  toggleHue,
  varietyBrowseTitle,
  withGroup,
  type BrowseFilterState,
} from "../../src/lib/browse";

const REST: BrowseFilterState = { season: null, method: null, lifeCycle: null, hue: [], smallFarm: false, sort: "name" };

describe("parsing (forgiving — unknown values are All, never a 404)", () => {
  it("parses each single-select param and ignores garbage", () => {
    expect(parseSeasonParam("cool")).toBe("cool");
    expect(parseSeasonParam("warm")).toBe("warm");
    expect(parseSeasonParam("hot")).toBeNull();
    expect(parseSeasonParam(undefined)).toBeNull();
    expect(parseMethodParam("direct")).toBe("direct");
    expect(parseMethodParam("trays")).toBe("trays");
    expect(parseMethodParam("seed")).toBeNull();
    expect(parseLifeCycleParam("annual")).toBe("annual");
    expect(parseLifeCycleParam("perennial")).toBe("perennial");
    expect(parseLifeCycleParam("ephemeral")).toBeNull();
  });

  it("parses multi hue as a comma list and/or repeats, deduped into vocabulary order", () => {
    expect(parseHueParam("yellow")).toEqual(["yellow"]);
    expect(parseHueParam("yellow,white")).toEqual(["white", "yellow"]);
    expect(parseHueParam(["yellow", "white,pink"])).toEqual(["white", "pink", "yellow"]);
    expect(parseHueParam("yellow,notacolor")).toEqual(["yellow"]);
    expect(parseHueParam("notacolor")).toEqual([]);
    expect(parseHueParam(undefined)).toEqual([]);
  });

  it("parses single hue as exactly one family", () => {
    expect(parseHueParamSingle("pink")).toBe("pink");
    expect(parseHueParamSingle("pink,yellow")).toBeNull();
    expect(parseHueParamSingle(["pink", "yellow"])).toBe("pink");
    expect(parseHueParamSingle("notacolor")).toBeNull();
    expect(parseHueParamSingle(undefined)).toBeNull();
  });

  it("falls back to Name A–Z for absent or garbage ?sort=", () => {
    expect(parseSortParam(undefined)).toBe("name");
    expect(parseSortParam("availability")).toBe("availability");
    expect(parseSortParam("recent")).toBe("recent");
    expect(parseSortParam("price")).toBe("name");
    expect(parseSortParam(["recent", "name"])).toBe("recent");
  });

  it("reads the full /variety state and the scoped /search state", () => {
    expect(readBrowseFilters({ season: "cool", color_family: "yellow,white", small_farm: "true", sort: "recent" }, "multi")).toEqual({
      season: "cool",
      method: null,
      lifeCycle: null,
      hue: ["white", "yellow"],
      smallFarm: true,
      sort: "recent",
    });
    // /search: single hue, four groups, sort held at rest even when hand-crafted.
    expect(
      readBrowseFiltersForGroups(
        { season: "cool", color_family: "yellow,white", small_farm: "true", sort: "recent" },
        ["season", "method", "lifeCycle", "hue"],
        "single",
      ),
    ).toEqual({ season: "cool", method: null, lifeCycle: null, hue: [], smallFarm: false, sort: "name" });
    expect(
      readBrowseFiltersForGroups({ color_family: "yellow" }, ["season", "method", "lifeCycle", "hue"], "single"),
    ).toMatchObject({ hue: ["yellow"] });
  });

  it("mirrors parsing from a live location.search string", () => {
    expect(browseFiltersFromSearch("?season=warm&color_family=pink&sort=recent", "multi")).toEqual({
      season: "warm",
      method: null,
      lifeCycle: null,
      hue: ["pink"],
      smallFarm: false,
      sort: "recent",
    });
  });
});

describe("transitions", () => {
  it("toggles hue families independently, keeping vocabulary order", () => {
    const one = toggleHue(REST, "yellow");
    expect(one.hue).toEqual(["yellow"]);
    const two = toggleHue(one, "white");
    expect(two.hue).toEqual(["white", "yellow"]);
    expect(toggleHue(two, "yellow").hue).toEqual(["white"]);
    expect(toggleHue(two, "pink").hue).toEqual(["white", "pink", "yellow"]);
  });

  it("clears all groups but keeps the shopper's sort", () => {
    const state: BrowseFilterState = { season: "cool", method: null, lifeCycle: null, hue: ["pink"], smallFarm: true, sort: "recent" };
    expect(clearAllFilters(state)).toEqual({ season: null, method: null, lifeCycle: null, hue: [], smallFarm: false, sort: "recent" });
  });

  it("assigns single-selects and removes hues idempotently", () => {
    expect(withGroup(REST, "season", "cool")).toMatchObject({ season: "cool" });
    expect(withGroup(REST, "hue", "pink")).toMatchObject({ hue: ["pink"] });
    expect(withGroup({ ...REST, season: "cool" }, "season", null)).toMatchObject({ season: null });
    expect(removeHue({ ...REST, hue: ["pink", "yellow"] }, "pink").hue).toEqual(["yellow"]);
    expect(removeHue(REST, "pink")).toBe(REST);
    expect(clearGroup({ ...REST, hue: ["pink"] }, "hue")).toMatchObject({ hue: [] });
  });

  it("compares states structurally (hue as a set) and reports active groups", () => {
    expect(equalBrowseFilters(REST, { ...REST })).toBe(true);
    expect(equalBrowseFilters({ ...REST, hue: ["pink", "yellow"] }, { ...REST, hue: ["yellow", "pink"] })).toBe(true);
    expect(equalBrowseFilters(REST, { ...REST, sort: "recent" })).toBe(false);
    expect(hasActiveFilters(REST)).toBe(false);
    expect(hasActiveFilters({ ...REST, sort: "recent" })).toBe(false);
    expect(hasActiveFilters({ ...REST, hue: ["pink"] })).toBe(true);
    expect(isGroupActive(REST, "hue")).toBe(false);
    expect(isGroupActive({ ...REST, hue: ["pink"] }, "hue")).toBe(true);
    expect(isOptionActive({ ...REST, hue: ["pink"] }, "hue", "pink", "multi")).toBe(true);
    expect(isOptionActive({ ...REST, hue: ["pink"] }, "hue", null, "multi")).toBe(false);
    expect(isOptionActive(REST, "hue", null, "multi")).toBe(true);
  });
});

describe("URLs", () => {
  it("serializes only active groups plus a non-resting sort", () => {
    expect(filterParams(REST)).toEqual({});
    expect(filterParams({ ...REST, season: "cool", hue: ["white", "yellow"], sort: "recent" })).toEqual({
      season: "cool",
      color_family: "white,yellow",
      sort: "recent",
    });
    expect(filterParams({ ...REST, smallFarm: true })).toEqual({ small_farm: "true" });
  });

  it("drops ?page= on filter links and keeps extras (q on /search)", () => {
    expect(browseHref("/variety", { ...REST, season: "cool" }, { page: "3" })).toBe("/variety?season=cool");
    expect(browseHref("/search", { ...REST, season: "cool" }, { q: "pea" })).toBe("/search?q=pea&season=cool");
    expect(browseHref("/variety", REST)).toBe("/variety");
  });

  it("links chips to the toggled/assigned state", () => {
    expect(chipHref("/variety", REST, "hue", "yellow", {}, "multi")).toBe("/variety?color_family=yellow");
    expect(chipHref("/variety", { ...REST, hue: ["yellow"] }, "hue", "white", {}, "multi")).toBe(
      "/variety?color_family=white%2Cyellow",
    );
    expect(chipHref("/variety", { ...REST, hue: ["yellow"] }, "hue", "yellow", {}, "multi")).toBe("/variety");
    expect(chipHref("/variety", REST, "season", "cool", {}, "multi")).toBe("/variety?season=cool");
    expect(chipHref("/search", REST, "hue", "pink", { q: "pea" }, "single")).toBe("/search?q=pea&color_family=pink");
  });
});

describe("labels, count lines, titles, removers", () => {
  it("labels active filters in group order", () => {
    expect(activeFilterLabels(REST)).toEqual([]);
    expect(
      activeFilterLabels({ season: "cool", method: "trays", lifeCycle: null, hue: ["white", "yellow"], smallFarm: true, sort: "name" }),
    ).toEqual(["Cool Season Hardy Annuals", "Start indoors", "White", "Yellow", "Small farms"]);
  });

  it("words the count line with the sort's ordering phrase and the page echo", () => {
    expect(browseCountLine(REST, 55, 1, 3)).toBe("55 varieties, alphabetical. Page 1 of 3.");
    expect(browseCountLine({ ...REST, sort: "availability" }, 55, 1, 3)).toBe("55 varieties, most sellers first. Page 1 of 3.");
    expect(browseCountLine({ ...REST, hue: ["yellow"] }, 16, 1, 1)).toBe("16 varieties · Yellow, alphabetical.");
    expect(browseCountLine({ ...REST, lifeCycle: "biennial" }, 0, 1, 1)).toBe("0 varieties · Biennial, alphabetical.");
  });

  it("titles the unfiltered list at rest and filtered states by their labels (sort never appears)", () => {
    expect(varietyBrowseTitle(REST, 1)).toBe("All flower seed varieties");
    expect(varietyBrowseTitle(REST, 2)).toBe("All flower seed varieties — page 2");
    expect(varietyBrowseTitle({ ...REST, hue: ["yellow"], sort: "recent" }, 1)).toBe("Yellow — flower seed varieties");
    expect(varietyBrowseTitle({ ...REST, season: "cool", hue: ["yellow"] }, 1)).toBe(
      "Cool Season Hardy Annuals · Yellow — flower seed varieties",
    );
  });

  it("emits one remover per active group (one per hue family) with the shipped wording", () => {
    expect(removersFor(REST)).toEqual([]);
    const removers = removersFor({ ...REST, season: "cool", hue: ["white", "yellow"], smallFarm: true });
    expect(removers.map((r) => [r.key, r.label, r.removeLabel])).toEqual([
      ["season", "Season: Cool Season Hardy Annuals", "Remove the Season filter, Cool Season Hardy Annuals"],
      ["hue:white", "Hue: White", "Remove the Hue filter, White"],
      ["hue:yellow", "Hue: Yellow", "Remove the Hue filter, Yellow"],
      ["smallFarm", "Sellers: Small farms", "Remove the Sellers filter, Small farms"],
    ]);
    expect(removers[1]!.clear({ ...REST, hue: ["white", "yellow"] }).hue).toEqual(["yellow"]);
  });

  it("renders thirteen hue chips plus All (the vocabulary, pinned)", () => {
    expect(BROWSE_OPTIONS.hue.options.map((o) => o.value)).toEqual([
      null,
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
    ]);
    expect(BROWSE_OPTIONS.smallFarm.legend).toBe("Sellers");
  });
});

describe("the count matrix", () => {
  const counts = {
    season: { all: 55, options: { cool: 28, warm: 27 } },
    method: { all: 55, options: { direct: 55, trays: 28 } },
    lifeCycle: { all: 55, options: { annual: 30, biennial: 0, perennial: 25 } },
    hue: {
      all: 55,
      options: {
        white: 17,
        blush: 0,
        pink: 22,
        peach: 0,
        orange: 0,
        yellow: 16,
        red: 0,
        burgundy: 0,
        purple: 0,
        blue: 0,
        green: 0,
        chocolate: 0,
        mix: 0,
      },
    },
    smallFarm: { all: 55, on: 7 },
  };

  it("reads every chip's count (All cells and options, zero kept)", () => {
    expect(countFor(counts, "season", null)).toBe(55);
    expect(countFor(counts, "season", "cool")).toBe(28);
    expect(countFor(counts, "hue", "yellow")).toBe(16);
    expect(countFor(counts, "hue", "blush")).toBe(0);
    expect(countFor(counts, "smallFarm", "true")).toBe(7);
  });

  it("maps chips to the state each count totals (All clears, singles assign, multi hue toggles)", () => {
    expect(countStateFor({ ...REST, season: "cool" }, "season", null, "multi")).toMatchObject({ season: null });
    expect(countStateFor(REST, "season", "cool", "multi")).toMatchObject({ season: "cool" });
    expect(countStateFor({ ...REST, hue: ["yellow"] }, "hue", "white", "multi").hue).toEqual(["white", "yellow"]);
    expect(countStateFor({ ...REST, hue: ["yellow"] }, "hue", "yellow", "multi").hue).toEqual([]);
    expect(countStateFor(REST, "hue", "pink", "single").hue).toEqual(["pink"]);
  });

  it("emits every rendered chip's state, All first per group", () => {
    const states = browseCountStates(REST, ["season", "hue"], "multi");
    expect(states).toHaveLength(3 + 14);
    expect(states[0]).toMatchObject({ group: "season", option: null });
    expect(states[3]).toMatchObject({ group: "hue", option: null });
    expect(states.map((s) => s.option).filter((o) => o !== null)).toContain("yellow");
  });
});
