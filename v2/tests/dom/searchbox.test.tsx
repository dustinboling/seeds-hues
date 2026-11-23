/**
 * Tranche 3.4 §5.3 — the SearchBox widget (components/search/SearchBox.tsx): no fetch and no
 * open on mount (the mount value is submitted text, not typed text), focus alone never opens
 * the panel, typed empty/failure states render one visible non-interactive message row, and
 * the active row carries the AD-2 leaf rule. Fetch is stubbed per test. The F-5 follow-up
 * pins aria-expanded tracking the panel in every state (closed, suggestions, notice, failure).
 *
 * Non-vacuity: fails on pre-build code — mounting with a defaultValue fetches and opens,
 * focus reopens unconditionally, empty/failure states stay sr-only, and the active row has
 * no leaf rule. The F-5 notice/failure pins fail on the shipped PR #57 code too — its
 * aria-expanded stays false while the notice listbox is on screen.
 */
// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...(rest as Record<string, unknown>) }, children),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { SearchBox } from "@/components/search/SearchBox";
import type { SearchResult } from "@/lib/validators";

const EMPTY_ROW = "No suggestions — press Enter to search.";
const FAILURE_ROW = "Suggestions unavailable. Press Enter to search.";

function result(over: Partial<SearchResult> = {}): SearchResult {
  return {
    type: "variety",
    slug: "sweet-pea-alison",
    title: "Alison",
    subtitle: "Sweet Pea · 1 seller",
    href: "/variety/sweet-pea-alison",
    matchedAlias: null,
    ...over,
  };
}

const ok = (results: SearchResult[]): Response =>
  ({ ok: true, json: async () => ({ data: { results } }) }) as unknown as Response;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async () => ok([]));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  push.mockClear();
});

function box(defaultValue = "") {
  const rendered = render(createElement(SearchBox, { defaultValue, label: "Search flower seeds" }));
  return { ...rendered, input: screen.getByRole("combobox", { name: "Search flower seeds" }) as HTMLInputElement };
}

/** Run the 300 ms debounce and flush the fetch promise chain. */
async function settle(ms = 400): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => {});
}

describe("no-auto-open (§5.3.1)", () => {
  it("mounts with a defaultValue and fires no fetch and opens no panel", async () => {
    const { input } = box("zinnia");
    expect(input.value).toBe("zinnia");
    await settle(1000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBe(null);
    expect(screen.queryByRole("option")).toBe(null);
  });

  it("focus alone never opens the panel", async () => {
    const { input } = box("zinnia");
    fireEvent.focus(input);
    await settle(1000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBe(null);
  });

  it("ArrowDown with no results opens nothing", async () => {
    const { input } = box("zinnia");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await settle();
    expect(screen.queryByRole("listbox")).toBe(null);
  });

  it("typing back to the mount value returns the box to pristine (panel closes)", async () => {
    fetchMock.mockResolvedValue(ok([result()]));
    const { input } = box("zinnia");
    fireEvent.change(input, { target: { value: "zinnias" } });
    await settle();
    expect(screen.queryByRole("listbox")).not.toBe(null);
    fireEvent.change(input, { target: { value: "zinnia" } });
    await settle(1000);
    expect(screen.queryByRole("listbox")).toBe(null);
    // The mount text itself never fetched: the only call carried the typed text.
    for (const [url] of fetchMock.mock.calls) expect(String(url)).toContain("q=zinnias");
  });

  it("focus reopens results the visitor's own typing produced in this mount", async () => {
    fetchMock.mockResolvedValue(ok([result()]));
    const { input } = box("");
    fireEvent.change(input, { target: { value: "al" } });
    await settle();
    expect(screen.queryByRole("listbox")).not.toBe(null);
    fireEvent.blur(input);
    await settle(200);
    expect(screen.queryByRole("listbox")).toBe(null);
    fireEvent.focus(input);
    expect(screen.queryByRole("listbox")).not.toBe(null);
  });
});

describe("visible empty and failure rows (§5.3.3)", () => {
  it("a typed no-match query renders one aria-hidden message row (never an option)", async () => {
    fetchMock.mockResolvedValue(ok([]));
    const { container, input } = box("");
    fireEvent.change(input, { target: { value: "zz" } });
    await settle();
    const listbox = screen.getByRole("listbox");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    const row = container.querySelector('li[aria-hidden="true"]');
    expect(row?.textContent).toBe(EMPTY_ROW);
    // The sr-only status announces the identical text: one message, announced once.
    const status = within(listbox.parentElement as HTMLElement).getByRole("status");
    expect(status.textContent).toBe(EMPTY_ROW);
  });

  it("a failed fetch renders the failure row with its existing text", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const { container, input } = box("");
    fireEvent.change(input, { target: { value: "zz" } });
    await settle();
    expect(screen.queryByRole("listbox")).not.toBe(null);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(container.querySelector('li[aria-hidden="true"]')?.textContent).toBe(FAILURE_ROW);
  });

  it("the debounce window stays silent (no panel, no status, before the fetch lands)", async () => {
    fetchMock.mockResolvedValue(ok([]));
    const { input } = box("");
    fireEvent.change(input, { target: { value: "zz" } });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByRole("listbox")).toBe(null);
    expect(screen.getByRole("status").textContent).toBe("");
  });
});

describe("combobox expanded state (F-5: aria-expanded tracks the panel)", () => {
  it("reports collapsed while closed (mount and pristine focus)", async () => {
    const { input } = box("zinnia");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    fireEvent.focus(input);
    await settle(1000);
    expect(screen.queryByRole("listbox")).toBe(null);
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("reports expanded with suggestions", async () => {
    fetchMock.mockResolvedValue(ok([result()]));
    const { input } = box("");
    fireEvent.change(input, { target: { value: "al" } });
    await settle();
    expect(screen.queryByRole("listbox")).not.toBe(null);
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  it("reports expanded in the zero-suggestion notice state", async () => {
    fetchMock.mockResolvedValue(ok([]));
    const { input } = box("");
    fireEvent.change(input, { target: { value: "zz" } });
    await settle();
    expect(screen.queryByRole("listbox")).not.toBe(null);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  it("reports expanded in the failure state", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const { input } = box("");
    fireEvent.change(input, { target: { value: "zz" } });
    await settle();
    expect(screen.queryByRole("listbox")).not.toBe(null);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("active-row state mark (§5.3.5 AD-2)", () => {
  it("keyboard activation marks the row with the 3 px leaf rule (wash stays too)", async () => {
    fetchMock.mockResolvedValue(ok([result(), result({ slug: "x", title: "X", href: "/variety/x" })]));
    const { input } = box("");
    fireEvent.change(input, { target: { value: "al" } });
    await settle();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]!.className).toContain("border-l-transparent");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const marked = screen.getAllByRole("option")[0]!;
    expect(marked.getAttribute("aria-selected")).toBe("true");
    expect(marked.className).toContain("border-l-leaf");
    expect(marked.className).toContain("border-l-[3px]");
    expect(marked.className).toContain("bg-leaf-50");
  });

  it("hover writes the same active state (one state for hover and keyboard alike)", async () => {
    fetchMock.mockResolvedValue(ok([result(), result({ slug: "x", title: "X", href: "/variety/x" })]));
    const { input } = box("");
    fireEvent.change(input, { target: { value: "al" } });
    await settle();
    const options = screen.getAllByRole("option");
    fireEvent.mouseEnter(options[1]!);
    expect(options[1]!.getAttribute("aria-selected")).toBe("true");
    expect(options[1]!.className).toContain("border-l-leaf");
    expect(options[0]!.getAttribute("aria-selected")).toBe("false");
  });
});
