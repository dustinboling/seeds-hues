// @vitest-environment jsdom
/**
 * Tranche 3.1a — the /variety in-place layer (components/variety/VarietyBrowse.tsx): the
 * server-rendered links floor (no-JS: every chip a working link), the hydrated buttons with
 * aria-pressed, optimistic select + last-selection-wins commits, exactly one history entry
 * per change, in-place Back/Forward, the §2.5.6 failure path, the applied row + Clear all,
 * zero-results recovery with focus, stable keys (no chip remounts), soft-navigation paging
 * adopting the delivered server snapshot (N-D1), and the in-flight aria-busy on the results
 * region (F6). Fetch is stubbed per test; expected strings pin the shipped wording while
 * every total and count derives from the test's own fake payloads. The F-4 follow-up pins
 * Clear All keeping the active sort in place (entry, fetch, count-line phrase).
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
  BROWSE_SORT_OPTIONS,
  COLOR_FAMILIES,
  LIFE_CYCLE_PARAMS,
  METHOD_PARAMS,
  SEASON_PARAMS,
  type BrowseFilterState,
} from "@/lib/browse";
import { totalPages } from "@/lib/paging";
import type { BrowseCounts, BrowseVarietiesPayload, VarietyListItem } from "@/lib/validators";

/** Strict narrowing: throw when a query misses instead of casting a nullable away. */
function need<T>(el: T | null | undefined, what: string): T {
  if (el === null || el === undefined) throw new Error(`variety-browse test: missing ${what}`);
  return el;
}

/** The resting filter state (Clear All's target at the resting sort). */
function resting(): BrowseFilterState {
  return { season: null, method: null, lifeCycle: null, hue: [], smallFarm: false, sort: "name" };
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
  return { state: resting(), counts: fakeCounts(7), items: [item(0), item(1)], total: 49, page: 1, ...over };
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

function sortChip(name: string): HTMLButtonElement {
  // The hydrated Sort control nests a same-named fieldset in its group, so the label
  // query is ambiguous — the chip's data-sort value is the stable handle.
  const value = BROWSE_SORT_OPTIONS.find((o) => o.label === name)?.value;
  if (!value) throw new Error(`variety-browse test: unknown sort ${name}`);
  return need(document.querySelector(`button[data-sort="${value}"]`), `sort chip ${name}`) as HTMLButtonElement;
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
    const h = floor(makeInitial({ state: { ...resting(), season: "cool" }, counts }));
    expect(h).toContain('aria-current="true"');
    expect(h).not.toContain("aria-pressed");
    expect(h).not.toContain("<button");
    expect(h).toContain('<span aria-hidden="true">(7)</span><span class="sr-only">7 varieties</span>');
    expect(h).toContain('<span aria-hidden="true">(0)</span><span class="sr-only">0 varieties</span>');
    expect(h).toContain('href="/variety?season=cool&amp;method=direct"');
  });

  it("renders the applied row as working links (one remover per hue, Clear all to the bare path)", () => {
    const s: BrowseFilterState = { ...resting(), season: "cool", hue: ["pink", "peach"] };
    const h = floor(makeInitial({ state: s }));
    expect(h).toContain("Applied filters");
    expect(h).toContain('aria-label="Remove the Season filter, Cool Season Hardy Annuals"');
    expect(h).toContain('aria-label="Remove the Hue filter, Pink"');
    expect(h).toContain('aria-label="Remove the Hue filter, Peach"');
    expect(h).toContain(">Hue: Pink<");
    expect(h).toContain("<svg");
    // Peach's remover drops only peach; Clear all drops everything.
    expect(h).toContain('href="/variety?season=cool&amp;color_family=pink"');
    expect(h).toContain('href="/variety"');
    expect(h).toContain(">Clear all filters</a>");
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
    const h = floor(makeInitial({ state: { ...resting(), season: "cool" }, items: [], total: 0 }));
    expect(h).toContain('id="variety-results"');
    expect(h).toContain("No varieties match.");
    expect(h).toContain('href="/variety">Clear filters</a>');
    expect(h).toContain("Applied filters");
  });
});

