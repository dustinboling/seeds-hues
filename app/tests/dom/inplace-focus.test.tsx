// @vitest-environment jsdom
/**
 * Slice 8 in-place focus audit (Ada): the shipped browse swaps' final
 * audit — a commit from a surviving control never moves focus (the
 * shopper keeps their place; the count line announces the new result),
 * while a commit from a control that unmounts hands focus to a live
 * control (Clear all, else the first All) instead of dropping it.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDataCache } from "../../src/data/cache";
import { loadVarietyBrowse, type VarietyBrowseData } from "../../src/data/load";
import { VarietyBrowse } from "../../src/components/variety/VarietyBrowse";
import type { BrowseFilterState } from "../../src/lib/browse";
import { browseCatalogState, createBrowseFakeApi } from "../unit/browse-catalog";

const REST: BrowseFilterState = { season: null, method: null, lifeCycle: null, hue: [], smallFarm: false, sort: "name" };

function countLine(): HTMLElement {
  const line = document.getElementById("variety-results-count");
  expect(line).not.toBeNull();
  expect(line!.getAttribute("aria-live")).toBe("polite");
  expect(line!.getAttribute("aria-atomic")).toBe("true");
  return line!;
}

describe("in-place browse focus audit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup(initialState: BrowseFilterState = REST) {
    const api = createBrowseFakeApi(browseCatalogState());
    const cache = createDataCache();
    const initial: VarietyBrowseData = await loadVarietyBrowse(initialState, 1, api as never, cache);
    let release!: () => void;
    let pendingGate = new Promise<void>((resolve) => void (release = resolve));
    const navigateFn = vi.fn((_href: string): Promise<void> => pendingGate);
    const renderBrowse = (snapshot: VarietyBrowseData) => render(<VarietyBrowse initial={snapshot} navigateFn={navigateFn} />);
    const settleNavigation = async (ui: ReturnType<typeof render>, snapshot: VarietyBrowseData): Promise<void> => {
      ui.rerender(<VarietyBrowse initial={snapshot} navigateFn={navigateFn} />);
      await act(async () => {
        release();
        pendingGate = new Promise<void>((resolve) => void (release = resolve));
      });
    };
    const snapshotFor = (state: BrowseFilterState): Promise<VarietyBrowseData> =>
      loadVarietyBrowse({ ...state, hue: [...state.hue] }, 1, api as never, cache);
    return { initial, renderBrowse, settleNavigation, snapshotFor };
  }

  it("a filter commit keeps focus on the invoking control and announces the new count", async () => {
    const { initial, renderBrowse, settleNavigation, snapshotFor } = await setup();
    const ui = renderBrowse(initial);
    const toggle = screen.getByRole("button", { name: /Cool Season Hardy Annuals/ });
    (toggle as HTMLElement).focus();
    fireEvent.click(toggle);
    await settleNavigation(ui, await snapshotFor({ ...REST, season: "cool" }));
    expect(document.activeElement).toBe(toggle);
    expect(countLine().textContent).toMatch(/28 varieties · Cool Season Hardy Annuals, alphabetical\./);
  });

  it("a sort commit keeps focus on the sort control", async () => {
    const { initial, renderBrowse, settleNavigation, snapshotFor } = await setup();
    const ui = renderBrowse(initial);
    const sort = screen.getByRole("button", { name: /Recently checked/ });
    (sort as HTMLElement).focus();
    fireEvent.click(sort);
    await settleNavigation(ui, await snapshotFor({ ...REST, sort: "recent" }));
    expect(document.activeElement).toBe(sort);
  });

  it("removing one of two filters hands focus to the surviving Clear all", async () => {
    const two: BrowseFilterState = { ...REST, season: "cool", hue: ["pink"] };
    const { initial, renderBrowse, settleNavigation, snapshotFor } = await setup(two);
    const ui = renderBrowse(initial);
    fireEvent.click(screen.getByRole("button", { name: /Remove the Season filter/ }));
    await settleNavigation(ui, await snapshotFor({ ...REST, hue: ["pink"] }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Clear all filters" }));
  });

  it("removing the last filter hands focus to a live control, never the body", async () => {
    const one = { ...REST, season: "cool" as const };
    const { initial, renderBrowse, settleNavigation, snapshotFor } = await setup(one);
    const ui = renderBrowse(initial);
    fireEvent.click(screen.getByRole("button", { name: /Remove the Season filter/ }));
    await settleNavigation(ui, await snapshotFor(REST));
    const landed = document.activeElement;
    expect(landed).not.toBe(document.body);
    expect(landed).toBeInstanceOf(HTMLButtonElement);
    expect(document.contains(landed)).toBe(true);
  });
});
