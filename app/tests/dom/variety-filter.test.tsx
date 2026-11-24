// @vitest-environment jsdom
/**
 * Slice 3 filter hydration: after hydration the seller-filter chips upgrade
 * from server links to in-place toggle buttons (no navigation, History API
 * only), and Back/Forward re-sync in place. The server render is pinned in
 * variety-components.test.tsx; this file pins the hydrated behavior.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SellerFilterSection } from "../../src/components/variety/SellerFilterSection";
import { fakeCatalogState } from "../unit/fake-catalog";

const listings = () => fakeCatalogState().details["sweet-pea-kings-ransom"]!.listings;

describe("SellerFilterSection hydration", () => {
  it("upgrades links to toggle buttons and filters in place", () => {
    render(
      <SellerFilterSection
        slug="sweet-pea-kings-ransom"
        varietyName="King's Ransom"
        listings={listings()}
        initialSmallFarmOnly={false}
      />,
    );
    const all = screen.getByRole("button", { name: "All sellers" });
    const small = screen.getByRole("button", { name: "Small farms only" });
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(small.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector("[aria-current]")).toBeNull();
    expect(screen.getByText("3 listings.").textContent).toBe("3 listings.");

    fireEvent.click(small);
    expect(window.location.search).toBe("?small_farm=true");
    expect(small.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("2 of 3 listings · Small farms only.")).toBeDefined();
    expect(screen.queryByText("Prairie Seed House")).toBeNull();
    expect(screen.getAllByText("Blue Ridge Seeds").length).toBeGreaterThan(0);

    fireEvent.click(all);
    expect(window.location.search).toBe("");
    expect(screen.getByText("3 listings.")).toBeDefined();
    expect(screen.getByText("Prairie Seed House")).toBeDefined();
  });

  it("tapping the active option pushes no history entry", () => {
    render(
      <SellerFilterSection
        slug="sweet-pea-kings-ransom"
        varietyName="King's Ransom"
        listings={listings()}
        initialSmallFarmOnly={false}
      />,
    );
    const before = window.history.length;
    fireEvent.click(screen.getByRole("button", { name: "All sellers" }));
    expect(window.history.length).toBe(before);
    expect(window.location.search).toBe("");
  });
});