describe("hydrated controls (buttons with aria-pressed, stable keys)", () => {
  it("swaps links for toggle buttons; pressed matches state; counts show", () => {
    const counts = fakeCounts(7);
    render(createElement(VarietyBrowse, { initial: makeInitial({ state: { ...resting(), hue: ["pink"] }, counts }) }));
    expect(filtersGroup()).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Filters" })).toBeNull();
    expect(chip("Hue", `Pink ${counts.hue.options.pink} varieties`).getAttribute("aria-pressed")).toBe("true");
    expect(chip("Hue", `Peach ${counts.hue.options.peach} varieties`).getAttribute("aria-pressed")).toBe("false");
    expect(chip("Season", `All ${counts.season.all} varieties`).getAttribute("aria-pressed")).toBe("true");
  });

  it("a tap commits in place: optimistic press, one fetch, one entry, swapped rows — no remounts", async () => {
    const next = makePayload({ state: { ...resting(), season: "cool" }, items: [item(7)], total: 12 });
    const d = deferred<Response>();
    fetchImpl = () => d.promise;
    const push = pushSpyOn();
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    const countNode = countLine();
    const coolBtn = chip("Season", `Cool Season Hardy Annuals ${before.counts.season.options.cool} varieties`);
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
    expect(chip("Season", `Cool Season Hardy Annuals ${next.counts.season.options.cool} varieties`)).toBe(coolBtn);
    expect(document.activeElement).toBe(coolBtn);
  });

  it("tapping the active option is a no-op (no fetch, no entry, no change)", () => {
    const push = pushSpyOn();
    render(createElement(VarietyBrowse, { initial: makeInitial() }));
    fireEvent.click(chip("Season", `All ${fakeCounts(7).season.all} varieties`));
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3.");
  });

  it("hue toggles on and off; All clears the set", async () => {
    const s1 = makePayload({ state: { ...resting(), hue: ["pink", "peach"] }, items: [item(3)], total: 9 });
    fetchImpl = async () => jsonResponse(s1);
    const push = pushSpyOn();
    const before = makeInitial({ state: { ...resting(), hue: ["pink"] } });
    render(createElement(VarietyBrowse, { initial: before }));
    fireEvent.click(chip("Hue", `Peach ${before.counts.hue.options.peach} varieties`));
    await waitFor(() => expect(countLine().textContent).toBe("9 varieties · Pink · Peach, alphabetical."));
    expect(push.mock.calls[0]?.[2]).toBe("/variety?color_family=pink%2Cpeach");

    const s2 = makePayload({ state: resting(), items: [item(0)], total: 49 });
    fetchImpl = async () => jsonResponse(s2);
    fireEvent.click(chip("Hue", `All ${s1.counts.hue.all} varieties`));
    await waitFor(() => expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3."));
    expect(push).toHaveBeenCalledTimes(2);
    expect(push.mock.calls[1]?.[2]).toBe("/variety");
  });
});

describe("fetch discipline (last selection wins)", () => {
  it("rapid two-group taps settle on the last: stale success discarded, one entry", async () => {
    const first = makePayload({ state: { ...resting(), season: "cool" }, items: [item(7)], total: 12 });
    const last = makePayload({
      state: { ...resting(), season: "cool", method: "direct" },
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

    fireEvent.click(chip("Season", `Cool Season Hardy Annuals ${before.counts.season.options.cool} varieties`));
    fireEvent.click(chip("Sowing method", `Direct Sow ${before.counts.method.options.direct} varieties`));
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
    const filtered = makePayload({ state: { ...resting(), season: "cool" }, items: [item(7)], total: 12 });
    fetchImpl = async () => jsonResponse(filtered);
    const push = pushSpyOn();
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    fireEvent.click(chip("Season", `Cool Season Hardy Annuals ${before.counts.season.options.cool} varieties`));
    await waitFor(() => expect(window.location.search).toBe("?season=cool"));

    const restored = makePayload();
    fetchImpl = async () => jsonResponse(restored);
    backTo("");
    await waitFor(() => expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3."));
    expect(resultsRegion().textContent).toContain("Test Variety 0");
    expect(chip("Season", `All ${restored.counts.season.all} varieties`).getAttribute("aria-pressed")).toBe("true");
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
    const coolName = `Cool Season Hardy Annuals ${before.counts.season.options.cool} varieties`;
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
    expect(chip("Season", `All ${before.counts.season.all} varieties`).getAttribute("aria-pressed")).toBe("true");

    // The next successful change clears the alert and commits.
    const next = makePayload({ state: { ...resting(), season: "cool" }, items: [item(7)], total: 12 });
    fetchImpl = async () => jsonResponse(next);
    fireEvent.click(chip("Season", coolName));
    await waitFor(() => expect(screen.queryAllByRole("alert")).toHaveLength(0));
    expect(countLine().textContent).toBe("12 varieties · Cool Season Hardy Annuals, alphabetical.");
  });

  it("a malformed 200 takes the same failure path", async () => {
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    fetchImpl = async () => jsonResponse({ items: "nope", total: "many" });
    fireEvent.click(chip("Season", `Cool Season Hardy Annuals ${before.counts.season.options.cool} varieties`));
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
    expect(resultsRegion().textContent).toContain("Test Variety 0");
    expect(window.location.search).toBe("");
  });
});

describe("applied row + Clear all (in place)", () => {
  it("carries one remover per hue with Remove names and the drawn glyph", () => {
    const s: BrowseFilterState = { ...resting(), hue: ["pink", "peach"] };
    render(createElement(VarietyBrowse, { initial: makeInitial({ state: s }) }));
    const row = screen.getByRole("group", { name: "Applied filters" });
    const pink = within(row).getByRole("button", { name: "Remove the Hue filter, Pink" });
    expect(pink.className).toContain("chip-removable");
    expect(pink.textContent).toContain("Hue: Pink");
    expect(need(pink.querySelector("svg"), "remover glyph")).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Remove the Hue filter, Peach" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Clear all filters" })).toBeTruthy();
  });

  it("a remover clears just its entry in one entry; focus moves to Clear all while the row persists", async () => {
    const next = makePayload({ state: { ...resting(), hue: ["pink"] }, items: [item(4)], total: 11 });
    fetchImpl = async () => jsonResponse(next);
    const push = pushSpyOn();
    render(createElement(VarietyBrowse, { initial: makeInitial({ state: { ...resting(), hue: ["pink", "peach"] } }) }));
    fireEvent.click(screen.getByRole("button", { name: "Remove the Hue filter, Peach" }));
    await waitFor(() => expect(countLine().textContent).toBe("11 varieties · Pink, alphabetical."));
    expect(push.mock.calls[0]?.[2]).toBe("/variety?color_family=pink");
    expect(screen.getByRole("button", { name: "Remove the Hue filter, Pink" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove the Hue filter, Peach" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Clear all filters" }));
  });

  it("Clear all resets every group in one action, entry and announcement; focus lands on the first All", async () => {
    const next = makePayload({ items: [item(0)], total: 49 });
    fetchImpl = async () => jsonResponse(next);
    const push = pushSpyOn();
    const s: BrowseFilterState = { ...resting(), season: "cool", hue: ["pink"] };
    render(createElement(VarietyBrowse, { initial: makeInitial({ state: s, items: [item(7)], total: 12 }) }));
    const announcements: string[] = [];
    const observer = new MutationObserver(() => announcements.push(countLine().textContent ?? ""));
    observer.observe(countLine(), { characterData: true, childList: true, subtree: true });
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    await waitFor(() => expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3."));
    observer.disconnect();
    expect(fetchUrls()).toEqual(["/api/browse/varieties"]);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe("/variety");
    expect(screen.queryByRole("group", { name: "Applied filters" })).toBeNull();
    // Exactly one count-line change for the whole reset — one announcement.
    expect(announcements).toHaveLength(1);
    expect(document.activeElement).toBe(chip("Season", `All ${next.counts.season.all} varieties`));
  });

  it("Clear all under an active sort keeps the order: one entry, one fetch, the true phrase", async () => {
    const next = makePayload({ items: [item(0)], total: 49 });
    fetchImpl = async () => jsonResponse(next);
    const push = pushSpyOn();
    const s: BrowseFilterState = { ...resting(), season: "cool", hue: ["pink"], sort: "availability" };
    render(createElement(VarietyBrowse, { initial: makeInitial({ state: s, items: [item(7)], total: 12 }) }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    await waitFor(() => expect(countLine().textContent).toBe("49 varieties, most sellers first. Page 1 of 3."));
    expect(fetchUrls()).toEqual(["/api/browse/varieties?sort=availability"]);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe("/variety?sort=availability");
    expect(screen.queryByRole("group", { name: "Applied filters" })).toBeNull();
    expect(document.activeElement).toBe(chip("Season", `All ${next.counts.season.all} varieties`));
  });
});

describe("zero results (recovery + focus)", () => {
  it("empties inside the results region with the row visible; Clear filters recovers in place", async () => {
    const empty = makePayload({ state: { ...resting(), hue: ["chocolate"] }, items: [], total: 0 });
    fetchImpl = async () => jsonResponse(empty);
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    fireEvent.click(chip("Hue", `Chocolate ${before.counts.hue.options.chocolate} varieties`));
    await waitFor(() => expect(countLine().textContent).toBe("0 varieties · Chocolate, alphabetical."));
    const region = resultsRegion();
    const emptyState = need(region.querySelector('[data-testid="variety-empty"]'), "empty state");
    expect(emptyState.textContent).toContain("No varieties match.");
    // The applied row stays visible for recovery.
    expect(screen.getByRole("button", { name: "Remove the Hue filter, Chocolate" })).toBeTruthy();

    const back = makePayload({ items: [item(0)], total: 49 });
    fetchImpl = async () => jsonResponse(back);
    fireEvent.click(within(emptyState as HTMLElement).getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3."));
    expect(resultsRegion().textContent).toContain("Test Variety 0");
    expect(document.activeElement).toBe(chip("Season", `All ${back.counts.season.all} varieties`));
  });
});

describe("pagination (the layer never intercepts page turns)", () => {
  it("carries the committed filters and is never intercepted", async () => {
    const next = makePayload({ state: { ...resting(), season: "cool" }, items: [item(7)], total: 49 });
    fetchImpl = async () => jsonResponse(next);
    render(createElement(VarietyBrowse, { initial: makeInitial() }));
    const before = makeInitial();
    fireEvent.click(chip("Season", `Cool Season Hardy Annuals ${before.counts.season.options.cool} varieties`));
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

describe("soft-navigation paging (N-D1: the delivered server snapshot commits)", () => {
  it("renders the target page when the router delivers its snapshot (announcement, cards, URL agree)", () => {
    const push = pushSpyOn();
    const { rerender } = render(createElement(VarietyBrowse, { initial: makeInitial() }));
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3.");
    // The router turns the page first (URL + RSC), then delivers the new server snapshot to
    // the still-mounted component: mirror that order — replace the URL, then the prop.
    window.history.replaceState({}, "", "/variety?page=2");
    rerender(createElement(VarietyBrowse, { initial: makeInitial({ items: [item(24), item(25)], page: 2 }) }));
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 2 of 3.");
    expect(resultsRegion().textContent).toContain("Test Variety 24");
    expect(resultsRegion().textContent).not.toContain("Test Variety 0");
    expect(window.location.search).toBe("?page=2");
    // The server snapshot needs no fetch and pushes no entry — its URL is already in the bar.
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    // The adopted page's own pagination is what renders now (page 2 current, neighbours linked).
    const pages = screen.getByRole("navigation", { name: "Varieties pages" });
    const numbered = within(pages)
      .getAllByRole("link")
      .filter((l) => /^Page\s+\d$/.test(l.textContent ?? ""));
    expect(numbered.map((l) => l.getAttribute("href"))).toEqual(["/variety", "/variety?page=3"]);
    expect(need(pages.querySelector('[aria-current="page"]'), "current page").textContent).toContain("2");
  });

  it("a soft navigation wins over an in-flight filter fetch (the stale response is discarded)", async () => {
    const d = deferred<Response>();
    fetchImpl = () => d.promise;
    const before = makeInitial();
    const { rerender } = render(createElement(VarietyBrowse, { initial: before }));
    fireEvent.click(chip("Season", `Cool Season Hardy Annuals ${before.counts.season.options.cool} varieties`));
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    // The page turns while the filter fetch is still in flight.
    window.history.replaceState({}, "", "/variety?page=2");
    rerender(createElement(VarietyBrowse, { initial: makeInitial({ items: [item(24), item(25)], page: 2 }) }));
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 2 of 3.");
    // The stale filter response lands afterwards: discarded whole — the adopted page stands.
    d.resolve(
      jsonResponse(makePayload({ state: { ...resting(), season: "cool" }, items: [item(7)], total: 12 })),
    );
    await act(async () => {
      await d.promise;
    });
    // One macrotask flushes the component's whole continuation (json + settle) inside act, so
    // the assertions below prove the discard instead of racing it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 2 of 3.");
    expect(resultsRegion().textContent).toContain("Test Variety 24");
    expect(resultsRegion().textContent).not.toContain("Test Variety 7");
    expect(window.location.search).toBe("?page=2");
  });

  it("filtering after an adopted page commits from the adopted state (page resets, URL agrees)", async () => {
    const push = pushSpyOn();
    const page2 = makeInitial({
      state: { ...resting(), season: "cool" },
      items: [item(30)],
      total: 30,
      page: 2,
    });
    const { rerender } = render(createElement(VarietyBrowse, { initial: makeInitial() }));
    window.history.replaceState({}, "", "/variety?season=cool&page=2");
    rerender(createElement(VarietyBrowse, { initial: page2 }));
    expect(countLine().textContent).toBe("30 varieties · Cool Season Hardy Annuals, alphabetical. Page 2 of 2.");
    // A chip tap now composes onto the ADOPTED filters (not the stale page-1 state).
    const next = makePayload({
      state: { ...resting(), season: "cool", method: "direct" },
      items: [item(7)],
      total: 12,
    });
    fetchImpl = async () => jsonResponse(next);
    fireEvent.click(chip("Sowing method", `Direct Sow ${page2.counts.method.options.direct} varieties`));
    expect(fetchUrls()).toEqual(["/api/browse/varieties?season=cool&method=direct"]);
    await waitFor(() =>
      expect(countLine().textContent).toBe("12 varieties · Cool Season Hardy Annuals · Direct Sow, alphabetical."),
    );
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe("/variety?season=cool&method=direct");
    expect(window.location.search).toBe("?season=cool&method=direct");
  });

  it("pages a filtered set in both directions (adoption carries the committed filters)", async () => {
    const filtered = makePayload({ state: { ...resting(), hue: ["pink"] }, items: [item(7)], total: 49 });
    fetchImpl = async () => jsonResponse(filtered);
    const before = makeInitial();
    const { rerender } = render(createElement(VarietyBrowse, { initial: before }));
    fireEvent.click(chip("Hue", `Pink ${before.counts.hue.options.pink} varieties`));
    await waitFor(() => expect(window.location.search).toBe("?color_family=pink"));
    // Next → the server snapshot for filtered page 2 commits in place of the fetch snapshot.
    window.history.replaceState({}, "", "/variety?color_family=pink&page=2");
    rerender(
      createElement(VarietyBrowse, {
        initial: makeInitial({ state: { ...resting(), hue: ["pink"] }, items: [item(40)], total: 98, page: 2 }),
      }),
    );
    expect(countLine().textContent).toBe("98 varieties · Pink, alphabetical. Page 2 of 5.");
    expect(resultsRegion().textContent).toContain("Test Variety 40");
    // ← Previous: back to filtered page 1.
    window.history.replaceState({}, "", "/variety?color_family=pink");
    rerender(
      createElement(VarietyBrowse, {
        initial: makeInitial({ state: { ...resting(), hue: ["pink"] }, items: [item(7)], total: 98, page: 1 }),
      }),
    );
    expect(countLine().textContent).toBe("98 varieties · Pink, alphabetical. Page 1 of 5.");
    expect(resultsRegion().textContent).toContain("Test Variety 7");
  });
});

describe("pending indication (F6: aria-busy on the results region during flight)", () => {
  it("marks the results region busy in flight and clears it on settle (settled markup unchanged)", async () => {
    const next = makePayload({ state: { ...resting(), season: "cool" }, items: [item(7)], total: 12 });
    const d = deferred<Response>();
    fetchImpl = () => d.promise;
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    expect(resultsRegion().hasAttribute("aria-busy")).toBe(false);
    fireEvent.click(chip("Season", `Cool Season Hardy Annuals ${before.counts.season.options.cool} varieties`));
    expect(resultsRegion().getAttribute("aria-busy")).toBe("true");
    d.resolve(jsonResponse(next));
    await waitFor(() => expect(countLine().textContent).toBe("12 varieties · Cool Season Hardy Annuals, alphabetical."));
    expect(resultsRegion().hasAttribute("aria-busy")).toBe(false);
  });

  it("clears the busy indication when the flight fails", async () => {
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    fetchImpl = async () => {
      throw new Error("offline");
    };
    fireEvent.click(chip("Season", `Cool Season Hardy Annuals ${before.counts.season.options.cool} varieties`));
    expect(resultsRegion().getAttribute("aria-busy")).toBe("true");
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
    expect(resultsRegion().hasAttribute("aria-busy")).toBe(false);
  });
});

describe("document title sync (B-1 item 3: the committed state's server title, once, with the swap)", () => {
  it("Clear All sets document.title to the resting title (the cleared filter's name disappears)", async () => {
    document.title = "Cool Season Hardy Annuals — flower seed varieties | seeds.hues.flowers";
    const next = makePayload({ items: [item(0)], total: 49 });
    fetchImpl = async () => jsonResponse(next);
    const s: BrowseFilterState = { ...resting(), season: "cool" };
    render(createElement(VarietyBrowse, { initial: makeInitial({ state: s, items: [item(7)], total: 12 }) }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    await waitFor(() => expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 1 of 3."));
    expect(document.title).toBe("All flower seed varieties | seeds.hues.flowers");
  });

  it("a sort change from page 2 drops the page suffix on swap, with no in-flight flicker", async () => {
    window.history.replaceState({}, "", "/variety?page=2");
    document.title = "All flower seed varieties — page 2 | seeds.hues.flowers";
    const d = deferred<Response>();
    fetchImpl = () => d.promise;
    render(createElement(VarietyBrowse, { initial: makeInitial({ page: 2 }) }));
    fireEvent.click(sortChip("Most sellers first"));
    // In flight: the title is untouched (no flicker through intermediate states).
    expect(document.title).toBe("All flower seed varieties — page 2 | seeds.hues.flowers");
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 2 of 3.");
    d.resolve(
      jsonResponse(makePayload({ state: { ...resting(), sort: "availability" }, items: [item(7)], total: 12 })),
    );
    await waitFor(() => expect(countLine().textContent).toBe("12 varieties, most sellers first."));
    expect(document.title).toBe("All flower seed varieties | seeds.hues.flowers");
  });

  it("a soft-navigation adoption asserts the adopted page's title", () => {
    document.title = "All flower seed varieties | seeds.hues.flowers";
    const { rerender } = render(createElement(VarietyBrowse, { initial: makeInitial() }));
    window.history.replaceState({}, "", "/variety?page=2");
    rerender(createElement(VarietyBrowse, { initial: makeInitial({ items: [item(24), item(25)], page: 2 }) }));
    expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 2 of 3.");
    expect(document.title).toBe("All flower seed varieties — page 2 | seeds.hues.flowers");
  });
});

describe("sort from page 2 (B-1 item 1: the commit is in place, not a navigation)", () => {
  it("commits in place to page 1: prior visible during flight, one swap, one entry, busy set and cleared", async () => {
    // A literal navigation anywhere on this path would call location.assign (the layer's
    // only navigation call): spy it with a stand-in location and require silence. The
    // pushed entry's URL is asserted from the pushState call itself (authoritative).
    const descriptor = Object.getOwnPropertyDescriptor(window, "location");
    const assign = vi.fn();
    window.history.replaceState({}, "", "/variety?page=2");
    Object.defineProperty(window, "location", {
      value: { pathname: "/variety", search: "?page=2", assign },
      configurable: true,
    });
    try {
      document.title = "All flower seed varieties — page 2 | seeds.hues.flowers";
      const d = deferred<Response>();
      fetchImpl = () => d.promise;
      const push = pushSpyOn();
      render(createElement(VarietyBrowse, { initial: makeInitial({ page: 2 }) }));
      expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 2 of 3.");

      fireEvent.click(sortChip("Most sellers first"));
      // During flight: optimistic press, busy on, prior rows and count untouched, no entry.
      expect(sortChip("Most sellers first").getAttribute("aria-pressed")).toBe("true");
      expect(resultsRegion().getAttribute("aria-busy")).toBe("true");
      expect(resultsRegion().textContent).toContain("Test Variety 0");
      expect(countLine().textContent).toBe("49 varieties, alphabetical. Page 2 of 3.");
      expect(fetchUrls()).toEqual(["/api/browse/varieties?sort=availability"]);
      expect(push).not.toHaveBeenCalled();

      d.resolve(
        jsonResponse(makePayload({ state: { ...resting(), sort: "availability" }, items: [item(7)], total: 12 })),
      );
      await waitFor(() => expect(countLine().textContent).toBe("12 varieties, most sellers first."));
      // Exactly one swap: new rows, busy cleared, one history entry, page reset to 1.
      expect(resultsRegion().textContent).toContain("Test Variety 7");
      expect(resultsRegion().textContent).not.toContain("Test Variety 0");
      expect(resultsRegion().hasAttribute("aria-busy")).toBe(false);
      expect(push).toHaveBeenCalledTimes(1);
      expect(push.mock.calls[0]?.[2]).toBe("/variety?sort=availability");
      // The committed state's title (the page-1 reset drops the suffix).
      expect(document.title).toBe("All flower seed varieties | seeds.hues.flowers");
      expect(assign).not.toHaveBeenCalled();
    } finally {
      if (descriptor) Object.defineProperty(window, "location", descriptor);
    }
  });
});

describe("pending cue (SPEC §2.5.3 as amended 2026-11-23: visible by ~0.4s, cleared on swap)", () => {
  it("shows the cue by ~0.4s into a slow sort to availability and clears it on swap (busy set and cleared)", async () => {
    const d = deferred<Response>();
    fetchImpl = () => d.promise;
    const before = makeInitial();
    render(createElement(VarietyBrowse, { initial: before }));
    // Resting: no cue and no busy indication.
    expect(resultsRegion().className).not.toContain("browse-pending");
    expect(resultsRegion().className).not.toContain("opacity-50");
    expect(resultsRegion().hasAttribute("aria-busy")).toBe(false);
    fireEvent.click(sortChip("Most sellers first"));
    // Immediate: busy on, cue not yet (the ~200ms appearance delay keeps instant
    // updates from flashing it).
    expect(resultsRegion().getAttribute("aria-busy")).toBe("true");
    expect(resultsRegion().className).not.toContain("browse-pending");
    // By ~0.4s still in flight: the visible cue is on the region — and the struck
    // deviation's dim is gone (the cue replaces it, it never stacks on it).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(resultsRegion().className).toContain("browse-pending");
    expect(resultsRegion().className).not.toContain("opacity-50");
    expect(resultsRegion().getAttribute("aria-busy")).toBe("true");
    // The swap clears both the cue and the busy indication, together.
    d.resolve(jsonResponse(makePayload({ state: { ...resting(), sort: "availability" }, items: [item(7)], total: 12 })));
    await waitFor(() => expect(resultsRegion().className).not.toContain("browse-pending"));
    expect(resultsRegion().hasAttribute("aria-busy")).toBe(false);
    expect(countLine().textContent).toBe("12 varieties, most sellers first.");
  }, 15000);

  it("shows the cue by ~0.4s on the reverse sort (availability back to Name A–Z) and clears it on swap", async () => {
    const d = deferred<Response>();
    fetchImpl = () => d.promise;
    const before = makeInitial({ state: { ...resting(), sort: "availability" } });
    render(createElement(VarietyBrowse, { initial: before }));
    expect(countLine().textContent).toBe("49 varieties, most sellers first. Page 1 of 3.");
    expect(resultsRegion().className).not.toContain("browse-pending");
    expect(resultsRegion().hasAttribute("aria-busy")).toBe(false);
    fireEvent.click(sortChip("Name A–Z"));
    // Immediate: busy on, cue not yet.
    expect(resultsRegion().getAttribute("aria-busy")).toBe("true");
    expect(resultsRegion().className).not.toContain("browse-pending");
    // By ~0.4s still in flight: the visible cue is on the region.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(resultsRegion().className).toContain("browse-pending");
    expect(resultsRegion().className).not.toContain("opacity-50");
    expect(resultsRegion().getAttribute("aria-busy")).toBe("true");
    // The swap clears both the cue and the busy indication, together.
    d.resolve(jsonResponse(makePayload({ items: [item(7)], total: 12 })));
    await waitFor(() => expect(resultsRegion().className).not.toContain("browse-pending"));
    expect(resultsRegion().hasAttribute("aria-busy")).toBe(false);
    expect(countLine().textContent).toBe("12 varieties, alphabetical.");
  }, 15000);
});
