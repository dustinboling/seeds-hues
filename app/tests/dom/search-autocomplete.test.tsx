// @vitest-environment jsdom
/**
 * SearchBox autocomplete contract (ported from v2's SearchBox discipline):
 * the hydrated search box is an ARIA 1.2 combobox whose panel renders the
 * API's ranked top 10 verbatim — typing opens it, the mount value never
 * fetches, two characters minimum, 300 ms debounce, full keyboard
 * contract, one announcement per state. Suggestions come from the injected
 * reader (production: GET /api/v1/search, limit 10); ranking is the API's
 * flat `results` order, rendered as received.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchForm } from "../../src/components/SearchForm";
import type { ApiSearchResult } from "../../src/data/types";

const SUGGESTIONS: ApiSearchResult[] = [
  { type: "variety", slug: "testbloom-01", title: "Testbloom 01", subtitle: "Testbloom · Testbloomia fictitious", href: "/variety/testbloom-01", matchedAlias: null },
  { type: "crop", slug: "testbloom", title: "Testbloom", subtitle: "12 varieties", href: "/crop/testbloom", matchedAlias: null },
  { type: "variety", slug: "testbloom-02", title: "Testbloom 02", subtitle: "Testbloom · Testbloomia fictitious", href: "/variety/testbloom-02", matchedAlias: "Oldbloom" },
];

function setup(defaultValue = "") {
  const suggest = vi.fn(async (_term: string, _signal: AbortSignal): Promise<ApiSearchResult[]> => [...SUGGESTIONS]);
  const navigateFn = vi.fn((_href: string): void => {});
  render(<SearchForm label="Search flower seeds" defaultValue={defaultValue} suggest={suggest} navigateFn={navigateFn} />);
  const input = screen.getByRole("combobox");
  const listbox = screen.getByRole("listbox", { hidden: true });
  return { suggest, navigateFn, input: input as HTMLInputElement, listbox };
}

async function typeAndSettle(input: HTMLElement, value: string): Promise<void> {
  fireEvent.change(input, { target: { value } });
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
}

describe("SearchForm autocomplete", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("mounts pristine: combobox resting state, no fetch, panel closed", async () => {
    const { suggest, input, listbox } = setup("testbloom");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(listbox.hidden).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(suggest).not.toHaveBeenCalled();
  });

  it("fetches nothing under two typed characters", async () => {
    const { suggest, input, listbox } = setup();
    await typeAndSettle(input, "t");
    expect(suggest).not.toHaveBeenCalled();
    expect(listbox.hidden).toBe(true);
  });

  it("debounces 300 ms, then renders the ranked suggestions verbatim with the count announcement", async () => {
    const { suggest, input, listbox } = setup();
    fireEvent.change(input, { target: { value: "test" } });
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(suggest).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest.mock.calls[0]![0]).toBe("test");
    // Panel open, API order preserved (ranking verbatim), alias row intact.
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(listbox.hidden).toBe(false);
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Testbloom 01Testbloom · Testbloomia fictitious",
      "Testbloom12 varieties",
      "Testbloom 02Testbloom · Testbloomia fictitious · also sold as “Oldbloom”",
    ]);
    expect(screen.getByRole("status").textContent).toBe("3 suggestions available.");
  });

  it("drives the keyboard contract: arrows move, Enter follows, Escape closes", async () => {
    const { navigateFn, input } = setup();
    await typeAndSettle(input, "test");
    expect(input.getAttribute("aria-activedescendant")).toBeNull();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    const options = screen.getAllByRole("option");
    expect(options[0]!.getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0]!.id);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[1]!.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options[0]!.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(navigateFn).toHaveBeenCalledWith("/variety/testbloom-01");
    expect(input.getAttribute("aria-expanded")).toBe("false");

    // Reopen via ArrowDown (typed results persist), then Escape closes without navigating.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(navigateFn).toHaveBeenCalledTimes(1);
  });

  it("follows a moused suggestion and previews on hover", async () => {
    const { navigateFn, input } = setup();
    await typeAndSettle(input, "test");
    const options = screen.getAllByRole("option");
    fireEvent.mouseEnter(options[2]!);
    expect(options[2]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.mouseDown(options[1]!);
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(navigateFn).toHaveBeenCalledWith("/crop/testbloom");
  });

  it("shows the non-interactive notice row (announced once) when nothing matches", async () => {
    const suggest = vi.fn(async (): Promise<ApiSearchResult[]> => []);
    render(<SearchForm label="Search flower seeds" suggest={suggest} />);
    const input = screen.getByRole("combobox");
    await typeAndSettle(input, "zxqv");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("option")).toBeNull();
    const notice = screen.getByRole("listbox", { hidden: true }).querySelector("li");
    expect(notice?.getAttribute("aria-hidden")).toBe("true");
    expect(notice?.textContent).toBe("No suggestions — press Enter to search.");
    expect(screen.getByRole("status").textContent).toBe("No suggestions — press Enter to search.");
  });

  it("announces the failure row when suggestions fail (the form still submits)", async () => {
    const suggest = vi.fn(async (): Promise<ApiSearchResult[]> => {
      throw new Error("500");
    });
    render(<SearchForm label="Search flower seeds" suggest={suggest} />);
    const input = screen.getByRole("combobox");
    await typeAndSettle(input, "test");
    expect(screen.getByRole("status").textContent).toBe("Suggestions unavailable. Press Enter to search.");
    expect(screen.getByRole("button", { name: "Search" })).toBeDefined();
  });

  it("typing back to the mount value resets without fetching; focus alone never opens", async () => {
    const { suggest, input, listbox } = setup("testbloom");
    await typeAndSettle(input, "testbloom x");
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(listbox.hidden).toBe(false);

    await typeAndSettle(input, "testbloom");
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(listbox.hidden).toBe(true);

    fireEvent.focus(input);
    expect(listbox.hidden).toBe(true);
  });

  it("blurs the panel closed", async () => {
    const { input, listbox } = setup();
    await typeAndSettle(input, "test");
    expect(listbox.hidden).toBe(false);
    fireEvent.blur(input);
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(listbox.hidden).toBe(true);
  });
});
