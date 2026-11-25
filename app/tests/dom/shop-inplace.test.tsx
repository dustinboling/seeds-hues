// @vitest-environment jsdom
/**
 * Slice 5 shop in-place drive: the hydrated shop block swaps filter, sort,
 * and search commits in place — no document reload — with the pending cue
 * exactly as the live site behaves (leaf hairline + wash past ~200ms in
 * flight, aria-busy while loading). The server floor (links, GET form, SSR
 * truth) is pinned by the HTTP suite; this file pins the hydrated behavior
 * against real resolver snapshots.
 *
 * Mechanics: navigateFn is a deferred the test owns; "Vike navigates"
 * arrives as a rerender with the resolver's snapshot for the committed
 * state (new identity — the adoption path the real router takes).
 *
 * Recorded platform delta: the shop search commits on submit/blur/clear
 * (the deliberate acts) — v2 also narrows while typing via replaceState,
 * which Vike's push-only navigate cannot mirror without spamming history.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDataCache } from "../../src/data/cache";
import { resolveShopRoute } from "../../src/server/shop-route";
import { ShopBrowse, type ShopBrowseInitial } from "../../src/components/seller/ShopBrowse";
import { createShopFakeApi, shopCatalogState } from "../unit/shop-catalog";

function resultsRegion(): HTMLElement {
  const region = document.getElementById("shop-results");
  expect(region).not.toBeNull();
  return region!;
}

describe("ShopBrowse in-place drive", () => {
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
    const resolved = await resolveShopRoute(api as never, cache, { slug: "blue-ridge-seeds", search: "" });
    if (resolved.kind !== "ok") throw new Error("fixture shop must resolve");
    const base = {
      basePath: "/seller/blue-ridge-seeds",
      sellerName: "Blue Ridge Seeds",
      baseTitle: "Blue Ridge Seeds — Flower Seed Seller",
      full: resolved.seller.listings,
      crops: resolved.crops,
    };
    const snapshotFor = async (search: string): Promise<ShopBrowseInitial> => {
      const r = await resolveShopRoute(api as never, cache, { slug: "blue-ridge-seeds", search });
      if (r.kind !== "ok") throw new Error(`fixture shop must resolve ${search}`);
      return { state: r.state, counts: r.counts, items: r.items, total: r.total, page: r.page };
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
    const renderBrowse = (snapshot: ShopBrowseInitial) => render(<ShopBrowse {...base} initial={snapshot} navigateFn={navigateFn} />);
    const settleNavigation = async (ui: ReturnType<typeof render>, snapshot: ShopBrowseInitial): Promise<void> => {
      ui.rerender(<ShopBrowse {...base} initial={snapshot} navigateFn={navigateFn} />);
      await act(async () => {
        release();
        pendingGate = gate();
      });
    };
    return { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor };
  }

  it("crop filter change: aria-busy + pending cue while in flight, in-place swap on settle", async () => {
    const { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor } = await setup();
    const ui = renderBrowse(initial);
    expect(resultsRegion().getAttribute("aria-busy")).toBeNull();
    expect(resultsRegion().classList.contains("browse-pending")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Cosmos/ }));
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(hrefs[0]).toBe("/seller/blue-ridge-seeds?crop=cosmos");
    expect(resultsRegion().getAttribute("aria-busy")).toBe("true");
    expect(resultsRegion().classList.contains("browse-pending")).toBe(false);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(resultsRegion().classList.contains("browse-pending")).toBe(true);
    expect(screen.getByText(/30 listings, in stock first\./)).toBeDefined();

    await settleNavigation(ui, await snapshotFor("?crop=cosmos"));
    expect(resultsRegion().getAttribute("aria-busy")).toBeNull();
    expect(resultsRegion().classList.contains("browse-pending")).toBe(false);
    expect(screen.getByText("14 listings, in stock first.")).toBeDefined();
    expect(screen.getByRole("button", { name: /Remove the Crop filter/ })).toBeDefined();
  });

  it("search submit: one navigation, the narrowed shop swaps in", async () => {
    const { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor } = await setup();
    const ui = renderBrowse(initial);

    fireEvent.change(screen.getByLabelText(/Search Blue Ridge Seeds’ shop/), { target: { value: "rose" } });
    // Typing alone commits nothing (no live narrowing — the deliberate act owns the entry).
    expect(navigateFn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(hrefs[0]).toBe("/seller/blue-ridge-seeds?q=rose");

    await settleNavigation(ui, await snapshotFor("?q=rose"));
    expect(screen.getByText("2 matches for “rose”, best match first.")).toBeDefined();
    expect(screen.getByRole("button", { name: /Clear the search/ })).toBeDefined();
  });

  it("sort change: one navigation, ordering phrase announces the new order", async () => {
    const { initial, hrefs, navigateFn, renderBrowse, settleNavigation, snapshotFor } = await setup();
    const ui = renderBrowse(initial);

    fireEvent.click(screen.getByRole("button", { name: "Name A–Z" }));
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(hrefs[0]).toBe("/seller/blue-ridge-seeds?sort=name");

    await settleNavigation(ui, await snapshotFor("?sort=name"));
    expect(screen.getByText("30 listings, A–Z. · page 1 of 2")).toBeDefined();
    expect(document.title).toBe("Blue Ridge Seeds — Flower Seed Seller | seeds.hues.flowers");
    // Tapping the active sort is a no-op: no entry, no commit.
    fireEvent.click(screen.getByRole("button", { name: "Name A–Z" }));
    expect(navigateFn).toHaveBeenCalledTimes(1);
  });
});
