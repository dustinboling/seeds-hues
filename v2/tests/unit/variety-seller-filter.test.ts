/**
 * Variety-page seller filter: the in-place toggle (Dustin's ruling — tapping "Small farms only"
 * must update the list in place, not behave like a full-page reload).
 *
 * Tooling note: this suite runs in the node environment with no DOM and no component-testing
 * library (see vitest.config.ts), so interaction is evidenced the strongest way the existing
 * patterns support: renderToStaticMarkup for the rendered output of BOTH filter states from one
 * loaded listing set (the server first paint, which doubles as the no-JS fallback), unit tests
 * for the pure URL helpers the toggle and popstate paths share, and source assertions for the
 * wiring static markup cannot show (History API instead of the Next router, the popstate
 * re-sync, the no-setState-in-effect shape, and the hydrated toggle semantics).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SellerFilterSection } from "@/components/variety/SellerFilterSection";
import { smallFarmOnlyFromSearch, varietyFilterHref } from "@/lib/small-farm";
import type { PublicListing } from "@/lib/validators";

const SLUG = "test-variety";
const VARIETY_NAME = "Test Variety";

const listing = (id: number, isSmallFarm: boolean, availability: PublicListing["availability"]): PublicListing =>
  ({
    id,
    availability,
    lastCheckedAt: null,
    firstSeenAt: null,
    packetSizes: [],
    notes: null,
    seller: { slug: `seller-${id}`, name: `Seller ${id}`, location: null, region: "WA", country: "US", isSmallFarm },
    variety: { slug: SLUG, varietyName: VARIETY_NAME, plant: { slug: "test-plant", commonName: "Test Plant" } },
  }) as unknown as PublicListing;

// Mixed sellers (0 < B < N): the control renders. Availabilities are arranged so the Quiet
// Ledger order differs from the input order in both filter states.
const mixed = [
  listing(1, false, "sold_out"),
  listing(2, true, "in_stock"),
  listing(3, false, "in_stock"),
  listing(4, true, "sold_out"),
];

const html = (listings: PublicListing[], initialSmallFarmOnly: boolean): string =>
  renderToStaticMarkup(
    createElement(SellerFilterSection, { slug: SLUG, varietyName: VARIETY_NAME, listings, initialSmallFarmOnly }),
  );

const expectOrder = (h: string, names: string[]): void => {
  const positions = names.map((n) => h.indexOf(`>${n}</a>`));
  for (const [i, p] of positions.entries()) expect(p, names[i]).toBeGreaterThanOrEqual(0);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
};

describe("varietyFilterHref (the shareable filter URL, one builder for links and pushState)", () => {
  it("bare route when off; the one filter vocabulary when on", () => {
    expect(varietyFilterHref("blue-vein", false)).toBe("/variety/blue-vein");
    expect(varietyFilterHref("blue-vein", true)).toBe("/variety/blue-vein?small_farm=true");
  });
});

describe("smallFarmOnlyFromSearch (popstate re-sync parses like the middleware)", () => {
  it("exactly one small_farm=true is on; everything else is off", () => {
    expect(smallFarmOnlyFromSearch("")).toBe(false);
    expect(smallFarmOnlyFromSearch("?small_farm=true")).toBe(true);
    expect(smallFarmOnlyFromSearch("small_farm=true")).toBe(true);
    expect(smallFarmOnlyFromSearch("?small_farm=false")).toBe(false);
    expect(smallFarmOnlyFromSearch("?small_farm=garbage")).toBe(false);
    expect(smallFarmOnlyFromSearch("?small_farm=true&small_farm=true")).toBe(false);
    expect(smallFarmOnlyFromSearch("?other=1&small_farm=true")).toBe(true);
  });
});

describe("SellerFilterSection first paint (one loaded listing set, both states)", () => {
  const off = html(mixed, false);
  const on = html(mixed, true);

  it("off: every listing renders, in-stock first and sold-out last, stable within groups", () => {
    expectOrder(off, ["Seller 2", "Seller 3", "Seller 1", "Seller 4"]);
    expect(off).toContain("4 listings.");
  });

  it("on: badged rows only, same in-stock-first ordering, with the of-N count line", () => {
    for (const absent of ["Seller 1", "Seller 3"]) expect(on).not.toContain(absent);
    expectOrder(on, ["Seller 2", "Seller 4"]);
    expect(on).toContain("2 of 4 listings · Small farms only.");
  });

  it("renders real links to the same public URLs, with aria-current on the active chip", () => {
    for (const h of [off, on]) {
      expect(h).toContain('data-testid="variety-seller-filter"');
      expect(h).toMatch(/<a[^>]*href="\/variety\/test-variety"[^>]*>All sellers<\/a>/);
      expect(h).toMatch(/<a[^>]*href="\/variety\/test-variety\?small_farm=true"[^>]*>Small farms only<\/a>/);
      expect(h.match(/aria-current="true"/g) ?? []).toHaveLength(1);
    }
    expect(off).toMatch(/<a[^>]*aria-current="true"[^>]*>All sellers<\/a>/);
    expect(on).toMatch(/<a[^>]*aria-current="true"[^>]*>Small farms only<\/a>/);
  });

  it("keeps link semantics until hydration (toggle semantics are hydration-only)", () => {
    expect(off).toContain("<nav");
    expect(off).not.toContain("aria-pressed");
    expect(on).not.toContain("aria-pressed");
  });

  it("keeps one persistent live-region count line and the legend inside a mixed page", () => {
    for (const h of [off, on]) {
      expect(h.match(/id="variety-listing-count"/g) ?? []).toHaveLength(1);
      expect(h).toContain('aria-live="polite"');
      expect(h).toContain('id="variety-listings"');
      expect(h).toContain("data-small-farm-legend");
    }
  });

  it("leaves the full-set summary to the server view (it must not move with the filter)", () => {
    expect(off).not.toContain("shops ·");
    expect(on).not.toContain("shops ·");
  });
});

describe("SellerFilterSection edge states", () => {
  it("B = 0 deep link: filtered-empty wording in the results region, a 0-of-N count, no control", () => {
    const empty = html(
      [listing(1, false, "in_stock"), listing(2, false, "in_stock")],
      true,
    );
    expect(empty).toContain('data-testid="variety-small-farm-empty"');
    expect(empty).toContain(`No seller with the Small farm badge lists ${VARIETY_NAME} yet.`);
    expect(empty).toMatch(/<a[^>]*href="\/variety\/test-variety"[^>]*>Show all sellers<\/a>/);
    expect(empty).toContain("0 of 2 listings · Small farms only.");
    expect(empty).not.toContain('data-testid="variety-seller-filter"');
    expect(empty).not.toContain("data-small-farm-legend");
    expect(empty.indexOf('id="variety-listings"')).toBeLessThan(empty.indexOf('data-testid="variety-small-farm-empty"'));
  });

  it("B = 0 unfiltered: the full list, no control, no legend", () => {
    const all = html(
      [listing(1, false, "in_stock"), listing(2, false, "in_stock")],
      false,
    );
    expect(all).toContain("2 listings.");
    expect(all).toContain("Seller 1");
    expect(all).toContain("Seller 2");
    expect(all).not.toContain('data-testid="variety-seller-filter"');
    expect(all).not.toContain("data-small-farm-legend");
  });

  it("all badged (B = N): no control — the two states would show identical lists", () => {
    const h = html([listing(1, true, "in_stock"), listing(2, true, "sold_out")], false);
    expect(h).not.toContain('data-testid="variety-seller-filter"');
    expect(h).toContain("data-small-farm-legend");
    expect(h).toContain("2 listings.");
  });
});

describe("SellerFilterSection toggle wiring (source)", () => {
  const section = readFileSync(join(process.cwd(), "components/variety/SellerFilterSection.tsx"), "utf8");

  it("is a client component that never touches the Next router", () => {
    expect(section).toContain('"use client"');
    expect(section).not.toContain("next/navigation");
    expect(section).not.toContain("useRouter(");
    expect(section).not.toContain("usePathname(");
    expect(section).not.toContain("router.push");
    expect(section).not.toContain("router.replace");
  });

  it("shares the URL through the History API and re-syncs on popstate", () => {
    expect(section).toContain("history.pushState");
    expect(section).toContain('addEventListener("popstate"');
    expect(section).toContain('removeEventListener("popstate"');
    expect(section).toContain("smallFarmOnlyFromSearch(window.location.search)");
    expect(section).toContain("useState(initialSmallFarmOnly)");
  });

  it("reconciles URL → state only in the popstate callback (no setState in any effect body)", () => {
    expect(section).not.toContain("setHydrated");
    expect(section).toContain("useSyncExternalStore");
    // Exactly four setState call sites: the toggle handler's pair and the popstate
    // callback's pair (the re-sync re-arms filterTouched so Back/Forward cascades too).
    expect(section.match(/setSmallFarmOnly\(/g) ?? []).toHaveLength(2);
    expect(section).toContain("setSmallFarmOnly(next)");
    expect(section).toContain("setSmallFarmOnly(smallFarmOnlyFromSearch(window.location.search))");
    expect(section.match(/setFilterTouched\(/g) ?? []).toHaveLength(2);
    expect(section.match(/setFilterTouched\(true\)/g) ?? []).toHaveLength(2);
    // Neither effect body calls setState itself (the popstate callback is nested, so it runs
    // on browser Back/Forward — not during the effect — which the hooks rule permits).
    const bodies = [...section.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)].map((m) => m[1]!);
    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      const topLevel = body.replace(/const onPopState[\s\S]*?\n    \};/, "");
      expect(topLevel).not.toContain("setSmallFarmOnly");
      expect(topLevel).not.toContain("setFilterTouched");
    }
  });

  it("upgrades to toggle semantics once hydrated, without touching copy", () => {
    expect(section).toContain('role="group"');
    expect(section).toContain("aria-pressed={!smallFarmOnly}");
    expect(section).toContain("aria-pressed={smallFarmOnly}");
    expect(section).toContain('type="button"');
    expect(section).toContain('aria-current={active ? "true" : undefined}');
    expect(section).toContain("{SMALL_FARM_CHIP_LABEL}");
    expect(section).toContain("smallFarmEmptyVariety(varietyName)");
    expect(section).toContain("{sf.countLine}");
    expect(section.match(/prefetch=\{false\}/g) ?? []).toHaveLength(2);
  });

  it("fires no beacon, no scroll, and no clamp on toggle", () => {
    expect(section).not.toContain("<ViewBeacon");
    expect(section).not.toContain("/api/track");
    expect(section).not.toContain("sendBeacon");
    expect(section).not.toContain("scrollIntoView");
    expect(section).not.toContain("scrollTo");
    expect(section).not.toContain("ResultsScrollClamp");
    // The only programmatic focus is the empty-state action's handoff to "All sellers".
    expect(section.match(/\.focus\(\)/g) ?? []).toHaveLength(1);
    expect(section).toContain("allSellersRef.current?.focus()");
  });
});

describe("variety server view integration (source)", () => {
  const view = readFileSync(join(process.cwd(), "app/variety/[slug]/variety-view.tsx"), "utf8");

  it("mounts one section per page with the full listing set and the server filter state", () => {
    expect(view.match(/<SellerFilterSection/g) ?? []).toHaveLength(1);
    expect(view).toContain("listings={v.listings}");
    expect(view).toContain("initialSmallFarmOnly={smallFarmOnly}");
  });

  it("keeps the beacon, the full-set summary, and the clamp outside the toggle", () => {
    expect(view).toContain("<ViewBeacon");
    expect(view.indexOf("<ViewBeacon")).toBeLessThan(view.indexOf("<SellerFilterSection"));
    expect(view).toContain("ResultsScrollClamp");
    expect(view.indexOf("in stock")).toBeLessThan(view.indexOf("<SellerFilterSection"));
  });

  it("keeps first-load routing (middleware rewrite + sibling route) intact", () => {
    const middleware = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    expect(middleware).toContain("smallFarmVariantPath");
    const variant = readFileSync(join(process.cwd(), "app/variety/[slug]/small-farms/page.tsx"), "utf8");
    expect(variant).toContain("smallFarmOnly");
    const plain = readFileSync(join(process.cwd(), "app/variety/[slug]/page.tsx"), "utf8");
    expect(plain).toContain("smallFarmOnly={false}");
  });
});

describe("Filter-update motion (Mina spec 2026-11-20 — cascade fires only on filter change)", () => {
  it("first paint carries no listing-swap class in either filter state", () => {
    expect(html(mixed, false)).not.toContain("listing-swap");
    expect(html(mixed, true)).not.toContain("listing-swap");
  });

  it("first paint carries no listing-swap class in the B = 0 and all-badged edge states", () => {
    const unbadged = [listing(1, false, "in_stock"), listing(2, false, "in_stock")];
    expect(html(unbadged, false)).not.toContain("listing-swap");
    expect(html(unbadged, true)).not.toContain("listing-swap");
    const badged = [listing(1, true, "in_stock"), listing(2, true, "sold_out")];
    expect(html(badged, false)).not.toContain("listing-swap");
    expect(html(badged, true)).not.toContain("listing-swap");
  });

  it("keys the swapping elements by filter state and gates the class on filterTouched (source)", () => {
    const section = readFileSync(join(process.cwd(), "components/variety/SellerFilterSection.tsx"), "utf8");
    // Both the <ul> and the filtered-empty <p> remount on every filter-state change, so
    // retained rows cascade too; the class arrives only once the visitor has touched the filter.
    expect(section.match(/key=\{smallFarmOnly \? "small-farms" : "all"\}/g) ?? []).toHaveLength(2);
    expect(section).toContain('className={`mt-3 flex flex-col gap-3${filterTouched ? " listing-swap" : ""}`}');
    expect(section).toContain('className={`mt-3 text-muted${filterTouched ? " listing-swap" : ""}`}');
    // #variety-listings itself never remounts and gains no class; the component names only
    // the class, never the keyframes (the trigger mechanism, nothing more).
    expect(section).toContain('<div id="variety-listings">');
    expect(section).not.toContain("listing-item-in");
  });

  it("re-arms the cascade on Back/Forward from the same popstate callback (source)", () => {
    const section = readFileSync(join(process.cwd(), "components/variety/SellerFilterSection.tsx"), "utf8");
    const popstate = section.match(/const onPopState[\s\S]*?\n    \};/)?.[0] ?? "";
    expect(popstate).not.toBe("");
    expect(popstate).toContain("setSmallFarmOnly(smallFarmOnlyFromSearch(window.location.search))");
    expect(popstate).toContain("setFilterTouched(true);");
  });

  it("defines the motion tokens beside the card tokens with the spec's exact values", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toContain("--duration-filter-item: 220ms;");
    expect(css).toContain("--ease-filter-settle: cubic-bezier(0.22, 1, 0.36, 1);");
    expect(css.match(/--duration-filter-item:/g) ?? []).toHaveLength(1);
    expect(css.match(/--ease-filter-settle:/g) ?? []).toHaveLength(1);
    expect(css.indexOf("--shadow-card")).toBeLessThan(css.indexOf("--duration-filter-item"));
  });

  it("defines the listing-item-in keyframes and the capped stagger with the spec's exact values", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(
      /@keyframes listing-item-in \{\s*from \{\s*opacity: 0;\s*transform: translateY\(6px\);\s*\}\s*to \{\s*opacity: 1;\s*transform: translateY\(0\);\s*\}\s*\}/,
    );
    // Motion code stays together: the cascade follows the skeleton block in the components layer.
    expect(css.indexOf("@keyframes skeleton-reveal")).toBeLessThan(css.indexOf("@keyframes listing-item-in"));
    expect(css).toContain(".listing-swap > li {");
    expect(css).toContain("animation: listing-item-in var(--duration-filter-item) var(--ease-filter-settle) both;");
    expect(css).toContain(".listing-swap > li:nth-child(2) { animation-delay: 30ms; }");
    expect(css).toContain(".listing-swap > li:nth-child(3) { animation-delay: 60ms; }");
    expect(css).toContain(".listing-swap > li:nth-child(4) { animation-delay: 90ms; }");
    expect(css).toContain(".listing-swap > li:nth-child(5) { animation-delay: 120ms; }");
    expect(css).toContain(".listing-swap > li:nth-child(n + 6) { animation-delay: 120ms; }");
    expect(css).toContain("p.listing-swap {");
  });

  it("removes the animation entirely under prefers-reduced-motion (animation: none)", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.listing-swap > li,\s*p\.listing-swap \{\s*animation: none;\s*\}\s*\}/,
    );
  });

  it("animates opacity/transform only — no layout property anywhere in the treatment", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const block = css.slice(css.indexOf("@keyframes listing-item-in"), css.indexOf(".sr-only-focusable"));
    expect(block).not.toBe("");
    for (const prop of ["height", "margin", "padding", "gap", "scale(", "top:"]) expect(block, prop).not.toContain(prop);
  });
});
