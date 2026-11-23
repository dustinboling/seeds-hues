// @vitest-environment jsdom
/**
 * Tranche 3.1-I — SellerFilterSection against a fabricated multi-seller variety, at DOM
 * fidelity: the hydrated Small farms toggle (in place, one entry, focus stays), the
 * active-option no-op, in-place Back/Forward, and the filtered-empty "Show all sellers"
 * recovery with its focus handoff to "All sellers".
 *
 * Why this fixture exists: the owed 3.1-I browser check could not run at the PR #46 gate —
 * the local catalog holds no multi-seller variety (sellerCount 0 for 761 varieties, 1 for
 * 17), and the section's toggle renders only when a variety has sellers to filter. This
 * file fabricates that precondition — a mixed-badge multi-seller listing set — under the
 * test tree only (no seed or catalog data changes), so the re-gate can execute 3.1-I here.
 *
 * Non-vacuity: fails on code without the hydrated toggle — the pressed-state buttons, the
 * in-place narrowing, and the popstate re-sync exist only in the interactive section.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...(rest as Record<string, unknown>) }, children),
}));

import { SellerFilterSection } from "@/components/variety/SellerFilterSection";
import { SMALL_FARM_CHIP_LABEL } from "@/lib/small-farm";
import type { PublicListing } from "@/lib/validators";

/** Strict narrowing: throw when a query misses instead of casting a nullable away. */
function need<T>(el: T | null | undefined, what: string): T {
  if (el === null || el === undefined) throw new Error(`seller-filter test: missing ${what}`);
  return el;
}

const SLUG = "test-variety";
const VARIETY_NAME = "Test Variety";

const listing = (
  id: number,
  sellerName: string,
  isSmallFarm: boolean,
  availability: PublicListing["availability"],
): PublicListing =>
  ({
    id,
    availability,
    lastCheckedAt: null,
    firstSeenAt: null,
    packetSizes: [],
    notes: null,
    seller: { slug: `seller-${id}`, name: sellerName, location: null, region: "WA", country: "US", isSmallFarm },
    variety: { slug: SLUG, varietyName: VARIETY_NAME, plant: { slug: "test-plant", commonName: "Test Plant" } },
  }) as unknown as PublicListing;

// The multi-seller precondition the local catalog cannot supply: four listings from four
// sellers, two badged (B = 2, N = 4) so the toggle renders (0 < B < N).
const multiSeller = [
  listing(1, "Bluebird Farm", true, "in_stock"),
  listing(2, "Megas Seeds Co", false, "in_stock"),
  listing(3, "Foxglove Farm", true, "sold_out"),
  listing(4, "Plain Seeds", false, "sold_out"),
];

// B = 0 (no badged seller lists it): the filtered-empty precondition for "Show all sellers".
const unbadged = [listing(1, "Megas Seeds Co", false, "in_stock"), listing(2, "Plain Seeds", false, "in_stock")];

function listingsRegion(): HTMLElement {
  return need(document.getElementById("variety-listings"), "listings region");
}

function countLine(): HTMLElement {
  return need(document.getElementById("variety-listing-count"), "count line");
}

function filterControl(): HTMLElement {
  return screen.getByRole("group", { name: "Filter sellers" });
}

function pushSpyOn(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(window.history, "pushState");
}

