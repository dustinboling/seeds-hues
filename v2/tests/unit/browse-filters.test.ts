/**
 * Tranche 3.1a — the browse-filter model (lib/browse.ts): vocabulary, state transitions, URL
 * encoding, count matrix, removers, and the schemas' mirror of the vocabulary; plus the
 * FilterStrip A3 finish pins and the BrowseFilters server-render contract (single-select
 * surfaces unchanged, /variety multi-hue with counts).
 *
 * Every expectation derives from the vocabulary (COLOR_FAMILIES, SEASON_PARAMS, ...) or from
 * the test's own inputs — no hardcoded catalog counts. Rendered with renderToStaticMarkup
 * (the no-JS floor); the hydrated layer is covered in tests/dom/variety-browse.test.tsx.
 *
 * Non-vacuity: this file fails on pre-build code — lib/browse.ts does not exist there, Hue is
 * single-select (parseHueParam returns one family or null, toggleHue/clearGroup(matrix)/the
 * count matrix are absent), BrowseFilters takes no hueMode/counts, and FilterStrip carries
 * px-1/h-10 with no scroll-padding.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BROWSE_OPTIONS,
  COLOR_FAMILIES,
  COLOR_FAMILY_LABELS,
  COLOR_FAMILY_SWATCHES,
  LIFE_CYCLE_LABELS,
  LIFE_CYCLE_PARAMS,
  METHOD_PARAMS,
  SEASON_LABELS,
  SEASON_PARAMS,
  SOWING_METHOD_LABELS,
  activeFilterLabels,
  browseCountLine,
  browseCountQueries,
  browseFiltersFromSearch,
  browseHref,
  browsePageFromSearch,
  chipHref,
  clearAllFilters,
  clearGroup,
  countFor,
  equalBrowseFilters,
  filterParams,
  hasActiveFilters,
  isGroupActive,
  isOptionActive,
  readBrowseFilters,
  removeHue,
  removersFor,
  toggleHue,
  varietyFiltersFromBrowse,
  withGroup,
  type BrowseFilterState,
  type ColorFamily,
} from "@/lib/browse";
import { BrowseCountsSchema, type BrowseCounts } from "@/lib/validators";
import * as V from "@/lib/validators";
import { BrowseFilters } from "@/components/ui/BrowseFilters";

const state = (over: Partial<BrowseFilterState> = {}): BrowseFilterState => ({
  season: null,
  method: null,
  lifeCycle: null,
  hue: [],
  smallFarm: false,
  sort: "name",
  ...over,
});

describe("vocabulary (lib/browse.ts is the home; validators re-exports it)", () => {
  it("re-exports the identical references (one vocabulary, no copies to drift)", () => {
    expect(V.SEASON_PARAMS).toBe(SEASON_PARAMS);
    expect(V.SEASON_LABELS).toBe(SEASON_LABELS);
    expect(V.METHOD_PARAMS).toBe(METHOD_PARAMS);
    expect(V.SOWING_METHOD_LABELS).toBe(SOWING_METHOD_LABELS);
    expect(V.LIFE_CYCLE_PARAMS).toBe(LIFE_CYCLE_PARAMS);
    expect(V.LIFE_CYCLE_LABELS).toBe(LIFE_CYCLE_LABELS);
    expect(V.COLOR_FAMILIES).toBe(COLOR_FAMILIES);
    expect(V.COLOR_FAMILY_LABELS).toBe(COLOR_FAMILY_LABELS);
    expect(V.COLOR_FAMILY_SWATCHES).toBe(COLOR_FAMILY_SWATCHES);
  });

  it("covers every family with a swatch entry and a label", () => {
    for (const f of COLOR_FAMILIES) {
      expect(COLOR_FAMILY_LABELS[f].length).toBeGreaterThan(0);
      expect(f in V.COLOR_FAMILY_SWATCHES).toBe(true);
    }
  });
});

describe("readBrowseFilters (page query → state)", () => {
  it("reads every group in multi mode (the /variety rule)", () => {
    const s = readBrowseFilters(
      { season: "cool", method: "trays", life_cycle: "perennial", color_family: "peach,pink", small_farm: "true" },
      "multi",
    );
    expect(s).toEqual({ season: "cool", method: "trays", lifeCycle: "perennial", hue: ["pink", "peach"], smallFarm: true, sort: "name" });
  });

  it("reads a single hue in single mode (the /search rule — comma lists are All)", () => {
    expect(readBrowseFilters({ color_family: "pink" }, "single").hue).toEqual(["pink"]);
    expect(readBrowseFilters({ color_family: "pink,peach" }, "single").hue).toEqual([]);
    expect(readBrowseFilters({}, "single")).toEqual(clearAllFilters());
  });

  it("ignores garbage in every group (forgiving parse, never a 404)", () => {
    expect(readBrowseFilters({ season: "bogus", method: "bogus", life_cycle: "bogus", color_family: "bogus", small_farm: "yes" }, "multi")).toEqual(
      clearAllFilters(),
    );
  });
});

describe("hue transitions (PB-2 multi-select)", () => {
  it("toggles families into and out of the set, canonical order kept", () => {
    const s0 = state();
    const s1 = toggleHue(s0, "peach");
    expect(s1.hue).toEqual(["peach"]);
    const s2 = toggleHue(s1, "pink");
    expect(s2.hue).toEqual(["pink", "peach"]);
    expect(toggleHue(s2, "pink").hue).toEqual(["peach"]);
    expect(toggleHue(s2, "peach").hue).toEqual(["pink"]);
    // The input state is never mutated.
    expect(s0.hue).toEqual([]);
    expect(s1.hue).toEqual(["peach"]);
  });

  it("removeHue is idempotent; withGroup on hue sets a one-element set (single surfaces)", () => {
    const s = state({ hue: ["pink"] });
    expect(removeHue(s, "pink").hue).toEqual([]);
    expect(removeHue(s, "pink")).not.toBe(s);
    expect(removeHue(removeHue(s, "pink"), "pink").hue).toEqual([]);
    expect(withGroup(state(), "hue", "pink").hue).toEqual(["pink"]);
    expect(withGroup(s, "hue", null).hue).toEqual([]);
  });

  it("clearGroup clears one group; clearAllFilters clears everything", () => {
    const s = state({ season: "cool", hue: ["pink", "peach"], smallFarm: true });
    expect(clearGroup(s, "hue")).toEqual({ ...s, hue: [] });
    expect(clearGroup(s, "season").season).toBeNull();
    expect(clearGroup(s, "smallFarm").smallFarm).toBe(false);
    expect(clearAllFilters()).toEqual(state());
  });
});

describe("state predicates", () => {
  it("isGroupActive / hasActiveFilters see every group (hue needs a non-empty set)", () => {
    expect(hasActiveFilters(state())).toBe(false);
    expect(hasActiveFilters(state({ hue: ["pink"] }))).toBe(true);
    expect(isGroupActive(state({ hue: ["pink"] }), "hue")).toBe(true);
    expect(isGroupActive(state(), "hue")).toBe(false);
    expect(isGroupActive(state({ smallFarm: true }), "smallFarm")).toBe(true);
    expect(isGroupActive(state({ season: "cool" }), "season")).toBe(true);
  });

  it("equalBrowseFilters compares hue as a set (order never distinguishes states)", () => {
    expect(equalBrowseFilters(state({ hue: ["pink", "peach"] }), state({ hue: ["peach", "pink"] }))).toBe(true);
    expect(equalBrowseFilters(state({ hue: ["pink"] }), state({ hue: ["pink", "peach"] }))).toBe(false);
    expect(equalBrowseFilters(state({ season: "cool" }), state({ season: "warm" }))).toBe(false);
    expect(equalBrowseFilters(state(), clearAllFilters())).toBe(true);
  });

  it("isOptionActive: single equality, multi membership, All on the empty set", () => {
    expect(isOptionActive(state({ season: "cool" }), "season", "cool", "single")).toBe(true);
    expect(isOptionActive(state({ season: "cool" }), "season", null, "single")).toBe(false);
    expect(isOptionActive(state(), "season", null, "single")).toBe(true);
    expect(isOptionActive(state({ hue: ["pink"] }), "hue", "pink", "single")).toBe(true);
    expect(isOptionActive(state({ hue: ["pink"] }), "hue", null, "single")).toBe(false);
    expect(isOptionActive(state({ hue: ["pink", "peach"] }), "hue", "pink", "multi")).toBe(true);
    expect(isOptionActive(state({ hue: ["pink", "peach"] }), "hue", "peach", "multi")).toBe(true);
    expect(isOptionActive(state({ hue: ["pink", "peach"] }), "hue", "yellow", "multi")).toBe(false);
    expect(isOptionActive(state({ hue: ["pink"] }), "hue", null, "multi")).toBe(false);
    expect(isOptionActive(state(), "hue", null, "multi")).toBe(true);
    expect(isOptionActive(state({ smallFarm: true }), "smallFarm", "true", "single")).toBe(true);
    expect(isOptionActive(state(), "smallFarm", null, "single")).toBe(true);
  });
});

describe("URL encoding (the color_family name is unchanged; the set is a comma list)", () => {
  it("filterParams carries only active groups (hue joined, smallFarm as true)", () => {
    expect(filterParams(state())).toEqual({});
    expect(filterParams(state({ season: "cool", hue: ["pink", "peach"], smallFarm: true }))).toEqual({
      season: "cool",
      color_family: "pink,peach",
      small_farm: "true",
    });
    // One hue serializes exactly as the old single value — other surfaces' hrefs are unchanged.
    expect(filterParams(state({ hue: ["pink"] }))).toEqual({ color_family: "pink" });
  });

  it("browseHref drops ?page= and keeps the extras (q on /search)", () => {
    expect(browseHref("/variety", state())).toBe("/variety");
    expect(browseHref("/variety", state({ season: "cool" }), { page: "3" })).toBe("/variety?season=cool");
    expect(browseHref("/search", state({ hue: ["pink"] }), { q: "cosmos", page: "2" })).toBe("/search?q=cosmos&color_family=pink");
  });

  it("chipHref assigns on single groups and toggles on multi hue", () => {
    const s = state({ season: "cool" });
    expect(chipHref("/variety", s, "method", "direct", {}, "multi")).toBe("/variety?season=cool&method=direct");
    expect(chipHref("/variety", s, "season", null, {}, "multi")).toBe("/variety");
    // Multi hue: the family toggles; All clears the set.
    expect(chipHref("/variety", s, "hue", "pink", {}, "multi")).toBe("/variety?season=cool&color_family=pink");
    expect(chipHref("/variety", state({ hue: ["pink", "peach"] }), "hue", "pink", {}, "multi")).toBe("/variety?color_family=peach");
    expect(chipHref("/variety", state({ hue: ["pink", "peach"] }), "hue", null, {}, "multi")).toBe("/variety");
    // Single hue: the value assigns (today's /search behavior exactly).
    expect(chipHref("/search", state({ hue: ["pink"] }), "hue", "peach", { q: "x" }, "single")).toBe(
      "/search?q=x&color_family=peach",
    );
  });

  it("client mirrors re-read the same state from a live search string", () => {
    const sp = { season: "warm", color_family: "peach,pink", small_farm: "true" };
    expect(browseFiltersFromSearch("?season=warm&color_family=peach%2Cpink&small_farm=true", "multi")).toEqual(
      readBrowseFilters(sp, "multi"),
    );
    expect(browseFiltersFromSearch("season=warm&color_family=pink", "single").hue).toEqual(["pink"]);
    expect(browsePageFromSearch("?page=3")).toBe(3);
    expect(browsePageFromSearch("")).toBe(1);
    expect(browsePageFromSearch("?page=bogus")).toBe(1);
  });
});

describe("labels and the count line", () => {
  it("activeFilterLabels joins every group in order (one label per hue)", () => {
    expect(activeFilterLabels(state())).toEqual([]);
    expect(
      activeFilterLabels(state({ season: "cool", method: "direct", lifeCycle: "annual", hue: ["pink", "peach"], smallFarm: true })),
    ).toEqual([
      SEASON_LABELS[SEASON_PARAMS.cool],
      SOWING_METHOD_LABELS[METHOD_PARAMS.direct],
      LIFE_CYCLE_LABELS.annual,
      COLOR_FAMILY_LABELS.pink,
      COLOR_FAMILY_LABELS.peach,
      "Small farms",
    ]);
  });

  it("browseCountLine words the line exactly as the server page always did", () => {
    expect(browseCountLine(state(), 48, 1, 2)).toBe("48 varieties, alphabetical. Page 1 of 2.");
    expect(browseCountLine(state(), 1, 1, 1)).toBe("1 variety, alphabetical.");
    expect(browseCountLine(state(), 0, 1, 1)).toBe("0 varieties, alphabetical.");
    expect(browseCountLine(state({ hue: ["pink", "peach"] }), 12, 1, 1)).toBe("12 varieties · Pink · Peach, alphabetical.");
  });
});

describe("browseCountQueries (the per-option count matrix)", () => {
  const s = state({ season: "cool", hue: ["pink", "peach"], smallFarm: true });

  it("emits every chip exactly once: All plus every option per group", () => {
    const q = browseCountQueries(s);
    const per = (group: string) => q.filter((x) => x.group === group);
    expect(per("season")).toHaveLength(Object.keys(SEASON_PARAMS).length + 1);
    expect(per("method")).toHaveLength(Object.keys(METHOD_PARAMS).length + 1);
    expect(per("lifeCycle")).toHaveLength(LIFE_CYCLE_PARAMS.length + 1);
    expect(per("hue")).toHaveLength(COLOR_FAMILIES.length + 1);
    expect(per("smallFarm")).toHaveLength(2);
    for (const g of ["season", "method", "lifeCycle", "hue", "smallFarm"]) {
      expect(per(g).filter((x) => x.option === null)).toHaveLength(1);
    }
    expect(q).toHaveLength(
      Object.keys(SEASON_PARAMS).length + Object.keys(METHOD_PARAMS).length + LIFE_CYCLE_PARAMS.length + COLOR_FAMILIES.length + 1 + 5,
    );
  });

  it("single-select All clears its group and holds the others; options assign", () => {
    const q = browseCountQueries(s);
    const one = (group: string, option: string | null) => q.find((x) => x.group === group && x.option === option)?.filters;
    expect(one("season", null)).toMatchObject({ season: undefined, smallFarmOnly: true });
    expect(one("season", null)?.colorFamily).toEqual(["pink", "peach"]);
    expect(one("season", "warm")?.season).toEqual([SEASON_PARAMS.warm]);
    expect(one("method", "direct")?.methods).toEqual([METHOD_PARAMS.direct]);
    expect(one("lifeCycle", "annual")?.lifeCycle).toEqual(["annual"]);
    expect(one("smallFarm", null)?.smallFarmOnly).toBeUndefined();
    expect(one("smallFarm", "true")?.smallFarmOnly).toBe(true);
    // The active option's query equals the unmodified state (its count is the total).
    expect(one("season", "cool")).toEqual(varietyFiltersFromBrowse(s));
  });

  it("hue All clears the set; each family toggles from its current state, others held", () => {
    const q = browseCountQueries(s);
    const one = (option: string | null) => q.find((x) => x.group === "hue" && x.option === option)?.filters;
    const all = one(null);
    expect(all?.colorFamily).toBeUndefined();
    expect(all?.season).toEqual([SEASON_PARAMS.cool]);
    expect(all?.smallFarmOnly).toBe(true);
    // Selected peach toggles OUT; unselected yellow toggles IN.
    expect(one("peach")?.colorFamily).toEqual(["pink"]);
    expect(one("pink")?.colorFamily).toEqual(["peach"]);
    expect(one("yellow")?.colorFamily).toEqual(["pink", "peach", "yellow"]);
    for (const f of COLOR_FAMILIES) {
      expect(one(f)?.season, f).toEqual([SEASON_PARAMS.cool]);
      expect(one(f)?.smallFarmOnly, f).toBe(true);
    }
  });
});

describe("removersFor (the applied row)", () => {
  it("emits one remover per active group — one per hue — with clearing transitions", () => {
    const s = state({ season: "cool", hue: ["pink", "peach"], smallFarm: true });
    const r = removersFor(s);
    expect(r.map((x) => x.key)).toEqual(["season", "hue:pink", "hue:peach", "smallFarm"]);
    expect(r.map((x) => x.label)).toEqual([
      `Season: ${SEASON_LABELS[SEASON_PARAMS.cool]}`,
      `Hue: ${COLOR_FAMILY_LABELS.pink}`,
      `Hue: ${COLOR_FAMILY_LABELS.peach}`,
      "Sellers: Small farms",
    ]);
    expect(r.map((x) => x.removeLabel)).toEqual([
      `Remove the Season filter, ${SEASON_LABELS[SEASON_PARAMS.cool]}`,
      `Remove the Hue filter, ${COLOR_FAMILY_LABELS.pink}`,
      `Remove the Hue filter, ${COLOR_FAMILY_LABELS.peach}`,
      "Remove the Sellers filter, Small farms",
    ]);
    expect(r[0]!.clear(s)).toEqual({ ...s, season: null });
    expect(r[1]!.clear(s).hue).toEqual(["peach"]);
    expect(r[2]!.clear(s).hue).toEqual(["pink"]);
    expect(r[3]!.clear(s).smallFarm).toBe(false);
    expect(removersFor(state())).toEqual([]);
  });
});

describe("BrowseCountsSchema (the counts contract mirrors the vocabulary)", () => {
  it("requires every All and every option key — nothing missing, nothing extra", () => {
    const shape = BrowseCountsSchema.shape;
    expect(Object.keys(shape)).toEqual(["season", "method", "lifeCycle", "hue", "smallFarm"]);
    expect(Object.keys(shape.season.shape.options.shape).sort()).toEqual(Object.keys(SEASON_PARAMS).sort());
    expect(Object.keys(shape.method.shape.options.shape).sort()).toEqual(Object.keys(METHOD_PARAMS).sort());
    expect(Object.keys(shape.lifeCycle.shape.options.shape).sort()).toEqual([...LIFE_CYCLE_PARAMS].sort());
    expect(Object.keys(shape.hue.shape.options.shape).sort()).toEqual([...COLOR_FAMILIES].sort());
    expect(Object.keys(shape.smallFarm.shape)).toEqual(["all", "on"]);
  });

  it("rejects a missing option and a negative count", () => {
    const good = Object.fromEntries(
      browseCountQueries(clearAllFilters()).map((q) => [`${q.group}:${q.option ?? "all"}`, 7]),
    );
    const counts: BrowseCounts = {
      season: { all: good["season:all"]!, options: { cool: good["season:cool"]!, warm: good["season:warm"]! } },
      method: { all: good["method:all"]!, options: { direct: good["method:direct"]!, trays: good["method:trays"]! } },
      lifeCycle: {
        all: good["lifeCycle:all"]!,
        options: { annual: good["lifeCycle:annual"]!, biennial: good["lifeCycle:biennial"]!, perennial: good["lifeCycle:perennial"]! },
      },
      hue: {
        all: good["hue:all"]!,
        options: Object.fromEntries(COLOR_FAMILIES.map((f) => [f, good[`hue:${f}`]!])) as Record<ColorFamily, number>,
      },
      smallFarm: { all: good["smallFarm:all"]!, on: 7 },
    };
    expect(BrowseCountsSchema.safeParse(counts).success).toBe(true);
    expect(countFor(counts, "hue", "pink")).toBe(7);
    expect(countFor(counts, "smallFarm", "true")).toBe(7);
    expect(countFor(counts, "season", null)).toBe(7);
    const { pink: _drop, ...rest } = counts.hue.options;
    expect(BrowseCountsSchema.safeParse({ ...counts, hue: { all: 7, options: rest } }).success).toBe(false);
    expect(BrowseCountsSchema.safeParse({ ...counts, season: { all: -1, options: counts.season.options } }).success).toBe(false);
  });
});

describe("FilterStrip A3 finish (SPEC §2.7: the one shared-component change)", () => {
  const src = readFileSync(join(process.cwd(), "components/ui/FilterStrip.tsx"), "utf8");

  it("pads the strip list px-1.5 py-1.5 with 3rem inline scroll padding", () => {
    expect(src).toContain("px-1.5 py-1.5");
    expect(src).toContain("[scroll-padding-inline:3rem]");
  });

  it("sizes both chevron buttons to 44px (h-11 w-11)", () => {
    expect(src).toContain("h-11 w-11");
    expect(src).not.toContain("h-10 w-10");
  });

  it("changes nothing else (shadow token kept, no chip classes leak in)", () => {
    expect(src).toContain("shadow-strip-button");
    for (const chip of ["chip-filter", "chip-tag", "chip-removable"]) {
      expect(src).not.toContain(chip);
    }
  });
});

describe("BrowseFilters server render (links floor)", () => {
  // Rendered through the real component (Link renders an anchor in static markup).
  const html = (props: Parameters<typeof BrowseFilters>[0]) => renderToStaticMarkup(createElement(BrowseFilters, props));

  it("single mode without counts renders today's markup exactly (other surfaces unchanged)", () => {
    const h = html({ basePath: "/search", state: state({ season: "cool", hue: ["pink"] }), groups: ["season", "method", "hue"], params: { q: "cosmos" } });
    // Active chips carry aria-current; nothing carries a count.
    expect(h).toContain('aria-current="true"');
    expect(h).not.toContain("tabular-nums");
    expect(h).not.toMatch(/\(\d+\)/);
    // Hrefs: single-select assignment, q kept, page dropped.
    expect(h).toContain('href="/search?q=cosmos&amp;season=cool&amp;color_family=pink"');
    expect(h).toContain('href="/search?q=cosmos&amp;color_family=pink"');
    expect(h).toContain('href="/search?q=cosmos&amp;season=cool&amp;method=direct&amp;color_family=pink"');
    expect(h).not.toContain("page=");
  });

  it("multi mode with counts renders toggle hrefs and every count incl. 0", () => {
    const counts: BrowseCounts = {
      season: { all: 10, options: { cool: 4, warm: 6 } },
      method: { all: 10, options: { direct: 9, trays: 0 } },
      lifeCycle: { all: 10, options: { annual: 8, biennial: 1, perennial: 1 } },
      hue: { all: 5, options: Object.fromEntries(COLOR_FAMILIES.map((f) => [f, f === "pink" ? 2 : 1])) as Record<ColorFamily, number> },
      smallFarm: { all: 10, on: 3 },
    };
    const h = html({ basePath: "/variety", state: state({ hue: ["pink", "peach"] }), groups: ["method", "hue", "smallFarm"], hueMode: "multi", counts });
    // Toggle hrefs: peach removes itself; yellow joins the set (commas URL-encoded); All clears.
    expect(h).toContain('href="/variety?color_family=pink"');
    expect(h).toContain('href="/variety?color_family=pink%2Cpeach%2Cyellow"');
    expect(h).toContain('href="/variety"');
    // Set members are current; counts render, and the 0-count option keeps its chip.
    expect(h.match(/aria-current="true"/g)).toHaveLength(2 + 1 + 1);
    expect(h).toContain('<span aria-hidden="true">(0)</span><span class="sr-only">0 varieties</span>');
    expect(h).toContain("Start indoors");
    expect(h).toContain('<span aria-hidden="true">(2)</span><span class="sr-only">2 varieties</span>');
  });

  it("keeps the fieldset/legend/strip anatomy and the sellers legend placement", () => {
    const h = html({ basePath: "/variety", state: state(), groups: ["season", "method", "lifeCycle", "hue", "smallFarm"], hueMode: "multi" });
    for (const g of ["season", "method", "lifeCycle", "hue", "smallFarm"] as const) {
      expect(h).toContain(BROWSE_OPTIONS[g].legend);
    }
    expect(h.match(/<fieldset/g)).toHaveLength(5);
    // The Small farm legend sits directly under the Sellers strip (once — never moved/duplicated).
    const sellersAt = h.indexOf(">Sellers</legend>");
    const legendAt = h.indexOf("small family farm");
    expect(sellersAt).toBeGreaterThan(-1);
    expect(legendAt).toBeGreaterThan(sellersAt);
    expect(h.match(/small family farm/g)).toHaveLength(1);
  });
});
