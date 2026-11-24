// @vitest-environment jsdom
/**
 * Slice 4 in-place drive (the B-1 standard, committed): the hydrated
 * /variety browse swaps filter/sort/page commits in place — no document
 * reload — with the pending cue exactly as the live site behaves (region
 * fades + leaf hairline past ~200ms in flight, aria-busy on the region
 * while loading), and Clear All preserves the shopper's sort. The server
 * floor (links, SSR truth) is pinned by the HTTP suite; this file pins the
 * hydrated behavior against real loader snapshots.
 *
 * Mechanics: navigateFn is a deferred the test owns; "Vike navigates"
 * arrives as a rerender with the loader's snapshot for the committed
 * state (new identity — the adoption path the real router takes).
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDataCache } from "../../src/data/cache";
import { loadVarietyBrowse, type VarietyBrowseData } from "../../src/data/load";
import { VarietyBrowse } from "../../src/components/variety/VarietyBrowse";
import type { BrowseFilterState } from "../../src/lib/browse";
import { browseCatalogState, createBrowseFakeApi } from "../unit/browse-catalog";

const REST: BrowseFilterState = { season: null, method: null, lifeCycle: null, hue: [], smallFarm: false, sort: "name" };

const hrefParam = (href: string, key: string): string | null => new URL(href, "http://localhost").searchParams.get(key);

function resultsRegion(): HTMLElement {
  const region = document.getElementById("variety-results");
  expect(region).not.toBeNull();
  return region!;
}

describe("VarietyBrowse in-place drive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup(initialState: BrowseFilterState = REST, page = 1) {
    const api = createBrowseFakeApi(browseCatalogState());
    const cache = createDataCache();
    const initial: VarietyBrowseData = await loadVarietyBrowse(initialState, page, api as never, cache);
    const hrefs: string[] = [];
    let release!: () => void;
    const gate = (): Promise<void> => new Promise<void>((resolve) => void (release = resolve));
    let pendingGate = gate();
    const navigateFn = vi.fn((href: string): Promise<void> => {
      hrefs.push(href);
      return pendingGate;
    });
    const renderBrowse = (snapshot: VarietyBrowseData) => render(<VarietyBrowse initial={snapshot} navigateFn={navigateFn} />);
    const settleNavigation = async (ui: ReturnType<typeof render>, snapshot: VarietyBrowseData): Promise<void> => {
      // Vike re-renders with the committed snapshot (adoption), then the
      // navigation resolves (focus handoff). Order matches the real router.
      ui.rerender(<VarietyBrowse initial={snapshot} navigateFn={navigateFn} />);
      await act(async () => {
        release();
        pendingGate = gate();
      });
    };
    // Fresh state identity per snapshot — the real router fresh-parses
    // pageContext data every navigation, and adoption keys on it.
    const snapshotFor = (state: BrowseFilterState, p = 1): Promise<VarietyBrowseData> =>
      loadVarietyBrowse({ ...state, hue: [...state.hue] }, p, api as never, cache);
    return { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor };
  }

  it("filter change: aria-busy + pending cue while in flight, in-place swap on settle", async () => {
    const { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor } = await setup();
    const ui = renderBrowse(initial);
    expect(resultsRegion().getAttribute("aria-busy")).toBeNull();
    expect(resultsRegion().classList.contains("browse-pending")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Cool Season Hardy Annuals/ }));
    // One commit, one navigation — the shareable parameterized URL.
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(hrefs[0]).toBe("/variety?season=cool");
    // The URL bar is untouched until the commit lands (no reload, no push yet — Vike owns the entry).
    expect(window.location.pathname).toBe("/");
    // Pending: aria-busy immediately, the cue past ~200ms.
    expect(resultsRegion().getAttribute("aria-busy")).toBe("true");
    expect(resultsRegion().classList.contains("browse-pending")).toBe(false);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(resultsRegion().classList.contains("browse-pending")).toBe(true);
    // The stale results stand until the swap (committed only).
    expect(screen.getByText(/55 varieties, alphabetical\./)).toBeDefined();

    await settleNavigation(ui, await snapshotFor({ ...REST, season: "cool" }));
    // Settled: cue cleared synchronously with the swap, count line + grid swapped in place.
    expect(resultsRegion().getAttribute("aria-busy")).toBeNull();
    expect(resultsRegion().classList.contains("browse-pending")).toBe(false);
    expect(screen.getByText(/28 varieties · Cool Season Hardy Annuals, alphabetical\./)).toBeDefined();
    expect(document.title).toContain("Cool Season Hardy Annuals");
    // The applied row carries the season remover (Clear all survives beside it).
    expect(screen.getByRole("button", { name: /Remove the Season filter/ })).toBeDefined();
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeDefined();
  });

  it("sort change: one navigation, ordering phrase announces the new order", async () => {
    const { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor } = await setup();
    const ui = renderBrowse(initial);

    fireEvent.click(screen.getByRole("button", { name: /Most sellers first/ }));
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(hrefs[0]).toBe("/variety?sort=availability");
    expect(resultsRegion().getAttribute("aria-busy")).toBe("true");

    await settleNavigation(ui, await snapshotFor({ ...REST, sort: "availability" }));
    expect(resultsRegion().getAttribute("aria-busy")).toBeNull();
    expect(screen.getByText(/55 varieties, most sellers first\./)).toBeDefined();
    // Tapping the active sort is a no-op: no entry, no commit.
    fireEvent.click(screen.getByRole("button", { name: /Most sellers first/ }));
    expect(navigateFn).toHaveBeenCalledTimes(1);
  });

  it("page turn: the anchor intercepts in place with the pending cue (no reload)", async () => {
    const { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor } = await setup();
    const ui = renderBrowse(initial);

    fireEvent.click(screen.getByRole("link", { name: /Next/ }));
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(hrefs[0]).toBe("/variety?page=2");
    expect(window.location.pathname).toBe("/");
    expect(resultsRegion().getAttribute("aria-busy")).toBe("true");

    await settleNavigation(ui, await snapshotFor(REST, 2));
    expect(screen.getByText(/Page 2 of 3\./)).toBeDefined();
    expect(resultsRegion().getAttribute("aria-busy")).toBeNull();
  });

  it("Clear All preserves the sort (filter params dropped, ?sort= kept)", async () => {
    const filtered: BrowseFilterState = { ...REST, season: "cool", sort: "recent" };
    const { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor } = await setup(filtered);
    const ui = renderBrowse(initial);
    expect(screen.getByText(/most recently checked first/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(hrefs[0]).toBe("/variety?sort=recent");
    expect(hrefParam(hrefs[0]!, "season")).toBeNull();

    await settleNavigation(ui, await snapshotFor({ ...REST, sort: "recent" }));
    // The sort survives the settle: ordering phrase + pressed chip.
    expect(screen.getByText(/55 varieties, most recently checked first\./)).toBeDefined();
    expect(screen.getByRole("button", { name: /Recently checked/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Clear all filters" })).toBeNull();
  });

  it("multi-select Hue: independent toggles, one remover chip per hue", async () => {
    const yellow: BrowseFilterState = { ...REST, hue: ["yellow"] };
    const { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor } = await setup(yellow);
    const ui = renderBrowse(initial);
    expect(screen.getByText(/16 varieties · Yellow, alphabetical\./)).toBeDefined();

    // Toggling White unions (yellow stays pressed — independent toggles, OR within Hue).
    // The pair serializes in canonical display order (White · Yellow, as the count line reads).
    fireEvent.click(screen.getByRole("button", { name: /^White/ }));
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(hrefParam(hrefs[0]!, "color_family")).toBe("white,yellow");
    expect(screen.getByRole("button", { name: /^Yellow/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^White/ }).getAttribute("aria-pressed")).toBe("true");

    await settleNavigation(ui, await snapshotFor({ ...REST, hue: ["white", "yellow"] }));
    expect(screen.getByText(/33 varieties · White · Yellow, alphabetical\./)).toBeDefined();
    // One remover per hue.
    expect(screen.getByRole("button", { name: "Remove the Hue filter, Yellow" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Remove the Hue filter, White" })).toBeDefined();

    // Removing Yellow narrows back to White alone.
    fireEvent.click(screen.getByRole("button", { name: "Remove the Hue filter, Yellow" }));
    expect(navigateFn).toHaveBeenCalledTimes(2);
    expect(hrefParam(hrefs[1]!, "color_family")).toBe("white");
  });

  it("rapid taps settle on the last selection (stale commits discarded)", async () => {
    const { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor } = await setup();
    const ui = renderBrowse(initial);

    fireEvent.click(screen.getByRole("button", { name: /Cool Season Hardy Annuals/ }));
    fireEvent.click(screen.getByRole("button", { name: /Warm Season Tender Annuals/ }));
    expect(navigateFn).toHaveBeenCalledTimes(2);
    // The second tap composes on the first's intent (single-select assigns): warm wins.
    expect(hrefs[1]).toBe("/variety?season=warm");

    await settleNavigation(ui, await snapshotFor({ ...REST, season: "warm" }));
    expect(document.getElementById("variety-results-count")!.textContent).toMatch(
      /27 varieties · Warm Season Tender Annuals, alphabetical\./,
    );
    expect(resultsRegion().getAttribute("aria-busy")).toBeNull();
  });
});