beforeEach(() => {
  window.history.replaceState({}, "", `/variety/${SLUG}`);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("multi-seller first paint (the 3.1-I precondition, server floor)", () => {
  it("renders the toggle control with both states linked, the full list, and the count line", () => {
    const h = renderToStaticMarkup(
      createElement(SellerFilterSection, {
        slug: SLUG,
        varietyName: VARIETY_NAME,
        listings: multiSeller,
        initialSmallFarmOnly: false,
      }),
    );
    expect(h).toContain('data-testid="variety-seller-filter"');
    expect(h).toMatch(/<a[^>]*href="\/variety\/test-variety"[^>]*>All sellers<\/a>/);
    expect(h).toMatch(/<a[^>]*href="\/variety\/test-variety\?small_farm=true"[^>]*>Small farms only<\/a>/);
    expect(h).toContain("4 listings.");
    for (const name of ["Bluebird Farm", "Megas Seeds Co", "Foxglove Farm", "Plain Seeds"]) {
      expect(h).toContain(name);
    }
  });
});

describe("hydrated toggle (in place, 3.1-I)", () => {
  it("narrows to badged sellers in place: one entry, pressed state, rows swap, focus stays", () => {
    const push = pushSpyOn();
    render(
      createElement(SellerFilterSection, {
        slug: SLUG,
        varietyName: VARIETY_NAME,
        listings: multiSeller,
        initialSmallFarmOnly: false,
      }),
    );
    const control = filterControl();
    const allBtn = need(
      control.querySelector("button"),
      "All sellers button",
    ) as HTMLButtonElement;
    expect(allBtn.getAttribute("aria-pressed")).toBe("true");
    const farmsBtn = screen.getByRole("button", { name: SMALL_FARM_CHIP_LABEL }) as HTMLButtonElement;
    // jsdom clicks don't take focus; take it explicitly so the toggle must preserve it.
    farmsBtn.focus();

    fireEvent.click(farmsBtn);
    expect(countLine().textContent).toBe("2 of 4 listings · Small farms only.");
    expect(listingsRegion().textContent).toContain("Bluebird Farm");
    expect(listingsRegion().textContent).toContain("Foxglove Farm");
    expect(listingsRegion().textContent).not.toContain("Megas Seeds Co");
    expect(listingsRegion().textContent).not.toContain("Plain Seeds");
    expect(farmsBtn.getAttribute("aria-pressed")).toBe("true");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe("/variety/test-variety?small_farm=true");
    expect(window.location.search).toBe("?small_farm=true");
    expect(document.activeElement).toBe(farmsBtn);
  });

  it("tapping the active option is a no-op (no entry, no change)", () => {
    const push = pushSpyOn();
    render(
      createElement(SellerFilterSection, {
        slug: SLUG,
        varietyName: VARIETY_NAME,
        listings: multiSeller,
        initialSmallFarmOnly: true,
      }),
    );
    expect(countLine().textContent).toBe("2 of 4 listings · Small farms only.");
    fireEvent.click(screen.getByRole("button", { name: SMALL_FARM_CHIP_LABEL }));
    expect(push).not.toHaveBeenCalled();
    expect(countLine().textContent).toBe("2 of 4 listings · Small farms only.");
    expect(window.location.search).toBe("");
  });

  it("Back/Forward re-sync in place (no entry)", () => {
    const push = pushSpyOn();
    render(
      createElement(SellerFilterSection, {
        slug: SLUG,
        varietyName: VARIETY_NAME,
        listings: multiSeller,
        initialSmallFarmOnly: false,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: SMALL_FARM_CHIP_LABEL }));
    expect(window.location.search).toBe("?small_farm=true");

    window.history.replaceState({}, "", `/variety/${SLUG}`);
    fireEvent(window, new window.PopStateEvent("popstate"));
    expect(countLine().textContent).toBe("4 listings.");
    expect(listingsRegion().textContent).toContain("Megas Seeds Co");
    expect(push).toHaveBeenCalledTimes(1);

    window.history.replaceState({}, "", `/variety/${SLUG}?small_farm=true`);
    fireEvent(window, new window.PopStateEvent("popstate"));
    expect(countLine().textContent).toBe("2 of 4 listings · Small farms only.");
    expect(listingsRegion().textContent).not.toContain("Megas Seeds Co");
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("filtered-empty recovery (B = 0 deep link, 3.1-I)", () => {
  it("Show all sellers recovers in place and hands focus to All sellers", () => {
    const push = pushSpyOn();
    render(
      createElement(SellerFilterSection, {
        slug: SLUG,
        varietyName: VARIETY_NAME,
        listings: unbadged,
        initialSmallFarmOnly: true,
      }),
    );
    expect(countLine().textContent).toBe("0 of 2 listings · Small farms only.");
    const empty = need(listingsRegion().querySelector('[data-testid="variety-small-farm-empty"]'), "empty state");
    expect(empty.textContent).toContain(`No seller with the Small farm badge lists ${VARIETY_NAME} yet.`);

    fireEvent.click(screen.getByRole("button", { name: "Show all sellers" }));
    expect(countLine().textContent).toBe("2 listings.");
    expect(listingsRegion().textContent).toContain("Megas Seeds Co");
    expect(listingsRegion().textContent).toContain("Plain Seeds");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe(`/variety/${SLUG}`);
    // The empty-state action unmounted itself: focus lands on the revealed All sellers chip.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "All sellers" }));
  });
});
