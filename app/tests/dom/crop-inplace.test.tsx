// @vitest-environment jsdom
/**
 * Slice 5 crop in-place drive: the hydrated crop block swaps filter
 * commits in place — no document reload — with the pending cue exactly as
 * the live site behaves. The server floor is pinned by the HTTP suite;
 * this file pins the hydrated behavior against real resolver snapshots.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDataCache } from "../../src/data/cache";
import { resolveCropRoute } from "../../src/server/shop-route";
import { CropDetailBrowse, type CropDetailBrowseInitial } from "../../src/components/crop/CropDetailBrowse";
import { createShopFakeApi, shopCatalogState } from "../unit/shop-catalog";

function resultsRegion(): HTMLElement {
  const region = document.getElementById("crop-variety-results");
  expect(region).not.toBeNull();
  return region!;
}

describe("CropDetailBrowse in-place drive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup() {
    const state = shopCatalogState();
    const api = createShopFakeApi(state);
    const cache = createDataCache();
    const resolved = await resolveCropRoute(api as never, cache, { slug: "sunflower", search: "" });
    if (resolved.kind !== "ok") throw new Error("fixture crop must resolve");
    const base = {
      slug: "sunflower",
      hues: resolved.data.hues,
      series: resolved.data.series,
      commonName: "Sunflower",
      latinName: "Helianthus annuus",
      varietyCount: 30,
      varietiesWithSellers: 25,
    };
    const snapshotFor = async (search: string): Promise<CropDetailBrowseInitial> => {
      const r = await resolveCropRoute(api as never, cache, { slug: "sunflower", search });
      if (r.kind !== "ok") throw new Error(`fixture crop must resolve ${search}`);
      return { state: r.data.state, counts: r.data.counts, items: r.data.items, total: r.data.total, page: r.data.page };
    };
    const initial = await snapshotFor("");
    const hrefs: string[] = [];
    let release!: () => void;
    const gate = (): Promise<void> => new Promise<void>((resolve) => void (release = resolve));
    let pendingGate = gate();
    const navigateFn = vi.fn((href: string): Promise<void> => {
      hrefs.push(href);
      return pendingGate;
    });
    const renderBrowse = (snapshot: CropDetailBrowseInitial) =>
      render(<CropDetailBrowse {...base} initial={snapshot} navigateFn={navigateFn} />);
    const settleNavigation = async (ui: ReturnType<typeof render>, snapshot: CropDetailBrowseInitial): Promise<void> => {
      ui.rerender(<CropDetailBrowse {...base} initial={snapshot} navigateFn={navigateFn} />);
      await act(async () => {
        release();
        pendingGate = gate();
      });
    };
    return { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor };
  }

  it("sellers filter change: aria-busy + pending cue while in flight, in-place swap on settle", async () => {
    const { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor } = await setup();
    const ui = renderBrowse(initial);
    expect(resultsRegion().getAttribute("aria-busy")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Has sellers/ }));
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(hrefs[0]).toBe("/crop/sunflower?has_sellers=true");
    expect(resultsRegion().getAttribute("aria-busy")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(resultsRegion().classList.contains("browse-pending")).toBe(true);

    await settleNavigation(ui, await snapshotFor("?has_sellers=true"));
    expect(resultsRegion().getAttribute("aria-busy")).toBeNull();
    expect(screen.getByText("25 varieties match, alphabetical. Page 1 of 2.")).toBeDefined();
    expect(screen.getByRole("button", { name: /Remove the Sellers filter/ })).toBeDefined();
  });

  it("hue tap toggles the family into the set", async () => {
    const { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor } = await setup();
    const ui = renderBrowse(initial);

    fireEvent.click(screen.getByRole("button", { name: /Pink/ }));
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(hrefs[0]).toBe("/crop/sunflower?color_family=pink");

    await settleNavigation(ui, await snapshotFor("?color_family=pink"));
    expect(screen.getByText("5 varieties match, alphabetical.")).toBeDefined();
  });
});
