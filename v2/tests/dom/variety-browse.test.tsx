// @vitest-environment jsdom
/**
 * Tranche 3.1a — the /variety in-place layer (components/variety/VarietyBrowse.tsx): the
 * server-rendered links floor (no-JS: every chip a working link), the hydrated buttons with
 * aria-pressed, optimistic select + last-selection-wins commits, exactly one history entry
 * per change, in-place Back/Forward, the §2.5.6 failure path, the applied row + Clear all,
 * zero-results recovery with focus, stable keys (no chip remounts), and pagination left as
 * true navigation. Fetch is stubbed per test; expected strings pin the shipped wording while
 * every total and count derives from the test's own fake payloads.
 *
 * Non-vacuity: fails on pre-build code — VarietyBrowse does not exist there (and Hue is
 * single-select with no counts, no applied row, and no /api/browse/varieties to fetch).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...(rest as Record<string, unknown>) }, children),
}));

import { VarietyBrowse, type VarietyBrowseInitial } from "@/components/variety/VarietyBrowse";
import {
  COLOR_FAMILIES,
  LIFE_CYCLE_PARAMS,
  METHOD_PARAMS,
  SEASON_PARAMS,
  clearAllFilters,
  type BrowseFilterState,
} from "@/lib/browse";
import { totalPages } from "@/lib/paging";
import type { BrowseCounts, BrowseVarietiesPayload, VarietyListItem } from "@/lib/validators";

/** Strict narrowing: throw when a query misses instead of casting a nullable away. */
function need<T>(el: T | null | undefined, what: string): T {
  if (el === null || el === undefined) throw new Error(`variety-browse test: missing ${what}`);
  return el;
}

function item(i: number): VarietyListItem {
  return {
    slug: `test-variety-${i}`,
    varietyName: `Test Variety ${i}`,
    plant: {
      slug: "sweet-pea",
      commonName: "Sweet Pea",
      latinName: "Lathyrus odoratus",
      season_class: null,
      season_source_label: null,
      sowing_methods: [],
      sowing_method_source_label: null,
    },
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: null,
    colorSwatch: null,
    colorFamily: "pink",
    listingCount: 1,
    sellerCount: 1,
    inStockCount: 1,
    lastCheckedAt: "2026-11-15",
    indexable: true,
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    media: [],
  };
}

/** Every cell counts `seed`; tests override individual cells and read them back (derived). */
function fakeCounts(seed: number): BrowseCounts {
  const cell = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, seed]));
  return {
    season: { all: seed, options: cell(Object.keys(SEASON_PARAMS)) as BrowseCounts["season"]["options"] },
    method: { all: seed, options: cell(Object.keys(METHOD_PARAMS)) as BrowseCounts["method"]["options"] },
    lifeCycle: { all: seed, options: cell(LIFE_CYCLE_PARAMS) as BrowseCounts["lifeCycle"]["options"] },
    hue: { all: seed, options: cell(COLOR_FAMILIES) as BrowseCounts["hue"]["options"] },
    smallFarm: { all: seed, on: seed },
  };
}

function makeInitial(over: Partial<VarietyBrowseInitial> = {}): VarietyBrowseInitial {
  return { state: clearAllFilters(), counts: fakeCounts(7), items: [item(0), item(1)], total: 49, page: 1, ...over };
}

function makePayload(over: Partial<VarietyBrowseInitial> = {}): BrowseVarietiesPayload {
  const i = makeInitial(over);
  return { items: i.items, total: i.total, page: 1, pages: totalPages(i.total), counts: i.counts };
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const jsonResponse = (body: unknown, ok = true): Response =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as Response;

let fetchImpl: (url: string) => Promise<Response>;
const fetchMock = () => vi.mocked(fetch);
const fetchUrls = () => fetchMock().mock.calls.map((c) => c[0] as string);

function countLine(): HTMLElement {
  return need(document.getElementById("variety-results-count"), "count line");
}

function resultsRegion(): HTMLElement {
  return need(document.getElementById("variety-results"), "results region");
}

function filtersGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Filters" });
}

function chip(group: string, name: string): HTMLButtonElement {
  return within(screen.getByRole("group", { name: group })).getByRole("button", { name }) as HTMLButtonElement;
}

function pushSpyOn(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(window.history, "pushState");
}

beforeEach(() => {
  window.history.replaceState({}, "", "/variety");
  fetchImpl = async () => {
    throw new Error("fetch not stubbed for this test");
  };
  vi.stubGlobal("fetch", vi.fn((url: string) => fetchImpl(url)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("server floor (no-JS: every chip a working link)", () => {
  const floor = (initial: VarietyBrowseInitial) => renderToStaticMarkup(createElement(VarietyBrowse, { initial }));

  it("renders links with aria-current and counts — and no buttons at all", () => {
    const counts = fakeCounts(7);
    counts.method.options.trays = 0;
    const h = floor(makeInitial({ state: { ...clearAllFilters(), season: "cool" }, counts }));
    expect(h).toContain('aria-current="true"');
    expect(h).not.toContain("aria-pressed");
    expect(h).not.toContain("<button");
    expect(h).toContain("(7)");
    expect(h).toContain("(0)");
    expect(h).toContain('href="/variety?season=cool&amp;method=direct"');
  });

  it("renders the applied row as working links (one remover per hue, Clear all to the bare path)", () => {
    const s: BrowseFilterState = { ...clearAllFilters(), season: "cool", hue: ["pink", "peach"] };
    const h = floor(makeInitial({ state: s }));
    expect(h).toContain("Applied filters");
    expect(h).toContain('aria-label="Remove Cool Season Hardy Annuals"');
    expect(h).toContain('aria-label="Remove Pink"');
    expect(h).toContain('aria-label="Remove Peach"');
    expect(h).toContain("<svg");
    // Peach's remover drops only peach; Clear all drops everything.
    expect(h).toContain('href="/variety?season=cool&amp;color_family=pink"');
    expect(h).toContain('href="/variety"');
    expect(h).toContain(">Clear all</a>");
    // Multi-hue sets serialize once (single comma-encoding, never double).
    expect(h).toContain("color_family=pink%2Cpeach");
    expect(h).not.toContain("%25");
  });

  it("omits the applied row when nothing is active; paginated loads render their page", () => {
    const h = floor(makeInitial());
    expect(h).not.toContain("Applied filters");
    const paged = floor(makeInitial({ page: 3 }));
    expect(paged).toContain("Page 3 of 3.");
    expect(paged).toContain('aria-current="page"');
  });

  it("renders the zero-results state inside the results region with a Clear link", () => {
    const h = floor(makeInitial({ state: { ...clearAllFilters(), season: "cool" }, items: [], total: 0 }));
    expect(h).toContain('id="variety-results"');
    expect(h).toContain("No varieties match.");
    expect(h).toContain('href="/variety">Clear filters</a>');
    expect(h).toContain("Applied filters");
  });
});

describe("hydrated controls (buttons with aria-pressed, stable keys)", () => {
  it("swaps links for toggle buttons; pressed matches state; counts show", () => {
    const counts = fakeCounts(7);
    render(createElement(VarietyBrowse, { initial: makeInitial({ state: { ...clearAllFilters(), hue: ["pink"] }, counts }) }));
    expect(filtersGroup()).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Filters" })).toBeNull();
    expect(chip("Hue", `Pink (${counts.hue.options.pink})`).getAttribute("aria-pressed")).toBe("true");
    expect(chip("Hue", `Peach (${counts.hue.options.peach})`).getAttribute("aria-pressed")).toBe("false");
    expect(chip("Season", `All (${counts.season.all})`).getAttribute("aria-pressed")).toBe("true");
  });

  it("a tap commits in place: optimistic press, one fetch, one entry, swapped rows — no remounts", async () => {
    const next = makePayload({ state: { ...clearAllFilters(), season: "cool" }, items: [item(7)], total: 12 });
    const d = deferred<Response>();
    fetchImpl = () => d.promise;
    const push = pushSpyOn();
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    const countNode = countLine();
    const coolBtn = chip("Season", `Cool Season Hardy Annuals (${before.counts.season.options.cool})`);
    // jsdom clicks don't take focus; take it explicitly so the commit must preserve it.
    coolBtn.focus();

    fireEvent.click(coolBtn);
    // Optimistic: pressed now, fetch in flight with the page dropped; rows and count untouched.
    expect(coolBtn.getAttribute("aria-pressed")).toBe("true");
    expect(fetchUrls()).toEqual(["/api/browse/varieties?season=cool"]);
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3.");
    expect(resultsRegion().textContent).toContain("Test Variety 0");

    d.resolve(jsonResponse(next));
    await waitFor(() => expect(countLine().textContent).toBe("12 varieties · Cool Season Hardy Annuals, alphabetical."));
    expect(resultsRegion().textContent).toContain("Test Variety 7");
    expect(resultsRegion().textContent).not.toContain("Test Variety 0");
    // Exactly one history entry, page reset to 1.
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe("/variety?season=cool");
    expect(window.location.search).toBe("?season=cool");
    // No remounts: the same count node and the same chip button, counts refreshed in place.
    expect(countLine()).toBe(countNode);
    expect(chip("Season", `Cool Season Hardy Annuals (${next.counts.season.options.cool})`)).toBe(coolBtn);
    expect(document.activeElement).toBe(coolBtn);
  });

  it("tapping the active option is a no-op (no fetch, no entry, no change)", () => {
    const push = pushSpyOn();
    render(createElement(VarietyBrowse, { initial: makeInitial() }));
    fireEvent.click(chip("Season", `All (${fakeCounts(7).season.all})`));
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3.");
  });

  it("hue toggles on and off; All clears the set", async () => {
    const s1 = makePayload({ state: { ...clearAllFilters(), hue: ["pink", "peach"] }, items: [item(3)], total: 9 });
    fetchImpl = async () => jsonResponse(s1);
    const push = pushSpyOn();
    const before = makeInitial({ state: { ...clearAllFilters(), hue: ["pink"] } });
    render(createElement(VarietyBrowse, { initial: before }));
    fireEvent.click(chip("Hue", `Peach (${before.counts.hue.options.peach})`));
    await waitFor(() => expect(countLine().textContent).toBe("9 varieties · Pink · Peach, alphabetical."));
    expect(push.mock.calls[0]?.[2]).toBe("/variety?color_family=pink%2Cpeach");

    const s2 = makePayload({ state: clearAllFilters(), items: [item(0)], total: 49 });
    fetchImpl = async () => jsonResponse(s2);
    fireEvent.click(chip("Hue", `All (${s1.counts.hue.all})`));
    await waitFor(() => expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3."));
    expect(push).toHaveBeenCalledTimes(2);
    expect(push.mock.calls[1]?.[2]).toBe("/variety");
  });
});

describe("fetch discipline (last selection wins)", () => {
  it("rapid two-group taps settle on the last: stale success discarded, one entry", async () => {
    const first = makePayload({ state: { ...clearAllFilters(), season: "cool" }, items: [item(7)], total: 12 });
    const last = makePayload({
      state: { ...clearAllFilters(), season: "cool", method: "direct" },
      items: [item(9)],
      total: 5,
    });
    const dA = deferred<Response>();
    const dB = deferred<Response>();
    const queue = [dA.promise, dB.promise];
    fetchImpl = () => need(queue.shift(), "fetch");
    const push = pushSpyOn();
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));

    fireEvent.click(chip("Season", `Cool Season Hardy Annuals (${before.counts.season.options.cool})`));
    fireEvent.click(chip("Sowing method", `Direct Sow (${before.counts.method.options.direct})`));
    expect(fetchUrls()).toEqual(["/api/browse/varieties?season=cool", "/api/browse/varieties?season=cool&method=direct"]);

    // The first response resolves while superseded: discarded whole (no rows, no entry).
    dA.resolve(jsonResponse(first));
    await act(async () => {
      await dA.promise;
    });
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3.");
    expect(push).not.toHaveBeenCalled();

    dB.resolve(jsonResponse(last));
    await waitFor(() => expect(countLine().textContent).toBe("5 varieties · Cool Season Hardy Annuals · Direct Sow, alphabetical."));
    expect(resultsRegion().textContent).toContain("Test Variety 9");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe("/variety?season=cool&method=direct");
  });
});

describe("Back/Forward (in place; pages stay true navigation)", () => {
  const backTo = (search: string) => {
    window.history.replaceState({}, "", `/variety${search}`);
    fireEvent(window, new window.PopStateEvent("popstate"));
  };

  it("restores the popped filter state in place (fetch, no entry)", async () => {
    const filtered = makePayload({ state: { ...clearAllFilters(), season: "cool" }, items: [item(7)], total: 12 });
    fetchImpl = async () => jsonResponse(filtered);
    const push = pushSpyOn();
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    fireEvent.click(chip("Season", `Cool Season Hardy Annuals (${before.counts.season.options.cool})`));
    await waitFor(() => expect(window.location.search).toBe("?season=cool"));

    const restored = makePayload();
    fetchImpl = async () => jsonResponse(restored);
    backTo("");
    await waitFor(() => expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3."));
    expect(resultsRegion().textContent).toContain("Test Variety 0");
    expect(chip("Season", `All (${restored.counts.season.all})`).getAttribute("aria-pressed")).toBe("true");
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("");
  });

  it("a pop to the rendered state fetches nothing", () => {
    render(createElement(VarietyBrowse, { initial: makeInitial() }));
    backTo("");
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3.");
  });

  it("a pop across a page boundary is a true navigation (no in-place fetch)", () => {
    const assign = vi.fn();
    // jsdom seals location.assign: swap window.location itself with the popped URL in place,
    // restoring the original descriptor afterwards.
    const descriptor = Object.getOwnPropertyDescriptor(window, "location");
    Object.defineProperty(window, "location", {
      value: { pathname: "/variety", search: "?page=2", assign },
      configurable: true,
    });
    try {
      render(createElement(VarietyBrowse, { initial: makeInitial() }));
      fireEvent(window, new window.PopStateEvent("popstate"));
      expect(assign).toHaveBeenCalledWith("/variety?page=2");
      expect(fetchMock()).not.toHaveBeenCalled();
    } finally {
      if (descriptor) Object.defineProperty(window, "location", descriptor);
    }
  });

  it("a failed pop keeps the chips on the URL, stands the rows, and alerts", async () => {
    render(createElement(VarietyBrowse, { initial: makeInitial() }));
    fetchImpl = async () => {
      throw new Error("offline");
    };
    backTo("?season=cool");
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
    expect(resultsRegion().textContent).toContain("Test Variety 0");
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3.");
  });
});

describe("failure path (§2.5.6: prior stands, control reverts, one alert)", () => {
  it("a rejected fetch stands results/counts/URL, reverts the press, and alerts once", async () => {
    const push = pushSpyOn();
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    const coolName = `Cool Season Hardy Annuals (${before.counts.season.options.cool})`;
    fetchImpl = async () => {
      throw new Error("offline");
    };
    fireEvent.click(chip("Season", coolName));
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
    expect(screen.getByRole("alert").textContent).toBe("Couldn't update the list — the last results are still shown.");
    // Prior everything stands.
    expect(resultsRegion().textContent).toContain("Test Variety 0");
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3.");
    expect(window.location.search).toBe("");
    expect(push).not.toHaveBeenCalled();
    // The control reverts (same button, All pressed again).
    expect(chip("Season", coolName).getAttribute("aria-pressed")).toBe("false");
    expect(chip("Season", `All (${before.counts.season.all})`).getAttribute("aria-pressed")).toBe("true");

    // The next successful change clears the alert and commits.
    const next = makePayload({ state: { ...clearAllFilters(), season: "cool" }, items: [item(7)], total: 12 });
    fetchImpl = async () => jsonResponse(next);
    fireEvent.click(chip("Season", coolName));
    await waitFor(() => expect(screen.queryAllByRole("alert")).toHaveLength(0));
    expect(countLine().textContent).toBe("12 varieties · Cool Season Hardy Annuals, alphabetical.");
  });

  it("a malformed 200 takes the same failure path", async () => {
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    fetchImpl = async () => jsonResponse({ items: "nope", total: "many" });
    fireEvent.click(chip("Season", `Cool Season Hardy Annuals (${before.counts.season.options.cool})`));
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
    expect(resultsRegion().textContent).toContain("Test Variety 0");
    expect(window.location.search).toBe("");
  });
});

describe("applied row + Clear all (in place)", () => {
  it("carries one remover per hue with Remove names and the drawn glyph", () => {
    const s: BrowseFilterState = { ...clearAllFilters(), hue: ["pink", "peach"] };
    render(createElement(VarietyBrowse, { initial: makeInitial({ state: s }) }));
    const row = screen.getByRole("group", { name: "Applied filters" });
    const pink = within(row).getByRole("button", { name: "Remove Pink" });
    expect(pink.className).toContain("chip-removable");
    expect(need(pink.querySelector("svg"), "remover glyph")).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Remove Peach" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Clear all" })).toBeTruthy();
  });

  it("a remover clears just its entry in one entry; focus moves to Clear all while the row persists", async () => {
    const next = makePayload({ state: { ...clearAllFilters(), hue: ["pink"] }, items: [item(4)], total: 11 });
    fetchImpl = async () => jsonResponse(next);
    const push = pushSpyOn();
    render(createElement(VarietyBrowse, { initial: makeInitial({ state: { ...clearAllFilters(), hue: ["pink", "peach"] } }) }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Peach" }));
    await waitFor(() => expect(countLine().textContent).toBe("11 varieties · Pink, alphabetical."));
    expect(push.mock.calls[0]?.[2]).toBe("/variety?color_family=pink");
    expect(screen.getByRole("button", { name: "Remove Pink" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove Peach" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Clear all" }));
  });

  it("Clear all resets every group in one action, entry and announcement; focus lands on the first All", async () => {
    const next = makePayload({ items: [item(0)], total: 49 });
    fetchImpl = async () => jsonResponse(next);
    const push = pushSpyOn();
    const s: BrowseFilterState = { ...clearAllFilters(), season: "cool", hue: ["pink"] };
    render(createElement(VarietyBrowse, { initial: makeInitial({ state: s, items: [item(7)], total: 12 }) }));
    const announcements: string[] = [];
    const observer = new MutationObserver(() => announcements.push(countLine().textContent ?? ""));
    observer.observe(countLine(), { characterData: true, childList: true, subtree: true });
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3."));
    observer.disconnect();
    expect(fetchUrls()).toEqual(["/api/browse/varieties"]);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe("/variety");
    expect(screen.queryByRole("group", { name: "Applied filters" })).toBeNull();
    // Exactly one count-line change for the whole reset — one announcement.
    expect(announcements).toHaveLength(1);
    expect(document.activeElement).toBe(chip("Season", `All (${next.counts.season.all})`));
  });
});

describe("zero results (recovery + focus)", () => {
  it("empties inside the results region with the row visible; Clear filters recovers in place", async () => {
    const empty = makePayload({ state: { ...clearAllFilters(), hue: ["chocolate"] }, items: [], total: 0 });
    fetchImpl = async () => jsonResponse(empty);
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    fireEvent.click(chip("Hue", `Chocolate (${before.counts.hue.options.chocolate})`));
    await waitFor(() => expect(countLine().textContent).toBe("0 varieties · Chocolate, alphabetical."));
    const region = resultsRegion();
    const emptyState = need(region.querySelector('[data-testid="variety-empty"]'), "empty state");
    expect(emptyState.textContent).toContain("No varieties match.");
    // The applied row stays visible for recovery.
    expect(screen.getByRole("button", { name: "Remove Chocolate" })).toBeTruthy();

    const back = makePayload({ items: [item(0)], total: 49 });
    fetchImpl = async () => jsonResponse(back);
    fireEvent.click(within(emptyState as HTMLElement).getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3."));
    expect(resultsRegion().textContent).toContain("Test Variety 0");
    expect(document.activeElement).toBe(chip("Season", `All (${back.counts.season.all})`));
  });
});

describe("pagination (stays true navigation)", () => {
  it("carries the committed filters and is never intercepted", async () => {
    const next = makePayload({ state: { ...clearAllFilters(), season: "cool" }, items: [item(7)], total: 49 });
    fetchImpl = async () => jsonResponse(next);
    render(createElement(VarietyBrowse, { initial: makeInitial() }));
    const before = makeInitial();
    fireEvent.click(chip("Season", `Cool Season Hardy Annuals (${before.counts.season.options.cool})`));
    await waitFor(() => expect(window.location.search).toBe("?season=cool"));
    const pages = screen.getByRole("navigation", { name: "Varieties pages" });
    const page2 = need(
      within(pages)
        .getAllByRole("link")
        .find((l) => l.getAttribute("href") === "/variety?season=cool&page=2"),
      "page-2 link carrying the committed filters",
    );
    // A page click is the anchor's own business: no fetch, no entry from this layer.
    const calls = fetchMock().mock.calls.length;
    fireEvent.click(page2);
    expect(fetchMock().mock.calls.length).toBe(calls);
  });
});
